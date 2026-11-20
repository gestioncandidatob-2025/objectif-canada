import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CampayService, TransactionCampay } from '../abonnements/campay.service';
import { AbonnementsService } from '../abonnements/abonnements.service';
import { normaliserTelephone } from '../abonnements/plans';
import { InscriptionsService } from '../inscriptions/inscriptions.service';
import { CreateInscriptionDto } from '../inscriptions/dto/create-inscription.dto';
import { ModePaiement } from '../inscriptions/schemas/inscription.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Role, User, UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import {
  PaiementMobile,
  PaiementMobileDocument,
  StatutPaiementMobile,
  TypePaiementMobile,
} from './schemas/paiement-mobile.schema';
import {
  RetraitMobile,
  RetraitMobileDocument,
  STATUTS_RETRAIT_COMPTES,
  StatutRetrait,
} from './schemas/retrait-mobile.schema';
import { ReglageMobile, ReglageMobileDocument } from './schemas/reglage-mobile.schema';
import {
  DemanderRetraitDto,
  ModifierReglagesMobileDto,
  PayerFactureMobileDto,
  PayerResteMobileDto,
} from './dto/paiement-mobile.dto';

const montantLisible = (valeur: number) => `${Math.round(valeur).toLocaleString('fr-FR')} FCFA`;

/**
 * Paiement des candidats avec CamPay, et retraits des centres.
 *
 * 1. La secrétaire lance le paiement : le candidat reçoit une demande de code
 *    PIN sur son téléphone. Rien n'est enregistré dans les factures à ce moment.
 * 2. CamPay confirme (notification, ou l'application qui redemande) :
 *    - nouvelle facture : elle est créée, en mode « CamPay » ;
 *    - reste à payer : il est ajouté à la facture.
 * 3. L'argent est sur le compte CamPay de HREFF. Il compte dans le solde du
 *    centre, moins les frais CamPay (et la commission HREFF, 0 % par défaut).
 * 4. L'administrateur du centre demande un retrait ; le super admin le valide ;
 *    CamPay envoie l'argent sur le numéro du centre.
 */
@Injectable()
export class PaiementsMobilesService {
  private readonly logger = new Logger(PaiementsMobilesService.name);

  constructor(
    @InjectModel(PaiementMobile.name) private paiementModel: Model<PaiementMobileDocument>,
    @InjectModel(RetraitMobile.name) private retraitModel: Model<RetraitMobileDocument>,
    @InjectModel(ReglageMobile.name) private reglageModel: Model<ReglageMobileDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly campay: CampayService,
    private readonly abonnementsService: AbonnementsService,
    private readonly inscriptionsService: InscriptionsService,
    private readonly mailService: MailService,
  ) {}

  // ---------- Réglages (super admin) ----------

  async reglages() {
    const existant = await this.reglageModel.findOne({ cle: 'principal' }).lean().exec();
    if (existant) return existant;
    return (await this.reglageModel.create({ cle: 'principal' })).toObject();
  }

  async modifierReglages(dto: ModifierReglagesMobileDto) {
    await this.reglages();
    return this.reglageModel
      .findOneAndUpdate({ cle: 'principal' }, { $set: dto }, { returnDocument: 'after' })
      .lean()
      .exec();
  }

  // ---------- 1. Lancer un paiement ----------

  /** Nouvelle facture : on vérifie tout avant de demander l'argent au candidat */
  async payerNouvelleFacture(centreId: string, utilisateurId: string, dto: PayerFactureMobileDto) {
    const telephone = this.telephoneValide(dto.telephone);
    await this.abonnementsService.verifierPeutCreerFacture(centreId);

    // Les informations de la facture, sans le numéro de téléphone du paiement
    const informations: Record<string, unknown> = { ...dto };
    delete informations.telephone;
    const donneesFacture = { ...informations, modePaiement: ModePaiement.CAMPAY } as unknown as CreateInscriptionDto;
    // Mêmes vérifications qu'une facture normale (candidat, offre, régime, montant minimum…)
    const { candidat, montantPaye } = await this.inscriptionsService.preparer(donneesFacture, centreId);
    if (montantPaye <= 0) {
      throw new BadRequestException('Indique le montant que le candidat va payer');
    }

    return this.lancer(centreId, utilisateurId, {
      type: TypePaiementMobile.INSCRIPTION,
      montant: montantPaye,
      telephone,
      candidatNom: `${candidat.nom} ${candidat.prenom}`,
      donneesFacture: { ...donneesFacture, montantPaye } as unknown as Record<string, unknown>,
    });
  }

  /** Reste à payer d'une facture existante */
  async payerReste(centreId: string, utilisateurId: string, dto: PayerResteMobileDto) {
    const telephone = this.telephoneValide(dto.telephone);
    const inscription = await this.inscriptionModel
      .findOne({ _id: dto.inscriptionId, centreId })
      .populate({ path: 'candidatId', match: { centreId }, select: 'nom prenom' })
      .exec();
    if (!inscription) throw new NotFoundException('Facture introuvable');
    if (dto.montant > inscription.resteAPayer) {
      throw new BadRequestException('Ce paiement dépasserait le montant total dû');
    }
    await this.verifierCampayActive(centreId);

    const candidat = inscription.candidatId as unknown as { nom?: string; prenom?: string } | null;
    return this.lancer(centreId, utilisateurId, {
      type: TypePaiementMobile.RESTE,
      montant: dto.montant,
      telephone,
      candidatNom: candidat ? `${candidat.nom ?? ''} ${candidat.prenom ?? ''}`.trim() : undefined,
      inscriptionId: inscription._id,
    });
  }

  private async lancer(
    centreId: string,
    utilisateurId: string,
    params: {
      type: TypePaiementMobile;
      montant: number;
      telephone: string;
      candidatNom?: string;
      donneesFacture?: Record<string, unknown>;
      inscriptionId?: Types.ObjectId;
    },
  ) {
    const centre = await this.centreModel.findById(centreId).select('nom').exec();
    const utilisateur = await this.userModel
      .findOne({ _id: utilisateurId, centreId })
      .select('nom')
      .exec();

    const paiement = await this.paiementModel.create({
      centreId,
      ...params,
      lanceParId: new Types.ObjectId(utilisateurId),
      lanceParNom: utilisateur?.nom,
    });

    try {
      const demande = await this.campay.demanderPaiementMobile({
        montant: params.montant,
        telephone: params.telephone,
        description: `${centre?.nom ?? 'Paiement'} — ${params.candidatNom ?? 'candidat'}`.slice(0, 100),
        referenceExterne: String(paiement._id),
      });
      paiement.referenceCampay = demande.reference;
      paiement.operateur = demande.operateur;
      await paiement.save();
      return {
        id: String(paiement._id),
        statut: paiement.statut,
        montant: paiement.montant,
        ussdCode: demande.ussdCode ?? null,
        operateur: demande.operateur ?? null,
      };
    } catch (erreur) {
      paiement.statut = StatutPaiementMobile.ECHOUE;
      paiement.raisonEchec = erreur instanceof Error ? erreur.message : 'Demande refusée';
      await paiement.save();
      throw erreur;
    }
  }

  // ---------- 2. Suivre et confirmer ----------

  /** L'application redemande où en est le paiement pendant l'attente */
  async suivre(centreId: string, id: string) {
    const paiement = await this.trouverPaiement(centreId, id);
    if (paiement.statut === StatutPaiementMobile.EN_ATTENTE && paiement.referenceCampay) {
      const transaction = await this.campay.etatTransaction(paiement.referenceCampay);
      if (transaction) await this.appliquer(paiement, transaction);
    }
    const aJour = await this.trouverPaiement(centreId, id);
    return {
      id: String(aJour._id),
      type: aJour.type,
      statut: aJour.statut,
      montant: aJour.montant,
      raisonEchec: aJour.raisonEchec ?? null,
      inscriptionId: aJour.inscriptionId ? String(aJour.inscriptionId) : null,
      erreurFacture: aJour.erreurFacture ?? null,
    };
  }

  /**
   * Notification de CamPay (paiement d'un candidat ou retrait). Renvoie false
   * si la référence ne correspond à rien ici.
   */
  async traiterNotification(donnees: Record<string, unknown>): Promise<boolean> {
    const reference = typeof donnees.reference === 'string' ? donnees.reference : '';
    const referenceExterne =
      typeof donnees.external_reference === 'string' ? donnees.external_reference : '';
    const conditions: Record<string, unknown>[] = [];
    if (reference) conditions.push({ referenceCampay: reference });
    if (Types.ObjectId.isValid(referenceExterne)) conditions.push({ _id: referenceExterne });
    if (conditions.length === 0) return false;

    const paiement = await this.paiementModel
      .findOne({ $or: conditions })
      .setOptions({ sansCentre: true })
      .exec();
    if (paiement) {
      if (!paiement.referenceCampay && reference) {
        paiement.referenceCampay = reference;
        await paiement.save();
      }
      const transaction = paiement.referenceCampay
        ? await this.campay.etatTransaction(paiement.referenceCampay)
        : null;
      if (transaction) await this.appliquer(paiement, transaction);
      return true;
    }

    const retrait = await this.retraitModel
      .findOne({ $or: conditions })
      .setOptions({ sansCentre: true })
      .exec();
    if (retrait) {
      await this.actualiserRetrait(retrait);
      return true;
    }
    return false;
  }

  /** Applique la réponse de CamPay. Le paiement n'est confirmé qu'une seule fois. */
  private async appliquer(paiement: PaiementMobileDocument, transaction: TransactionCampay) {
    const centreId = String(paiement.centreId);

    if (transaction.status === 'FAILED') {
      await this.paiementModel.updateOne(
        { _id: paiement._id, centreId, statut: StatutPaiementMobile.EN_ATTENTE },
        { statut: StatutPaiementMobile.ECHOUE, raisonEchec: transaction.reason || 'Paiement refusé ou annulé' },
      );
      return;
    }
    if (transaction.status !== 'SUCCESSFUL') return;

    if (Number(transaction.amount ?? 0) < paiement.montant) {
      await this.paiementModel.updateOne(
        { _id: paiement._id, centreId, statut: StatutPaiementMobile.EN_ATTENTE },
        { statut: StatutPaiementMobile.ECHOUE, raisonEchec: 'Montant reçu incorrect' },
      );
      this.logger.warn(`Paiement ${paiement._id} : reçu ${transaction.amount} au lieu de ${paiement.montant}`);
      return;
    }

    const reglages = await this.reglages();
    const frais = Math.round((paiement.montant * (reglages.tauxFraisCampay ?? 0)) / 100);
    const commission = Math.round((paiement.montant * (reglages.tauxCommission ?? 0)) / 100);

    const confirme = await this.paiementModel
      .findOneAndUpdate(
        { _id: paiement._id, centreId, statut: StatutPaiementMobile.EN_ATTENTE },
        {
          statut: StatutPaiementMobile.REUSSI,
          operateur: transaction.operator ?? paiement.operateur,
          dateConfirmation: new Date(),
          frais,
          commission,
          net: paiement.montant - frais - commission,
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!confirme) return;

    // L'argent est reçu : on crée ou on complète la facture
    const utilisateurId = confirme.lanceParId ? String(confirme.lanceParId) : undefined;
    try {
      if (confirme.type === TypePaiementMobile.INSCRIPTION) {
        const facture = await this.inscriptionsService.create(
          confirme.donneesFacture as unknown as CreateInscriptionDto,
          centreId,
          utilisateurId,
        );
        await this.paiementModel.updateOne({ _id: confirme._id, centreId }, { inscriptionId: facture._id });
      } else if (confirme.inscriptionId) {
        await this.inscriptionsService.ajouterPaiement(
          String(confirme.inscriptionId),
          confirme.montant,
          ModePaiement.CAMPAY,
          centreId,
          utilisateurId,
        );
      }
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : 'Erreur inconnue';
      this.logger.error(`Paiement ${confirme._id} reçu mais facture non enregistrée : ${message}`);
      await this.paiementModel.updateOne({ _id: confirme._id, centreId }, { erreurFacture: message });
    }
  }

  // ---------- 3. Solde du centre (administrateur) ----------

  async portefeuille(centreId: string) {
    const idCentre = new Types.ObjectId(centreId);
    const [totaux] = await this.paiementModel
      .aggregate<{ brut: number; frais: number; commission: number; net: number; nombre: number }>([
        { $match: { centreId: idCentre, statut: StatutPaiementMobile.REUSSI } },
        {
          $group: {
            _id: null,
            brut: { $sum: '$montant' },
            frais: { $sum: '$frais' },
            commission: { $sum: '$commission' },
            net: { $sum: '$net' },
            nombre: { $sum: 1 },
          },
        },
      ])
      .exec();
    const retraits = await this.retraitModel
      .aggregate<{ _id: StatutRetrait; total: number }>([
        { $match: { centreId: idCentre } },
        { $group: { _id: '$statut', total: { $sum: '$montant' } } },
      ])
      .exec();
    const totalRetraits = (statut: StatutRetrait) => retraits.find((r) => r._id === statut)?.total ?? 0;

    const net = totaux?.net ?? 0;
    const retire = totalRetraits(StatutRetrait.ENVOYE);
    const enCours = totalRetraits(StatutRetrait.DEMANDE) + totalRetraits(StatutRetrait.EN_COURS);

    const [paiements, demandes, reglages] = await Promise.all([
      this.paiementModel
        .find({ centreId, statut: { $ne: StatutPaiementMobile.EN_ATTENTE } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec(),
      this.retraitModel.find({ centreId }).sort({ createdAt: -1 }).limit(50).lean().exec(),
      this.reglages(),
    ]);

    return {
      brut: totaux?.brut ?? 0,
      frais: totaux?.frais ?? 0,
      commission: totaux?.commission ?? 0,
      net,
      nombrePaiements: totaux?.nombre ?? 0,
      retire,
      enCours,
      solde: net - retire - enCours,
      retraitMinimum: reglages.retraitMinimum ?? 1000,
      paiements: paiements.map((p) => ({
        id: String(p._id),
        date: p.dateConfirmation ?? (p as unknown as { createdAt: Date }).createdAt,
        type: p.type,
        candidatNom: p.candidatNom ?? null,
        montant: p.montant,
        frais: p.frais + p.commission,
        net: p.net,
        statut: p.statut,
        raisonEchec: p.raisonEchec ?? null,
        erreurFacture: p.erreurFacture ?? null,
        lanceParNom: p.lanceParNom ?? null,
      })),
      retraits: demandes.map((r) => this.formaterRetrait(r)),
    };
  }

  // ---------- 4. Retraits ----------

  async demanderRetrait(centreId: string, utilisateurId: string, dto: DemanderRetraitDto) {
    const telephone = this.telephoneValide(dto.telephone);
    const montant = Math.floor(dto.montant);
    const { solde, retraitMinimum } = await this.portefeuille(centreId);
    if (montant < retraitMinimum) {
      throw new BadRequestException(`Le retrait minimum est de ${montantLisible(retraitMinimum)}`);
    }
    if (montant > solde) {
      throw new BadRequestException(`Solde insuffisant : tu peux retirer au plus ${montantLisible(solde)}`);
    }

    const utilisateur = await this.userModel.findOne({ _id: utilisateurId, centreId }).select('nom').exec();
    const retrait = await this.retraitModel.create({
      centreId,
      montant,
      telephone,
      demandeParId: new Types.ObjectId(utilisateurId),
      demandeParNom: utilisateur?.nom,
    });

    // Prévenir l'équipe HREFF qu'un retrait attend sa validation
    const centre = await this.centreModel.findById(centreId).select('nom').exec();
    const superAdmins = await this.userModel
      .find({ role: Role.SUPER_ADMIN })
      .setOptions({ sansCentre: true })
      .select('email')
      .exec();
    const emails = superAdmins.map((u) => u.email).filter(Boolean);
    if (emails.length > 0) {
      await this.mailService.envoyer({
        to: emails,
        subject: `Retrait à valider — ${centre?.nom ?? 'Centre'} : ${montantLisible(montant)}`,
        htmlContent: `<p><strong>${centre?.nom ?? 'Un centre'}</strong> demande un retrait de <strong>${montantLisible(montant)}</strong> vers le ${telephone}.</p><p>Valide-le dans l'espace super admin, page Mobile Money.</p>`,
      });
    }
    return this.formaterRetrait(retrait.toObject());
  }

  /** Super admin : toutes les demandes, les plus récentes d'abord */
  async listeRetraits(statut?: string) {
    const filtre: Record<string, unknown> = {};
    if (statut && (Object.values(StatutRetrait) as string[]).includes(statut)) filtre.statut = statut;

    // Les retraits en cours chez CamPay sont redemandés à chaque affichage
    const enCours = await this.retraitModel
      .find({ statut: StatutRetrait.EN_COURS })
      .setOptions({ sansCentre: true })
      .exec();
    for (const retrait of enCours) await this.actualiserRetrait(retrait);

    const retraits = await this.retraitModel
      .find(filtre)
      .setOptions({ sansCentre: true })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
      .exec();
    const noms = await this.nomsDesCentres(retraits.map((r) => r.centreId));
    return retraits.map((r) => ({ ...this.formaterRetrait(r), centre: noms.get(String(r.centreId)) ?? '—' }));
  }

  /** Super admin valide : CamPay envoie l'argent tout de suite */
  async validerRetrait(id: string, superAdminId: string) {
    const retrait = await this.trouverRetrait(id);
    // Un seul envoi, même si on clique deux fois
    const pris = await this.retraitModel
      .findOneAndUpdate(
        { _id: retrait._id, centreId: retrait.centreId, statut: StatutRetrait.DEMANDE },
        {
          statut: StatutRetrait.EN_COURS,
          traiteParNom: await this.nomSuperAdmin(superAdminId),
          traiteLe: new Date(),
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!pris) throw new BadRequestException('Ce retrait a déjà été traité');

    const centre = await this.centreModel.findById(pris.centreId).select('nom').exec();
    try {
      const envoi = await this.campay.envoyerVersMobile({
        montant: pris.montant,
        telephone: pris.telephone,
        description: `Retrait ${centre?.nom ?? ''}`.trim().slice(0, 100),
        referenceExterne: String(pris._id),
      });
      pris.referenceCampay = envoi.reference;
      await pris.save();
      await this.actualiserRetrait(pris);
    } catch (erreur) {
      pris.statut = StatutRetrait.ECHOUE;
      pris.raison = erreur instanceof Error ? erreur.message : 'Envoi refusé par CamPay';
      await pris.save();
    }
    const aJour = await this.trouverRetrait(id);
    return { ...this.formaterRetrait(aJour.toObject()), centre: centre?.nom ?? '—' };
  }

  async refuserRetrait(id: string, superAdminId: string, raison?: string) {
    const retrait = await this.trouverRetrait(id);
    const refuse = await this.retraitModel
      .findOneAndUpdate(
        { _id: retrait._id, centreId: retrait.centreId, statut: StatutRetrait.DEMANDE },
        {
          statut: StatutRetrait.REFUSE,
          raison: raison?.trim() || 'Refusé par HREFF',
          traiteParNom: await this.nomSuperAdmin(superAdminId),
          traiteLe: new Date(),
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!refuse) throw new BadRequestException('Ce retrait a déjà été traité');
    return this.formaterRetrait(refuse);
  }

  /** Redemande à CamPay où en est un envoi */
  private async actualiserRetrait(retrait: RetraitMobileDocument) {
    if (retrait.statut !== StatutRetrait.EN_COURS || !retrait.referenceCampay) return;
    const transaction = await this.campay.etatTransaction(retrait.referenceCampay);
    if (!transaction) return;
    if (transaction.status === 'SUCCESSFUL') {
      await this.retraitModel.updateOne(
        { _id: retrait._id, centreId: retrait.centreId, statut: StatutRetrait.EN_COURS },
        { statut: StatutRetrait.ENVOYE, dateEnvoi: new Date() },
      );
    } else if (transaction.status === 'FAILED') {
      await this.retraitModel.updateOne(
        { _id: retrait._id, centreId: retrait.centreId, statut: StatutRetrait.EN_COURS },
        { statut: StatutRetrait.ECHOUE, raison: transaction.reason || 'Envoi refusé par CamPay' },
      );
    }
  }

  // ---------- 5. Vue d'ensemble (super admin) ----------

  async vueEnsemble() {
    const parCentre = await this.paiementModel
      .aggregate<{ _id: Types.ObjectId; brut: number; frais: number; commission: number; net: number; nombre: number }>([
        // Toute la plateforme : pas de filtre par centre (réservé au super admin)
        { $match: { statut: StatutPaiementMobile.REUSSI } },
        {
          $group: {
            _id: '$centreId',
            brut: { $sum: '$montant' },
            frais: { $sum: '$frais' },
            commission: { $sum: '$commission' },
            net: { $sum: '$net' },
            nombre: { $sum: 1 },
          },
        },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .option({ sansCentre: true } as any)
      .exec();
    const retraitsParCentre = await this.retraitModel
      .aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { statut: { $in: STATUTS_RETRAIT_COMPTES } } },
        { $group: { _id: '$centreId', total: { $sum: '$montant' } } },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .option({ sansCentre: true } as any)
      .exec();

    const noms = await this.nomsDesCentres(parCentre.map((c) => c._id));
    const centres = parCentre
      .map((c) => {
        const retire = retraitsParCentre.find((r) => String(r._id) === String(c._id))?.total ?? 0;
        return {
          centreId: String(c._id),
          centre: noms.get(String(c._id)) ?? '—',
          brut: c.brut,
          frais: c.frais,
          commission: c.commission,
          net: c.net,
          nombre: c.nombre,
          retire,
          solde: c.net - retire,
        };
      })
      .sort((a, b) => b.solde - a.solde);

    const somme = (cle: 'brut' | 'frais' | 'commission' | 'net' | 'retire' | 'solde') =>
      centres.reduce((total, c) => total + c[cle], 0);

    return {
      totaux: {
        brut: somme('brut'),
        frais: somme('frais'),
        commission: somme('commission'),
        net: somme('net'),
        retire: somme('retire'),
        // Ce que HREFF doit encore aux centres
        soldeDu: somme('solde'),
      },
      // Solde réel du compte CamPay, pour vérifier qu'il couvre ce qui est dû
      soldeCampay: await this.campay.solde(),
      centres,
      reglages: await this.reglages(),
    };
  }

  // ---------- Outils ----------

  /** Une notification doit être signée par CamPay */
  signatureValide(signature?: string) {
    return this.campay.signatureValide(signature);
  }

  private telephoneValide(telephone: string) {
    const numero = normaliserTelephone(telephone);
    if (!numero) throw new BadRequestException('Numéro de téléphone invalide (exemple : 6 90 00 00 00)');
    return numero;
  }

  private async verifierCampayActive(centreId: string) {
    const centre = await this.centreModel.findById(centreId).select('modesPaiement').exec();
    if (!centre?.modesPaiement?.includes(ModePaiement.CAMPAY)) {
      throw new ForbiddenException(
        "Le paiement CamPay n'est pas activé pour ce centre (voir Paramètres → Paiements)",
      );
    }
  }

  private async trouverPaiement(centreId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Paiement introuvable');
    const paiement = await this.paiementModel.findOne({ _id: id, centreId }).exec();
    if (!paiement) throw new NotFoundException('Paiement introuvable');
    return paiement;
  }

  private async trouverRetrait(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Retrait introuvable');
    const retrait = await this.retraitModel.findOne({ _id: id }).setOptions({ sansCentre: true }).exec();
    if (!retrait) throw new NotFoundException('Retrait introuvable');
    return retrait;
  }

  private async nomsDesCentres(ids: Types.ObjectId[]) {
    const centres = await this.centreModel
      .find({ _id: { $in: ids } })
      .select('nom')
      .lean()
      .exec();
    return new Map(centres.map((c) => [String(c._id), c.nom]));
  }

  private async nomSuperAdmin(id: string) {
    const user = await this.userModel.findOne({ _id: id }).setOptions({ sansCentre: true }).select('nom').exec();
    return user?.nom ?? 'HREFF';
  }

  private formaterRetrait(r: Partial<RetraitMobile> & { _id?: unknown; createdAt?: Date }) {
    return {
      id: String(r._id),
      montant: r.montant ?? 0,
      telephone: r.telephone ?? '',
      statut: r.statut,
      demandeParNom: r.demandeParNom ?? null,
      traiteParNom: r.traiteParNom ?? null,
      raison: r.raison ?? null,
      date: r.createdAt ?? null,
      dateEnvoi: r.dateEnvoi ?? null,
    };
  }
}