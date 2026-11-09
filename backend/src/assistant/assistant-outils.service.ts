import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Paiement, PaiementDocument } from '../caisse/schemas/paiement.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { CandidatDocument } from '../candidats/schemas/candidat.schema';
import { Tarif, TarifDocument } from '../tarifs/schemas/tarif.schema';
import { CaisseService } from '../caisse/caisse.service';
import { RechercheService } from '../recherche/recherche.service';

/**
 * Les "outils" de l'assistant : de petites fonctions de LECTURE que l'IA
 * peut demander à lancer pour connaître les vrais chiffres du centre.
 *
 * Sécurité :
 * - aucun outil ne modifie quoi que ce soit (lecture seule) ;
 * - le centre vient TOUJOURS du jeton de connexion, jamais de l'IA :
 *   l'IA ne peut donc pas lire les données d'un autre centre.
 */

const UN_JOUR_MS = 24 * 60 * 60 * 1000;
// Période maximale d'une question (un peu plus d'un an)
const JOURS_MAX = 400;

/** Minuit à Douala (UTC+1) pour un jour "AAAA-MM-JJ" */
function debutDuJour(jour: string) {
  return new Date(`${jour}T00:00:00.000+01:00`);
}

function jourValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) && !isNaN(debutDuJour(valeur).getTime());
}

/** Retire les accents et met en minuscules : "Éric" → "eric" */
function normaliser(texte: string) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Bornes d'une période, du premier jour à minuit jusqu'au lendemain du dernier jour */
function bornes(dateDebut: unknown, dateFin: unknown) {
  if (!jourValide(dateDebut) || !jourValide(dateFin)) {
    return { erreur: 'Dates invalides : utilise le format AAAA-MM-JJ' as const };
  }
  let debut = debutDuJour(dateDebut);
  let fin = new Date(debutDuJour(dateFin).getTime() + UN_JOUR_MS);
  if (fin <= debut) {
    [debut, fin] = [new Date(fin.getTime() - UN_JOUR_MS), new Date(debut.getTime() + UN_JOUR_MS)];
  }
  if (fin.getTime() - debut.getTime() > JOURS_MAX * UN_JOUR_MS) {
    return { erreur: `Période trop longue : ${JOURS_MAX} jours maximum` as const };
  }
  return { debut, fin };
}

/** Description des outils, au format attendu par Groq (le même qu'OpenAI) */
export const DEFINITIONS_OUTILS = [
  {
    type: 'function',
    function: {
      name: 'encaissements',
      description:
        "Argent réellement encaissé (journal des paiements) entre deux dates incluses : total, espèces, mobile, détail par personne qui a encaissé, nombre d'avances et de restes encaissés. À utiliser pour toute question sur l'argent reçu, la caisse, les recettes.",
      parameters: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', description: 'Premier jour, format AAAA-MM-JJ' },
          date_fin: { type: 'string', description: 'Dernier jour inclus, format AAAA-MM-JJ' },
          personne: {
            type: 'string',
            description: "Facultatif : nom (ou partie du nom) de la personne qui a encaissé",
          },
        },
        required: ['date_debut', 'date_fin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'factures_periode',
      description:
        'Factures créées entre deux dates incluses : nombre, montant total facturé, déjà payé, reste à payer, remises, détail par service et par personne qui a facturé.',
      parameters: {
        type: 'object',
        properties: {
          date_debut: { type: 'string', description: 'Premier jour, format AAAA-MM-JJ' },
          date_fin: { type: 'string', description: 'Dernier jour inclus, format AAAA-MM-JJ' },
        },
        required: ['date_debut', 'date_fin'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'restes_a_payer',
      description:
        "Candidats qui doivent encore de l'argent (toutes dates) : nombre, total dû, et les plus gros restes avec nom, téléphone et numéro de reçu.",
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'Facultatif : limiter à un service (ex : TCF)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'chercher_candidat',
      description:
        'Cherche un candidat par nom, prénom, téléphone ou numéro de reçu, et donne ses factures (service, montant, reste).',
      parameters: {
        type: 'object',
        properties: {
          texte: { type: 'string', description: 'Nom, téléphone ou numéro de reçu' },
        },
        required: ['texte'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'liste_personnel',
      description: 'Les comptes du centre (administrateur, secrétaires) avec leur rôle.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'liste_services',
      description: 'Les services proposés par le centre, avec leur prix et leurs régimes.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

type Compteur = { nombre: number; montant: number };

@Injectable()
export class AssistantOutilsService {
  constructor(
    @InjectModel(Paiement.name) private paiementModel: Model<PaiementDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Tarif.name) private tarifModel: Model<TarifDocument>,
    private readonly caisseService: CaisseService,
    private readonly rechercheService: RechercheService,
  ) {}

  /** Lance l'outil demandé par l'IA. Une erreur est renvoyée à l'IA, pas à l'utilisateur. */
  async executer(nom: string, args: Record<string, unknown>, centreId: string): Promise<unknown> {
    try {
      switch (nom) {
        case 'encaissements':
          return await this.encaissements(centreId, args);
        case 'factures_periode':
          return await this.facturesPeriode(centreId, args);
        case 'restes_a_payer':
          return await this.restesAPayer(centreId, args);
        case 'chercher_candidat':
          return await this.rechercheService.rechercher(centreId, String(args.texte ?? ''));
        case 'liste_personnel':
          return await this.caisseService.personnel(centreId);
        case 'liste_services':
          return await this.listeServices(centreId);
        default:
          return { erreur: `Outil inconnu : ${nom}` };
      }
    } catch {
      return { erreur: "Impossible de lire ces données pour l'instant" };
    }
  }

  private async encaissements(centreId: string, args: Record<string, unknown>) {
    const periode = bornes(args.date_debut, args.date_fin);
    if ('erreur' in periode) return periode;

    const paiements = await this.paiementModel
      .find({ centreId, date: { $gte: periode.debut, $lt: periode.fin } })
      .select('montant especes mobile type encaisseParNom')
      .lean()
      .exec();

    const filtreNom = typeof args.personne === 'string' && args.personne.trim() ? normaliser(args.personne) : '';
    const retenus = filtreNom
      ? paiements.filter((p) => normaliser(p.encaisseParNom ?? '').includes(filtreNom))
      : paiements;

    const total = { total: 0, especes: 0, mobile: 0 };
    const avances: Compteur = { nombre: 0, montant: 0 };
    const restes: Compteur = { nombre: 0, montant: 0 };
    let corrections = 0;
    const parPersonne: Record<string, { total: number; especes: number; mobile: number }> = {};

    for (const p of retenus) {
      total.total += p.montant;
      total.especes += p.especes ?? 0;
      total.mobile += p.mobile ?? 0;
      if (p.type === 'inscription') {
        avances.nombre += 1;
        avances.montant += p.montant;
      } else if (p.type === 'reste') {
        restes.nombre += 1;
        restes.montant += p.montant;
      } else {
        corrections += p.montant;
      }
      const nom = p.encaisseParNom || 'Inconnu';
      parPersonne[nom] ??= { total: 0, especes: 0, mobile: 0 };
      parPersonne[nom].total += p.montant;
      parPersonne[nom].especes += p.especes ?? 0;
      parPersonne[nom].mobile += p.mobile ?? 0;
    }

    return {
      periode: { du: args.date_debut, au: args.date_fin },
      personneDemandee: filtreNom ? args.personne : null,
      devise: 'FCFA',
      ...total,
      avancesALaFacturation: avances,
      restesEncaisses: restes,
      corrections,
      parPersonne: Object.entries(parPersonne)
        .map(([nom, v]) => ({ nom, ...v }))
        .sort((a, b) => b.total - a.total),
    };
  }

  private async facturesPeriode(centreId: string, args: Record<string, unknown>) {
    const periode = bornes(args.date_debut, args.date_fin);
    if ('erreur' in periode) return periode;

    const factures = await this.inscriptionModel
      .find({ centreId, dateInscription: { $gte: periode.debut, $lt: periode.fin } })
      .select('service montantTotal montantPaye resteAPayer remise facturePar candidatId')
      .limit(5000)
      .lean()
      .exec();

    const resultat = {
      periode: { du: args.date_debut, au: args.date_fin },
      devise: 'FCFA',
      nombreFactures: factures.length,
      nombreCandidats: new Set(factures.map((f) => String(f.candidatId))).size,
      montantFacture: 0,
      dejaPaye: 0,
      resteAPayer: 0,
      remises: 0,
      facturesNonSoldees: 0,
      parService: {} as Record<string, { nombre: number; montant: number }>,
      parPersonne: {} as Record<string, { nombre: number; montant: number }>,
    };

    for (const f of factures) {
      resultat.montantFacture += f.montantTotal ?? 0;
      resultat.dejaPaye += f.montantPaye ?? 0;
      resultat.resteAPayer += f.resteAPayer ?? 0;
      resultat.remises += f.remise ?? 0;
      if ((f.resteAPayer ?? 0) > 0) resultat.facturesNonSoldees += 1;

      resultat.parService[f.service] ??= { nombre: 0, montant: 0 };
      resultat.parService[f.service].nombre += 1;
      resultat.parService[f.service].montant += f.montantTotal ?? 0;

      const nom = f.facturePar || 'Inconnu';
      resultat.parPersonne[nom] ??= { nombre: 0, montant: 0 };
      resultat.parPersonne[nom].nombre += 1;
      resultat.parPersonne[nom].montant += f.montantTotal ?? 0;
    }
    return resultat;
  }

  private async restesAPayer(centreId: string, args: Record<string, unknown>) {
    const filtre: Record<string, unknown> = { centreId, resteAPayer: { $gt: 0 } };
    const factures = await this.inscriptionModel
      .find(filtre)
      .select('service resteAPayer montantTotal numeroRecu dateInscription candidatId')
      .populate({ path: 'candidatId', match: { centreId }, select: 'nom prenom telephone' })
      .lean()
      .exec();

    const filtreService = typeof args.service === 'string' && args.service.trim() ? normaliser(args.service) : '';
    const retenues = filtreService
      ? factures.filter((f) => normaliser(f.service).includes(filtreService))
      : factures;

    const plusGros = [...retenues].sort((a, b) => b.resteAPayer - a.resteAPayer).slice(0, 15);

    return {
      serviceDemande: filtreService ? args.service : null,
      devise: 'FCFA',
      nombreFactures: retenues.length,
      totalDu: retenues.reduce((somme, f) => somme + f.resteAPayer, 0),
      plusGrosRestes: plusGros.map((f) => {
        const c = f.candidatId as unknown as CandidatDocument | null;
        return {
          candidat: c ? `${c.nom} ${c.prenom}` : 'Inconnu',
          telephone: c?.telephone ?? '',
          numeroRecu: f.numeroRecu,
          service: f.service,
          montantTotal: f.montantTotal,
          reste: f.resteAPayer,
          dateFacture: f.dateInscription,
        };
      }),
    };
  }

  private async listeServices(centreId: string) {
    const tarifs = await this.tarifModel.find({ centreId }).select('service prix regimes actif').lean().exec();
    return tarifs.map((t) => ({
      service: t.service,
      prix: t.prix ?? null,
      regimes: t.regimes ?? [],
      actif: t.actif,
    }));
  }
}