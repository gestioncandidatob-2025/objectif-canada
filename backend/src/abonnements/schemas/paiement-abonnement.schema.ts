import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type PaiementAbonnementDocument = HydratedDocument<PaiementAbonnement>;

export enum StatutPaiementAbonnement {
  EN_ATTENTE = 'en_attente',
  REUSSI = 'reussi',
  ECHOUE = 'echoue',
}

/**
 * Un paiement d'abonnement fait par un centre à HREFF, avec CamPay.
 * (Rien à voir avec le journal "paiements" du point de caisse, qui contient
 * l'argent payé par les candidats au centre.)
 */
@Schema({ timestamps: true, collection: 'paiementsabonnements' })
export class PaiementAbonnement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  // Plan acheté et durée
  @Prop({ required: true })
  plan!: string;

  @Prop({ required: true })
  periodicite!: string;

  // Montant demandé, en FCFA (le prix du plan au moment du paiement)
  @Prop({ required: true })
  montant!: number;

  // mobile : demande envoyée sur le téléphone ; carte : page de paiement CamPay
  @Prop({ required: true })
  moyen!: string;

  // Numéro qui paie (paiement mobile), au format 2376XXXXXXXX
  @Prop()
  telephone?: string;

  // Référence de la transaction chez CamPay
  @Prop({ index: true })
  referenceCampay?: string;

  @Prop({
    type: String,
    enum: StatutPaiementAbonnement,
    default: StatutPaiementAbonnement.EN_ATTENTE,
  })
  statut!: StatutPaiementAbonnement;

  // MTN ou ORANGE, renvoyé par CamPay
  @Prop()
  operateur?: string;

  @Prop()
  raisonEchec?: string;

  // Plan Sur mesure : factures par mois et comptes achetés
  @Prop()
  factures?: number;

  @Prop()
  comptes?: number;

  // Qui a lancé le paiement
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  payeParId?: Types.ObjectId;

  @Prop()
  payeParNom?: string;

  @Prop()
  dateConfirmation?: Date;

  // Période d'abonnement achetée (remplie quand le paiement est confirmé)
  @Prop()
  debutPeriode?: Date;

  @Prop()
  finPeriode?: Date;
}

export const PaiementAbonnementSchema = SchemaFactory.createForClass(PaiementAbonnement);
PaiementAbonnementSchema.index({ centreId: 1, createdAt: -1 });
PaiementAbonnementSchema.plugin(centrePlugin);