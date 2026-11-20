import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type PaiementMobileDocument = HydratedDocument<PaiementMobile>;

export enum StatutPaiementMobile {
  EN_ATTENTE = 'en_attente',
  REUSSI = 'reussi',
  ECHOUE = 'echoue',
}

/**
 * - inscription : paiement d'une nouvelle facture (la facture est créée
 *   seulement quand CamPay confirme le paiement)
 * - reste       : paiement du reste à payer d'une facture existante
 */
export enum TypePaiementMobile {
  INSCRIPTION = 'inscription',
  RESTE = 'reste',
}

/**
 * Un paiement d'un candidat fait avec CamPay depuis l'application. L'argent
 * arrive sur le compte CamPay de HREFF ; il est compté dans le solde du
 * centre, que l'administrateur retire ensuite (voir RetraitMobile).
 */
@Schema({ timestamps: true, collection: 'paiementsmobiles' })
export class PaiementMobile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  @Prop({ type: String, enum: TypePaiementMobile, required: true })
  type!: TypePaiementMobile;

  // Montant payé par le candidat (ce qui est écrit sur son reçu)
  @Prop({ required: true })
  montant!: number;

  // Calculés quand CamPay confirme le paiement :
  // frais CamPay, commission HREFF, et ce qui revient au centre (net)
  @Prop({ default: 0 })
  frais!: number;

  @Prop({ default: 0 })
  commission!: number;

  @Prop({ default: 0 })
  net!: number;

  // Numéro du candidat (format 2376XXXXXXXX)
  @Prop({ required: true })
  telephone!: string;

  @Prop()
  candidatNom?: string;

  @Prop({ type: String, enum: StatutPaiementMobile, default: StatutPaiementMobile.EN_ATTENTE })
  statut!: StatutPaiementMobile;

  @Prop({ index: true })
  referenceCampay?: string;

  @Prop()
  operateur?: string;

  @Prop()
  raisonEchec?: string;

  @Prop()
  dateConfirmation?: Date;

  // Nouvelle facture : les informations du formulaire, pour créer la facture
  // une fois le paiement réussi
  @Prop({ type: MongooseSchema.Types.Mixed })
  donneesFacture?: Record<string, unknown>;

  // La facture : créée après le paiement (nouvelle facture), ou existante (reste)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Inscription' })
  inscriptionId?: Types.ObjectId;

  // Paiement réussi mais facture impossible à créer ou à mettre à jour :
  // l'argent est bien reçu, l'administrateur doit régulariser à la main
  @Prop()
  erreurFacture?: string;

  // Personne connectée qui a lancé le paiement
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  lanceParId?: Types.ObjectId;

  @Prop()
  lanceParNom?: string;
}

export const PaiementMobileSchema = SchemaFactory.createForClass(PaiementMobile);
PaiementMobileSchema.index({ centreId: 1, statut: 1, createdAt: -1 });
PaiementMobileSchema.plugin(centrePlugin);