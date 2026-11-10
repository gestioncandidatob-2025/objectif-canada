import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Plan, PlanDocument } from './schemas/plan.schema';
import {
  PaiementAbonnement,
  PaiementAbonnementDocument,
  StatutPaiementAbonnement,
} from './schemas/paiement-abonnement.schema';
import { AbonnementsService } from './abonnements.service';
import type { PaiementLisible } from './abonnements.service';
import { PLAN_GRATUIT, PLAN_SUR_MESURE, debutDuMoisDouala, etatAbonnement } from './plans';
import { ModifierPlanDto, ReglerAbonnementDto } from './dto/super-admin-abonnement.dto';

const UN_JOUR_MS = 24 * 60 * 60 * 1000;
// Un abonnement qui se termine dans moins de 7 jours est "à suivre"
const JOURS_ECHEANCE_PROCHE = 7;

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
    const maintenant = new Date();
    const [centres, plans, paiementsReussis] = await Promise.all([
      this.centreModel.find().select('nom plan periodicite finAbonnement statut').lean().exec(),
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
    let enGrace = 0;
    let enLectureSeule = 0;
    const parPlan: Record<string, number> = {};
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
      enGrace,
      enLectureSeule,
      plans: plans.map((p) => ({
        code: p.code,
        nom: p.nom,
        prixMensuel: p.prixMensuel,
        prixAnnuel: p.prixAnnuel,
        factures: p.factures,
        comptes: p.comptes,
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
}