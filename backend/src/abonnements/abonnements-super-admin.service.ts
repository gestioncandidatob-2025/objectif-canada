import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Plan, PlanDocument } from './schemas/plan.schema';
import {
  PaiementAbonnement,
  PaiementAbonnementDocument,
  StatutPaiementAbonnement,
} from './schemas/paiement-abonnement.schema';
import { AbonnementsService } from './abonnements.service';
import type { PaiementLisible } from './abonnements.service';
import { PLAN_GRATUIT, PLAN_SUR_MESURE, ajouterMois, debutDuMoisDouala, etatAbonnement } from './plans';
import { ModifierPlanDto, OffrirPlanDto, ReglerAbonnementDto } from './dto/super-admin-abonnement.dto';

const UN_JOUR_MS = 24 * 60 * 60 * 1000;
// Un abonnement qui se termine dans moins de 7 jours est "à suivre"
const JOURS_ECHEANCE_PROCHE = 7;

/** Le soir (23 h 59, heure de Douala) du jour donné "AAAA-MM-JJ" */
function soirDouala(jour: string) {
  return new Date(`${jour.slice(0, 10)}T23:59:59.000+01:00`);
}

/** Le jour (heure de Douala) d'une date, au format "AAAA-MM-JJ" */
function jourDouala(date: Date) {
  return new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Espace super admin : vue d'ensemble des abonnements, prix des plans,
 * abonnement réglé à la main. Le super admin ne lit jamais les factures
 * des centres : seulement les paiements d'abonnement faits à HREFF.
 */
@Injectable()
export class AbonnementsSuperAdminService {
  constructor(
    private readonly abonnementsService: AbonnementsService,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
    @InjectModel(PaiementAbonnement.name)
    private paiementModel: Model<PaiementAbonnementDocument>,
  ) {}

  async vueEnsemble() {
    // Les offres arrivées à leur fin se terminent d'abord (chiffres à jour)
    await this.abonnementsService.terminerOffresExpirees();
    const maintenant = new Date();
    const [centres, plans, paiementsReussis] = await Promise.all([
      this.centreModel.find().select('nom plan periodicite finAbonnement statut offre').lean().exec(),
      this.planModel.find().sort({ ordre: 1 }).lean().exec(),
      this.paiementModel
        .find({ statut: StatutPaiementAbonnement.REUSSI })
        .setOptions({ sansCentre: true })
        .sort({ dateConfirmation: -1 })
        .limit(200)
        .lean()
        .exec(),
    ]);

    const nomsCentres = new Map<string, string>(centres.map((c) => [String(c._id), c.nom] as [string, string]));
    const nomsPlans = new Map<string, string>(plans.map((p) => [p.code, p.nom] as [string, string]));
    const debutMois = debutDuMoisDouala(maintenant);

    let centresPayants = 0;
    let centresOfferts = 0;
    let enGrace = 0;
    let enLectureSeule = 0;
    const parPlan: Record<string, number> = {};
    const offresEnCours: {
      centreId: string;
      centre: string;
      plan: string;
      fin: Date;
      planPrecedent: string;
    }[] = [];
    const aSuivre: {
      centreId: string;
      centre: string;
      plan: string;
      statut: string;
      finAbonnement: Date | null;
      finGrace: Date | null;
    }[] = [];

    for (const centre of centres) {
      const code = centre.plan || PLAN_GRATUIT;
      parPlan[code] = (parPlan[code] ?? 0) + 1;
      const etat = etatAbonnement(centre, maintenant);
      // Un plan offert n'est pas un centre payant
      if (centre.offre?.fin) {
        centresOfferts += 1;
        offresEnCours.push({
          centreId: String(centre._id),
          centre: centre.nom,
          plan: nomsPlans.get(code) ?? code,
          fin: centre.offre.fin,
          planPrecedent:
            nomsPlans.get(centre.offre.planPrecedent || PLAN_GRATUIT) ??
            centre.offre.planPrecedent ??
            PLAN_GRATUIT,
        });
        continue;
      }
      if (etat.statut === 'actif') centresPayants += 1;
      if (etat.statut === 'grace') enGrace += 1;
      if (etat.statut === 'lecture_seule') enLectureSeule += 1;

      const echeanceProche =
        etat.statut === 'actif' &&
        centre.finAbonnement &&
        new Date(centre.finAbonnement).getTime() - maintenant.getTime() < JOURS_ECHEANCE_PROCHE * UN_JOUR_MS;
      if (echeanceProche || etat.statut === 'grace' || etat.statut === 'lecture_seule') {
        aSuivre.push({
          centreId: String(centre._id),
          centre: centre.nom,
          plan: nomsPlans.get(code) ?? code,
          statut: echeanceProche ? 'echeance_proche' : etat.statut,
          finAbonnement: centre.finAbonnement ?? null,
          finGrace: etat.finGrace,
        });
      }
    }

    const revenusDuMois = paiementsReussis
      .filter((p) => p.dateConfirmation && p.dateConfirmation >= debutMois)
      .reduce((somme, p) => somme + p.montant, 0);

    return {
      revenusDuMois,
      nombreCentres: centres.length,
      centresPayants,
      centresOfferts,
      offresEnCours: offresEnCours.sort((a, b) => new Date(a.fin).getTime() - new Date(b.fin).getTime()),
      enGrace,
      enLectureSeule,
      plans: plans.map((p) => ({
        code: p.code,
        nom: p.nom,
        prixMensuel: p.prixMensuel,
        prixAnnuel: p.prixAnnuel,
        factures: p.factures,
        comptes: p.comptes,
        prixParFacture: p.prixParFacture ?? null,
        facturesParCompte: p.facturesParCompte ?? null,
        prixCompteSupplementaire: p.prixCompteSupplementaire ?? null,
        nombreCentres: parPlan[p.code] ?? 0,
      })),
      aSuivre,
      derniersPaiements: paiementsReussis.slice(0, 20).map((p) => ({
        ...this.abonnementsService.formaterPaiement(p as unknown as PaiementLisible),
        centre: nomsCentres.get(String(p.centreId)) ?? '—',
        planNom: nomsPlans.get(p.plan) ?? p.plan,
      })),
    };
  }

  async modifierPlan(code: string, dto: ModifierPlanDto) {
    const plan = await this.planModel.findOne({ code }).exec();
    if (!plan) throw new NotFoundException('Plan introuvable');
    if (dto.prixMensuel !== undefined) plan.prixMensuel = dto.prixMensuel;
    if (dto.prixAnnuel !== undefined) plan.prixAnnuel = dto.prixAnnuel;
    if (dto.factures !== undefined) plan.factures = dto.factures;
    if (dto.comptes !== undefined) plan.comptes = dto.comptes;
    if (plan.code === PLAN_SUR_MESURE) {
      if (dto.prixParFacture !== undefined) plan.prixParFacture = dto.prixParFacture;
      if (dto.facturesParCompte !== undefined) plan.facturesParCompte = dto.facturesParCompte;
      if (dto.prixCompteSupplementaire !== undefined) {
        plan.prixCompteSupplementaire = dto.prixCompteSupplementaire;
      }
    }
    await plan.save();
    return plan;
  }

  /** Abonnement d'un centre et ses limites (fiche du centre) */
  async abonnementDuCentre(centreId: string) {
    const centre = await this.centreModel.findById(centreId).exec();
    if (!centre) throw new NotFoundException('Centre introuvable');
    const etat = await this.abonnementsService.etatPourLeCentre(centreId);
    const paiements = await this.paiementModel
      .find({ centreId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();
    return {
      ...etat,
      surMesure: centre.surMesure ?? null,
      paiements: paiements.map((p) =>
        this.abonnementsService.formaterPaiement(p as unknown as PaiementLisible),
      ),
    };
  }

  async reglerAbonnement(centreId: string, dto: ReglerAbonnementDto) {
    const centre = await this.centreModel.findById(centreId).exec();
    if (!centre) throw new NotFoundException('Centre introuvable');

    // Le réglage à la main remplace une offre en cours
    centre.offre = undefined;
    centre.plan = dto.plan;
    if (dto.plan === PLAN_GRATUIT) {
      centre.periodicite = undefined;
      centre.finAbonnement = undefined;
    } else {
      if (dto.periodicite !== undefined) centre.periodicite = dto.periodicite;
      if (dto.finAbonnement !== undefined) {
        // La date choisie compte jusqu'au soir (23 h 59, heure de Douala)
        centre.finAbonnement = dto.finAbonnement
          ? new Date(`${dto.finAbonnement.slice(0, 10)}T23:59:59.000+01:00`)
          : undefined;
      }
    }
    if (dto.plan === PLAN_SUR_MESURE && dto.surMesure) {
      centre.surMesure = { ...(centre.surMesure ?? {}), ...dto.surMesure };
    }
    await centre.save();
    return this.abonnementDuCentre(centreId);
  }

  /**
   * Offre un plan à un centre pour une période, sans paiement. À la fin, le
   * centre revient tout seul à son plan d'avant (voir AbonnementsService).
   */
  async offrirPlan(centreId: string, dto: OffrirPlanDto) {
    const centre = await this.centreModel.findById(centreId).exec();
    if (!centre) throw new NotFoundException('Centre introuvable');
    await this.abonnementsService.terminerOffreSiExpiree(centre);

    const maintenant = new Date();
    let fin: Date;
    if (dto.fin) {
      fin = soirDouala(dto.fin);
    } else if (dto.mois) {
      fin = soirDouala(jourDouala(ajouterMois(maintenant, dto.mois)));
    } else {
      throw new BadRequestException('Indique un nombre de mois ou une date de fin');
    }
    if (fin <= maintenant) {
      throw new BadRequestException("La date de fin de l'offre doit être dans le futur");
    }

    // On garde le plan d'avant une seule fois : une nouvelle offre pendant
    // une offre ne fait que changer le plan offert et la date de fin
    const offreActuelle = centre.offre?.fin ? centre.offre : null;
    const resteMs =
      centre.plan !== PLAN_GRATUIT && centre.finAbonnement && centre.finAbonnement > maintenant
        ? centre.finAbonnement.getTime() - maintenant.getTime()
        : 0;
    centre.offre = offreActuelle
      ? {
          plan: dto.plan,
          debut: offreActuelle.debut,
          fin,
          planPrecedent: offreActuelle.planPrecedent,
          periodicitePrecedente: offreActuelle.periodicitePrecedente,
          finAbonnementPrecedent: offreActuelle.finAbonnementPrecedent,
          resteMsPrecedent: offreActuelle.resteMsPrecedent,
        }
      : {
          plan: dto.plan,
          debut: maintenant,
          fin,
          planPrecedent: centre.plan || PLAN_GRATUIT,
          periodicitePrecedente: centre.periodicite,
          finAbonnementPrecedent: centre.finAbonnement,
          resteMsPrecedent: resteMs,
        };
    centre.markModified('offre');
    centre.plan = dto.plan;
    centre.periodicite = undefined;
    centre.finAbonnement = fin;
    await centre.save();
    return this.abonnementDuCentre(centreId);
  }

  /** Arrête l'offre tout de suite : le centre revient à son plan d'avant */
  async arreterOffre(centreId: string) {
    const centre = await this.centreModel.findById(centreId).exec();
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (!centre.offre?.fin) throw new BadRequestException("Ce centre n'a pas d'offre en cours");
    this.abonnementsService.remettrePlanPrecedent(centre, new Date());
    await centre.save();
    return this.abonnementDuCentre(centreId);
  }

  /**
   * Historique de toutes les transactions d'abonnement (réussies, échouées,
   * en attente), avec filtres et pages. Seulement les paiements faits à
   * HREFF : jamais le contenu des factures des centres.
   */
  async transactions(filtres: {
    statut?: string;
    centreId?: string;
    debut?: string;
    fin?: string;
    page?: number;
  }) {
    const LIMITE = 25;
    const page = filtres.page && filtres.page > 0 ? Math.floor(filtres.page) : 1;

    // Filtre commun (sans le statut, pour compter chaque statut)
    const base: Record<string, unknown> = {};
    if (filtres.centreId && Types.ObjectId.isValid(filtres.centreId)) {
      base.centreId = new Types.ObjectId(filtres.centreId);
    }
    const dates: Record<string, Date> = {};
    if (filtres.debut && /^\d{4}-\d{2}-\d{2}$/.test(filtres.debut)) {
      dates.$gte = new Date(`${filtres.debut}T00:00:00.000+01:00`);
    }
    if (filtres.fin && /^\d{4}-\d{2}-\d{2}$/.test(filtres.fin)) {
      dates.$lte = new Date(`${filtres.fin}T23:59:59.999+01:00`);
    }
    if (Object.keys(dates).length) base.createdAt = dates;

    const statutsValides = Object.values(StatutPaiementAbonnement) as string[];
    const requete: Record<string, unknown> = { ...base };
    if (filtres.statut && statutsValides.includes(filtres.statut)) requete.statut = filtres.statut;

    const compter = (filtre: Record<string, unknown>) =>
      this.paiementModel.countDocuments(filtre).setOptions({ sansCentre: true }).exec();

    const [lignes, total, reussis, echoues, enAttente, montantsReussis, centres, plans] = await Promise.all([
      this.paiementModel
        .find(requete)
        .setOptions({ sansCentre: true })
        .sort({ createdAt: -1 })
        .skip((page - 1) * LIMITE)
        .limit(LIMITE)
        .lean()
        .exec(),
      compter(requete),
      compter({ ...base, statut: StatutPaiementAbonnement.REUSSI }),
      compter({ ...base, statut: StatutPaiementAbonnement.ECHOUE }),
      compter({ ...base, statut: StatutPaiementAbonnement.EN_ATTENTE }),
      this.paiementModel
        .find({ ...base, statut: StatutPaiementAbonnement.REUSSI })
        .setOptions({ sansCentre: true })
        .select('montant')
        .lean()
        .exec(),
      this.centreModel.find().select('nom').lean().exec(),
      this.planModel.find().select('code nom').lean().exec(),
    ]);

    const nomsCentres = new Map<string, string>(centres.map((c) => [String(c._id), c.nom] as [string, string]));
    const nomsPlans = new Map<string, string>(plans.map((p) => [p.code, p.nom] as [string, string]));

    return {
      transactions: lignes.map((p) => ({
        ...this.abonnementsService.formaterPaiement(p as unknown as PaiementLisible),
        centreId: String(p.centreId),
        centre: nomsCentres.get(String(p.centreId)) ?? '—',
        planNom: nomsPlans.get(p.plan) ?? p.plan,
        telephone: p.telephone ?? null,
        referenceCampay: p.referenceCampay ?? null,
      })),
      total,
      page,
      limite: LIMITE,
      resume: {
        reussis,
        echoues,
        enAttente,
        montantReussi: montantsReussis.reduce((somme, p) => somme + (p.montant ?? 0), 0),
      },
    };
  }
}