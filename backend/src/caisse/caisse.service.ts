import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Paiement, PaiementDocument, TypePaiement } from './schemas/paiement.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

// Le Cameroun est à UTC+1 toute l'année : une journée de caisse va de
// minuit à minuit, heure de Douala, quel que soit le fuseau du serveur.
const DECALAGE_MS = 60 * 60 * 1000;

/** Date "vue depuis Douala" (on lit ensuite ses champs UTC) */
function enHeureLocale(date: Date) {
  return new Date(date.getTime() + DECALAGE_MS);
}

/** Inverse de enHeureLocale */
function versUtc(dateLocale: Date) {
  return new Date(dateLocale.getTime() - DECALAGE_MS);
}

function debutJour(maintenant = new Date()) {
  const local = enHeureLocale(maintenant);
  local.setUTCHours(0, 0, 0, 0);
  return versUtc(local);
}

/** Lundi de la semaine en cours, à minuit */
function debutSemaine(maintenant = new Date()) {
  const local = enHeureLocale(maintenant);
  local.setUTCHours(0, 0, 0, 0);
  const decalageLundi = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - decalageLundi);
  return versUtc(local);
}

function debutMois(maintenant = new Date()) {
  const local = enHeureLocale(maintenant);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(1);
  return versUtc(local);
}

/** La personne dont on regarde la caisse : un compte, ou un ancien nom sans compte */
export type Cible = { userId: string } | { nom: string };

/**
 * Le jour choisi ("2026-11-08", jour à Douala). Sans date, c'est aujourd'hui.
 * On renvoie un instant au milieu de ce jour, pour calculer ses bornes.
 */
function jourDeReference(date?: string) {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return versUtc(new Date(`${date}T12:00:00.000Z`));
  }
  return new Date();
}

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

type Bloc = {
  total: number;
  especes: number;
  mobile: number;
  inscriptions: { nombre: number; montant: number };
  restes: { nombre: number; montant: number };
  corrections: number;
};

function blocVide(): Bloc {
  return {
    total: 0,
    especes: 0,
    mobile: 0,
    inscriptions: { nombre: 0, montant: 0 },
    restes: { nombre: 0, montant: 0 },
    corrections: 0,
  };
}

function ajouterAuBloc(bloc: Bloc, p: PaiementDocument) {
  bloc.total += p.montant;
  bloc.especes += p.especes;
  bloc.mobile += p.mobile;
  if (p.type === TypePaiement.INSCRIPTION) {
    bloc.inscriptions.nombre += 1;
    bloc.inscriptions.montant += p.montant;
  } else if (p.type === TypePaiement.RESTE) {
    bloc.restes.nombre += 1;
    bloc.restes.montant += p.montant;
  } else {
    bloc.corrections += p.montant;
  }
}

@Injectable()
export class CaisseService {
  constructor(
    @InjectModel(Paiement.name) private paiementModel: Model<PaiementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  // ---------- Écriture (appelée par le module Inscriptions) ----------

  /**
   * Ajoute une ligne au journal. Ne fait rien si rien n'a bougé
   * (montant, espèces et mobile à zéro).
   */
  async enregistrer(params: {
    centreId: string;
    inscriptionId: Types.ObjectId | string;
    numeroRecu?: string;
    candidatNom?: string;
    type: TypePaiement;
    especes: number;
    mobile: number;
    modePaiement?: string;
    utilisateurId?: string;
    nomParDefaut: string;
  }) {
    if (params.especes === 0 && params.mobile === 0) return;

    let encaisseParNom = params.nomParDefaut;
    let encaisseParId: Types.ObjectId | undefined;
    if (params.utilisateurId) {
      const utilisateur = await this.userModel
        .findOne({ _id: params.utilisateurId, centreId: params.centreId })
        .select('nom')
        .exec();
      if (utilisateur) {
        encaisseParId = utilisateur._id;
        encaisseParNom = utilisateur.nom;
      }
    }

    await this.paiementModel.create({
      centreId: params.centreId,
      inscriptionId: params.inscriptionId,
      numeroRecu: params.numeroRecu,
      candidatNom: params.candidatNom,
      type: params.type,
      montant: params.especes + params.mobile,
      especes: params.especes,
      mobile: params.mobile,
      modePaiement: params.modePaiement,
      encaisseParId,
      encaisseParNom,
      date: new Date(),
    });
  }

  /** Quand une facture est supprimée, ses paiements sortent aussi de la caisse */
  async supprimerPourInscription(inscriptionId: string, centreId: string) {
    await this.paiementModel.deleteMany({ centreId, inscriptionId }).exec();
  }

  // ---------- Lecture (page Point de caisse) ----------

  /** Filtre MongoDB pour une personne */
  private filtrePersonne(centreId: string, cible: Cible) {
    if ('userId' in cible) {
      return { centreId, encaisseParId: new Types.ObjectId(cible.userId) };
    }
    return { centreId, encaisseParId: null, encaisseParNom: cible.nom };
  }

  /**
   * Les onglets de la page : tous les comptes du centre, plus les anciens
   * noms "Facturé par" qui ne correspondent à aucun compte.
   */
  async personnel(centreId: string) {
    const comptes = await this.userModel
      .find({ centreId })
      .select('nom role')
      .sort({ createdAt: 1 })
      .exec();
    const anciensNoms = (await this.paiementModel
      .distinct('encaisseParNom', { centreId, encaisseParId: null })
      .exec()) as string[];

    return [
      ...comptes.map((u) => ({ id: String(u._id), nom: u.nom, role: u.role as string })),
      ...anciensNoms.map((nom) => ({ id: `nom:${nom}`, nom, role: 'ancien' })),
    ];
  }

  /**
   * Totaux du jour choisi, de sa semaine et de son mois (jusqu'à la fin du
   * jour choisi). Sans date : aujourd'hui, cette semaine, ce mois.
   */
  async resume(centreId: string, cible: Cible, date?: string) {
    const reference = jourDeReference(date);
    const jour = debutJour(reference);
    const finJour = new Date(jour.getTime() + UN_JOUR_MS);
    const semaine = debutSemaine(reference);
    const mois = debutMois(reference);
    const depuis = semaine < mois ? semaine : mois;

    const paiements = await this.paiementModel
      .find({ ...this.filtrePersonne(centreId, cible), date: { $gte: depuis, $lt: finJour } })
      .exec();

    const resultat = { aujourdhui: blocVide(), semaine: blocVide(), mois: blocVide() };
    for (const p of paiements) {
      if (p.date >= jour) ajouterAuBloc(resultat.aujourdhui, p);
      if (p.date >= semaine) ajouterAuBloc(resultat.semaine, p);
      if (p.date >= mois) ajouterAuBloc(resultat.mois, p);
    }
    return resultat;
  }

  /** Le détail des paiements du jour choisi, du plus récent au plus ancien */
  async detailDuJour(centreId: string, cible: Cible, date?: string) {
    const jour = debutJour(jourDeReference(date));
    const finJour = new Date(jour.getTime() + UN_JOUR_MS);
    const paiements = await this.paiementModel
      .find({ ...this.filtrePersonne(centreId, cible), date: { $gte: jour, $lt: finJour } })
      .sort({ date: -1 })
      .exec();

    return paiements.map((p) => ({
      id: String(p._id),
      inscriptionId: String(p.inscriptionId),
      date: p.date,
      numeroRecu: p.numeroRecu,
      candidatNom: p.candidatNom,
      type: p.type,
      modePaiement: p.modePaiement,
      especes: p.especes,
      mobile: p.mobile,
      montant: p.montant,
    }));
  }
}