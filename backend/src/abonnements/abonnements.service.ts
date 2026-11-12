import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Plan, PlanDocument } from './schemas/plan.schema';
import {
  PaiementAbonnement,
  PaiementAbonnementDocument,
  StatutPaiementAbonnement,
} from './schemas/paiement-abonnement.schema';
import { CampayService, TransactionCampay } from './campay.service';
import {
  MOIS_PAYES_PAR_AN,
  PLANS_PAR_DEFAUT,
  PLAN_GRATUIT,
  PLAN_SUR_MESURE,
  TARIF_SUR_MESURE_PAR_DEFAUT,
  TarifSurMesure,
  calculerSurMesure,
  Periodicite,
  SEUIL_ALERTE_QUOTA,
  ajouterMois,
  debutDuMoisDouala,
  etatAbonnement,
  normaliserTelephone,
} from './plans';

/** Les champs d'un paiement d'abonnement affichés à l'écran */
export interface PaiementLisible {
  _id: unknown;
  plan: string;
  periodicite: string;
  montant: number;
  moyen: string;
  statut: string;
  operateur?: string | null;
  raisonEchec?: string | null;
  payeParNom?: string | null;
  createdAt?: Date;
  dateConfirmation?: Date | null;
  finPeriode?: Date | null;
  factures?: number | null;
  comptes?: number | null;
}

/** Prix et limites qui s'appliquent à un centre */
export interface PlanApplique {
  code: string;
  nom: string;
  prixMensuel: number | null;
  prixAnnuel: number | null;
  factures: number;
  comptes: number;
}

/**
 * Abonnements des centres : limites des plans, état (actif, grâce, lecture
 * seule) et paiement avec CamPay. Le centre vient toujours du jeton de
 * connexion ; seule la notification de CamPay (webhook) n'a pas de jeton.
 */
@Injectable()
export class AbonnementsService implements OnModuleInit {
  private readonly logger = new Logger(AbonnementsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly campay: CampayService,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PaiementAbonnement.name)
    private paiementModel: Model<PaiementAbonnementDocument>,
  ) {}

  /** Au démarrage : crée les plans de départ s'ils n'existent pas (sans toucher aux prix modifiés) */
  async onModuleInit() {
    try {
      await this.planModel.bulkWrite(
        PLANS_PAR_DEFAUT.map((plan) => ({
          updateOne: {
            filter: { code: plan.code },
            update: { $setOnInsert: plan },
            upsert: true,
          },
        })),
      );
      // Prix de départ du Sur mesure, s'ils n'ont jamais été enregistrés
      await this.planModel.updateOne(
        { code: PLAN_SUR_MESURE, prixParFacture: { $exists: false } },
        { $set: TARIF_SUR_MESURE_PAR_DEFAUT },
      );
    } catch (erreur) {
      this.logger.warn(`Création des plans impossible : ${String(erreur)}`);
    }
  }

  // ---------- Plans et limites ----------

  /** Prix du Sur mesure (enregistrés par le super admin, ou ceux de départ) */
  async tarifSurMesure(): Promise<TarifSurMesure> {
    const plan = await this.planModel.findOne({ code: PLAN_SUR_MESURE }).lean().exec();
    return {
      prixParFacture: plan?.prixParFacture ?? TARIF_SUR_MESURE_PAR_DEFAUT.prixParFacture,
      facturesParCompte: plan?.facturesParCompte ?? TARIF_SUR_MESURE_PAR_DEFAUT.facturesParCompte,
      prixCompteSupplementaire:
        plan?.prixCompteSupplementaire ?? TARIF_SUR_MESURE_PAR_DEFAUT.prixCompteSupplementaire,
    };
  }

  async listerPlans() {
    return this.planModel.find().sort({ ordre: 1 }).lean().exec();
  }

  /** Prix et limites du centre (le Sur mesure prend les valeurs réglées pour ce centre) */
  async planDuCentre(centre: CentreDocument | (Centre & { _id: unknown })): Promise<PlanApplique> {
    const code = centre.plan || PLAN_GRATUIT;
    const plan =
      (await this.planModel.findOne({ code }).lean().exec()) ??
      (await this.planModel.findOne({ code: PLAN_GRATUIT }).lean().exec());
    const base: PlanApplique = {
      code,
      nom: plan?.nom ?? code,
      prixMensuel: plan?.prixMensuel ?? null,
      prixAnnuel: plan?.prixAnnuel ?? null,
      factures: plan?.factures ?? 25,
      comptes: plan?.comptes ?? 2,
    };
    if (code === PLAN_SUR_MESURE && centre.surMesure) {
      const sm = centre.surMesure;
      return {
        ...base,
        factures: sm.factures ?? base.factures,
        comptes: sm.comptes ?? base.comptes,
        prixMensuel: sm.prixMensuel ?? null,
        prixAnnuel: sm.prixAnnuel ?? null,
      };
    }
    return base;
  }

  private async trouverCentre(centreId: string) {
    const centre = await this.centreModel.findById(centreId).exec();
    if (!centre) throw new NotFoundException('Centre introuvable');
    await this.terminerOffreSiExpiree(centre);
    return centre;
  }

  // ---------- Plan offert par le super admin ----------

  /**
   * Remet le centre à son plan d'avant l'offre (avec le temps payé qu'il lui
   * restait, compté à partir de la fin prévue de l'offre).
   */
  remettrePlanPrecedent(centre: CentreDocument, aPartirDe: Date) {
    const offre = centre.offre;
    if (!offre) return;
    centre.plan = offre.planPrecedent || PLAN_GRATUIT;
    centre.periodicite = offre.periodicitePrecedente || undefined;
    if (offre.resteMsPrecedent && offre.resteMsPrecedent > 0) {
      centre.finAbonnement = new Date(aPartirDe.getTime() + offre.resteMsPrecedent);
    } else {
      centre.finAbonnement = offre.finAbonnementPrecedent ?? undefined;
    }
    centre.offre = undefined;
  }

  /** Si l'offre du centre est terminée, il revient à son plan d'avant */
  async terminerOffreSiExpiree(centre: CentreDocument, maintenant = new Date()) {
    const fin = centre.offre?.fin;
    if (!fin || new Date(fin) > maintenant) return false;
    this.remettrePlanPrecedent(centre, new Date(fin));
    await centre.save();
    this.logger.log(`Offre terminée pour le centre ${String(centre._id)} : retour au plan ${centre.plan}`);
    return true;
  }

  /** Toutes les 10 minutes : les offres arrivées à leur date de fin se terminent */
  @Cron('*/10 * * * *')
  async terminerOffresExpirees() {
    try {
      const maintenant = new Date();
      const centres = await this.centreModel.find({ 'offre.fin': { $lte: maintenant } }).exec();
      for (const centre of centres) {
        await this.terminerOffreSiExpiree(centre, maintenant);
      }
    } catch (erreur) {
      this.logger.warn(`Fin des offres impossible : ${String(erreur)}`);
    }
  }

  /** Où en est le centre : plan, état, factures du mois et comptes utilisés */
  async utilisation(centreId: string) {
    const centre = await this.trouverCentre(centreId);
    const [plan, facturesCeMois, comptes] = await Promise.all([
      this.planDuCentre(centre),
      this.inscriptionModel.countDocuments({ centreId, createdAt: { $gte: debutDuMoisDouala() } }),
      this.userModel.countDocuments({ centreId }),
    ]);
    return { centre, plan, etat: etatAbonnement(centre), facturesCeMois, comptes };
  }

  /**
   * Ce que tout utilisateur du centre doit savoir (admin et secrétaires) :
   * peut-on créer une facture, et faut-il afficher un avertissement ?
   */
  async etatPourLeCentre(centreId: string) {
    const { centre, plan, etat, facturesCeMois, comptes } = await this.utilisation(centreId);
    const raison = this.raisonBlocageFacture(etat.statut, facturesCeMois, plan);
    return {
      plan: { code: plan.code, nom: plan.nom },
      statut: etat.statut,
      periodicite: centre.periodicite ?? null,
      finAbonnement: centre.finAbonnement ?? null,
      finGrace: etat.finGrace,
      // Plan offert par HREFF (null si le centre n'a pas d'offre en cours)
      offre: centre.offre?.fin
        ? { fin: centre.offre.fin, planPrecedent: centre.offre.planPrecedent ?? PLAN_GRATUIT }
        : null,
      factures: { utilisees: facturesCeMois, limite: plan.factures },
      comptes: { utilises: comptes, limite: plan.comptes },
      peutFacturer: raison === null,
      raisonBlocage: raison,
      alerteQuota: facturesCeMois >= Math.ceil(plan.factures * SEUIL_ALERTE_QUOTA),
    };
  }

  /** Page Abonnement de l'admin : état, plans à acheter, derniers paiements */
  async resumePourAdmin(centreId: string) {
    const etat = await this.etatPourLeCentre(centreId);
    const centre = await this.trouverCentre(centreId);
    const plans = await this.listerPlans();

    const plansPayables = plans
      .filter((p) => p.code !== PLAN_GRATUIT && p.code !== PLAN_SUR_MESURE)
      .map((p) => ({
        code: p.code,
        nom: p.nom,
        prixMensuel: p.prixMensuel,
        prixAnnuel: p.prixAnnuel,
        factures: p.factures,
        comptes: p.comptes,
      }));
    // Sur mesure : le centre choisit ses factures et ses comptes, le prix est
    // calculé (dans la page, puis recalculé ici au moment de payer)
    const tarif = await this.tarifSurMesure();
    const actuel = centre.plan === PLAN_SUR_MESURE ? await this.planDuCentre(centre) : null;

    const paiements = await this.paiementModel
      .find({ centreId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .exec();

    return {
      ...etat,
      paiementEnLigne: this.campay.estConfigure(),
      plansGratuits: plans
        .filter((p) => p.code === PLAN_GRATUIT)
        .map((p) => ({ code: p.code, nom: p.nom, factures: p.factures, comptes: p.comptes })),
      plans: plansPayables,
      surMesure: {
        tarif,
        moisPayesParAn: MOIS_PAYES_PAR_AN,
        // Valeurs actuelles du centre s'il est déjà en Sur mesure (pour renouveler)
        actuel: actuel ? { factures: actuel.factures, comptes: actuel.comptes } : null,
      },
      paiements: paiements.map((p) => this.formaterPaiement(p as unknown as PaiementLisible)),
    };
  }

  // ---------- Limites : vérifiées avant de créer une facture ou un compte ----------

  private raisonBlocageFacture(statut: string, facturesCeMois: number, plan: PlanApplique): string | null {
    if (statut === 'lecture_seule') {
      return "L'abonnement du centre a expiré : plus de nouvelle facture. L'administrateur doit le renouveler (menu Abonnement).";
    }
    if (facturesCeMois >= plan.factures) {
      return `Limite de ${plan.factures} factures ce mois atteinte (plan ${plan.nom}). L'administrateur peut passer à un plan supérieur (menu Abonnement).`;
    }
    return null;
  }

  async verifierPeutCreerFacture(centreId: string) {
    const { plan, etat, facturesCeMois } = await this.utilisation(centreId);
    const raison = this.raisonBlocageFacture(etat.statut, facturesCeMois, plan);
    if (raison) throw new ForbiddenException(raison);
  }

  async verifierPeutCreerCompte(centreId: string) {
    const { plan, etat, comptes } = await this.utilisation(centreId);
    if (etat.statut === 'lecture_seule') {
      throw new ForbiddenException(
        "L'abonnement du centre a expiré : renouvelle-le (menu Abonnement) pour créer un compte.",
      );
    }
    if (comptes >= plan.comptes) {
      throw new ForbiddenException(
        `Limite de ${plan.comptes} comptes atteinte (plan ${plan.nom}). Passe à un plan supérieur (menu Abonnement).`,
      );
    }
  }

  // ---------- Paiement ----------

  /**
   * Prix du plan choisi, ou une erreur claire. Pour le Sur mesure, le prix est
   * toujours recalculé ici (on ne fait jamais confiance au montant affiché).
   */
  private async prixAPayer(
    codePlan: string,
    periodicite: Periodicite,
    factures?: number,
    comptes?: number,
  ): Promise<{ prix: number; nomPlan: string; factures?: number; comptes?: number }> {
    if (codePlan === PLAN_GRATUIT) {
      throw new BadRequestException('Le plan Gratuit ne se paie pas');
    }

    if (codePlan === PLAN_SUR_MESURE) {
      if (!factures || factures < 1) {
        throw new BadRequestException('Indique un nombre de factures par mois');
      }
      const calcul = calculerSurMesure(factures, comptes, await this.tarifSurMesure());
      const prix = periodicite === 'annuel' ? calcul.prixAnnuel : calcul.prixMensuel;
      if (prix <= 0) throw new BadRequestException('Montant invalide');
      return { prix, nomPlan: 'Sur mesure', factures: calcul.factures, comptes: calcul.comptes };
    }

    const plan = await this.planModel.findOne({ code: codePlan }).lean().exec();
    if (!plan) throw new BadRequestException('Plan inconnu');
    const prix = periodicite === 'annuel' ? plan.prixAnnuel : plan.prixMensuel;
    if (!prix || prix <= 0) {
      throw new BadRequestException(
        periodicite === 'annuel' ? "Ce plan ne se paie pas à l'année" : 'Ce plan ne se paie pas au mois',
      );
    }
    return { prix, nomPlan: plan.nom };
  }

  private async nomUtilisateur(userId: string, centreId: string) {
    const user = await this.userModel.findOne({ _id: userId, centreId }).select('nom').lean().exec();
    return user?.nom ?? '';
  }

  /** Adresse du site (pour revenir de la page de paiement par carte) */
  private urlDuSite() {
    const configuree = this.config.get<string>('FRONTEND_URL');
    if (configuree) return configuree.replace(/\/+$/, '');
    const premiereOrigine = (this.config.get<string>('CORS_ORIGINS') ?? '').split(',')[0]?.trim();
    return (premiereOrigine || 'http://localhost:3001').replace(/\/+$/, '');
  }

  /** Paiement Mobile Money dans l'application : l'admin valide avec son code PIN sur son téléphone */
  async payerParMobile(
    centreId: string,
    userId: string,
    dto: { plan: string; periodicite: Periodicite; telephone: string; factures?: number; comptes?: number },
  ) {
    const telephone = normaliserTelephone(dto.telephone);
    if (!telephone) {
      throw new BadRequestException('Numéro de téléphone invalide (exemple : 6 90 00 00 00)');
    }
    const centre = await this.trouverCentre(centreId);
    const { prix, nomPlan, factures, comptes } = await this.prixAPayer(
      dto.plan,
      dto.periodicite,
      dto.factures,
      dto.comptes,
    );

    const paiement = await this.paiementModel.create({
      centreId,
      plan: dto.plan,
      periodicite: dto.periodicite,
      montant: prix,
      factures,
      comptes,
      moyen: 'mobile',
      telephone,
      payeParId: new Types.ObjectId(userId),
      payeParNom: await this.nomUtilisateur(userId, centreId),
    });

    try {
      const demande = await this.campay.demanderPaiementMobile({
        montant: prix,
        telephone,
        description: this.description(nomPlan, dto.periodicite, centre.nom),
        referenceExterne: String(paiement._id),
      });
      paiement.referenceCampay = demande.reference;
      paiement.operateur = demande.operateur;
      await paiement.save();
      return {
        id: String(paiement._id),
        statut: paiement.statut,
        montant: prix,
        ussdCode: demande.ussdCode ?? null,
        operateur: demande.operateur ?? null,
      };
    } catch (erreur) {
      paiement.statut = StatutPaiementAbonnement.ECHOUE;
      paiement.raisonEchec = erreur instanceof Error ? erreur.message : 'Demande refusée';
      await paiement.save();
      throw erreur;
    }
  }

  /** Paiement par carte : on renvoie le lien vers la page de paiement de CamPay */
  async payerParCarte(
    centreId: string,
    userId: string,
    email: string | undefined,
    dto: { plan: string; periodicite: Periodicite; factures?: number; comptes?: number },
  ) {
    const centre = await this.trouverCentre(centreId);
    const { prix, nomPlan, factures, comptes } = await this.prixAPayer(
      dto.plan,
      dto.periodicite,
      dto.factures,
      dto.comptes,
    );

    const paiement = await this.paiementModel.create({
      centreId,
      plan: dto.plan,
      periodicite: dto.periodicite,
      montant: prix,
      factures,
      comptes,
      moyen: 'carte',
      payeParId: new Types.ObjectId(userId),
      payeParNom: await this.nomUtilisateur(userId, centreId),
    });

    const retour = `${this.urlDuSite()}/abonnement?paiement=${paiement._id}`;
    try {
      const { lien, reference } = await this.campay.creerLienPaiementCarte({
        montant: prix,
        description: this.description(nomPlan, dto.periodicite, centre.nom),
        referenceExterne: String(paiement._id),
        urlRetour: retour,
        urlEchec: `${retour}&echec=1`,
        email,
      });
      if (reference) {
        paiement.referenceCampay = reference;
        await paiement.save();
      }
      return { id: String(paiement._id), lien };
    } catch (erreur) {
      paiement.statut = StatutPaiementAbonnement.ECHOUE;
      paiement.raisonEchec = erreur instanceof Error ? erreur.message : 'Demande refusée';
      await paiement.save();
      throw erreur;
    }
  }

  /** L'application demande où en est un paiement (toutes les quelques secondes pendant l'attente) */
  async suivrePaiement(centreId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Paiement introuvable');
    const paiement = await this.paiementModel.findOne({ _id: id, centreId }).exec();
    if (!paiement) throw new NotFoundException('Paiement introuvable');

    if (paiement.statut === StatutPaiementAbonnement.EN_ATTENTE && paiement.referenceCampay) {
      const transaction = await this.campay.etatTransaction(paiement.referenceCampay);
      if (transaction) await this.mettreAJour(paiement, transaction);
    }
    const aJour = await this.paiementModel.findOne({ _id: id, centreId }).lean().exec();
    return this.formaterPaiement(aJour as unknown as PaiementLisible);
  }

  /**
   * Notification envoyée par CamPay quand une transaction réussit ou échoue.
   * On ne croit pas la notification sur parole : on redemande l'état à CamPay.
   */
  async traiterNotification(donnees: Record<string, unknown>) {
    if (!this.campay.signatureValide(typeof donnees.signature === 'string' ? donnees.signature : undefined)) {
      this.logger.warn('Notification CamPay avec une signature invalide : ignorée');
      return { recu: false };
    }

    const reference = typeof donnees.reference === 'string' ? donnees.reference : '';
    const referenceExterne =
      typeof donnees.external_reference === 'string' ? donnees.external_reference : '';

    const conditions: Record<string, unknown>[] = [];
    if (reference) conditions.push({ referenceCampay: reference });
    if (Types.ObjectId.isValid(referenceExterne)) conditions.push({ _id: referenceExterne });
    if (conditions.length === 0) return { recu: false };

    const paiement = await this.paiementModel
      .findOne({ $or: conditions })
      .setOptions({ sansCentre: true })
      .exec();
    if (!paiement) return { recu: false };

    if (!paiement.referenceCampay && reference) {
      paiement.referenceCampay = reference;
      await paiement.save();
    }
    const transaction = paiement.referenceCampay
      ? await this.campay.etatTransaction(paiement.referenceCampay)
      : null;
    if (transaction) await this.mettreAJour(paiement, transaction);
    return { recu: true };
  }

  /** Applique la réponse de CamPay : paiement réussi → l'abonnement est prolongé */
  private async mettreAJour(paiement: PaiementAbonnementDocument, transaction: TransactionCampay) {
    const centreId = String(paiement.centreId);

    if (transaction.status === 'FAILED') {
      await this.paiementModel.updateOne(
        { _id: paiement._id, centreId, statut: StatutPaiementAbonnement.EN_ATTENTE },
        { statut: StatutPaiementAbonnement.ECHOUE, raisonEchec: transaction.reason || 'Paiement refusé ou annulé' },
      );
      return;
    }
    if (transaction.status !== 'SUCCESSFUL') return;

    // CamPay doit avoir reçu au moins le montant demandé
    if (Number(transaction.amount ?? 0) < paiement.montant) {
      await this.paiementModel.updateOne(
        { _id: paiement._id, centreId, statut: StatutPaiementAbonnement.EN_ATTENTE },
        { statut: StatutPaiementAbonnement.ECHOUE, raisonEchec: 'Montant reçu incorrect' },
      );
      this.logger.warn(`Paiement ${paiement._id} : montant reçu ${transaction.amount} au lieu de ${paiement.montant}`);
      return;
    }

    // Une seule fois, même si CamPay et l'application le signalent en même temps
    const confirme = await this.paiementModel
      .findOneAndUpdate(
        { _id: paiement._id, centreId, statut: { $ne: StatutPaiementAbonnement.REUSSI } },
        {
          statut: StatutPaiementAbonnement.REUSSI,
          operateur: transaction.operator ?? paiement.operateur,
          dateConfirmation: new Date(),
          raisonEchec: null,
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!confirme) return;

    const centre = await this.trouverCentre(centreId);
    const maintenant = new Date();
    // Même plan encore payé : on prolonge à partir de la fin actuelle.
    // Changement de plan : la nouvelle période commence aujourd'hui.
    const debut =
      centre.plan === confirme.plan && centre.finAbonnement && centre.finAbonnement > maintenant
        ? new Date(centre.finAbonnement)
        : maintenant;
    const fin = ajouterMois(debut, confirme.periodicite === 'annuel' ? 12 : 1);

    centre.plan = confirme.plan;
    centre.periodicite = confirme.periodicite;
    centre.finAbonnement = fin;
    // Un paiement pendant une offre remplace l'offre (le centre a choisi son plan)
    centre.offre = undefined;
    // Sur mesure payé : les factures et comptes achetés deviennent les limites du centre
    if (confirme.plan === PLAN_SUR_MESURE && confirme.factures && confirme.comptes) {
      centre.surMesure = {
        factures: confirme.factures,
        comptes: confirme.comptes,
        ...(confirme.periodicite === 'annuel'
          ? { prixAnnuel: confirme.montant, prixMensuel: Math.round(confirme.montant / MOIS_PAYES_PAR_AN) }
          : { prixMensuel: confirme.montant, prixAnnuel: confirme.montant * MOIS_PAYES_PAR_AN }),
      };
    }
    await centre.save();

    await this.paiementModel.updateOne({ _id: confirme._id, centreId }, { debutPeriode: debut, finPeriode: fin });
    this.logger.log(`Abonnement ${confirme.plan} payé pour le centre ${centreId} jusqu'au ${fin.toISOString()}`);
  }

  private description(nomPlan: string, periodicite: Periodicite, nomCentre: string) {
    return `Abonnement ${nomPlan} ${periodicite === 'annuel' ? '1 an' : '1 mois'} - ${nomCentre}`.slice(0, 100);
  }

  formaterPaiement(p: PaiementLisible) {
    return {
      id: String(p._id),
      plan: p.plan,
      periodicite: p.periodicite,
      montant: p.montant,
      moyen: p.moyen,
      statut: p.statut,
      operateur: p.operateur ?? null,
      raisonEchec: p.raisonEchec ?? null,
      payeParNom: p.payeParNom ?? '',
      date: p.createdAt ?? null,
      dateConfirmation: p.dateConfirmation ?? null,
      finPeriode: p.finPeriode ?? null,
      factures: p.factures ?? null,
      comptes: p.comptes ?? null,
    };
  }
}