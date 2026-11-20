import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type RetraitMobileDocument = HydratedDocument<RetraitMobile>;

/**
 * - demande  : l'administrateur du centre a demandé le retrait
 * - en_cours : validé par le super admin, CamPay est en train d'envoyer
 * - envoye   : l'argent est arrivé sur le numéro du centre
 * - refuse   : refusé par le super admin (le montant revient dans le solde)
 * - echoue   : CamPay n'a pas pu envoyer (le montant revient dans le solde)
 */
export enum StatutRetrait {
  DEMANDE = 'demande',
  EN_COURS = 'en_cours',
  ENVOYE = 'envoye',
  REFUSE = 'refuse',
  ECHOUE = 'echoue',
}

/** Statuts qui retirent le montant du solde du centre */
export const STATUTS_RETRAIT_COMPTES = [StatutRetrait.DEMANDE, StatutRetrait.EN_COURS, StatutRetrait.ENVOYE];

/** Un retrait d'argent du solde CamPay d'un centre vers son numéro MTN ou Orange */
@Schema({ timestamps: true, collection: 'retraitsmobiles' })
export class RetraitMobile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  @Prop({ required: true })
  montant!: number;

  // Numéro qui reçoit l'argent (format 2376XXXXXXXX)
  @Prop({ required: true })
  telephone!: string;

  @Prop({ type: String, enum: StatutRetrait, default: StatutRetrait.DEMANDE, index: true })
  statut!: StatutRetrait;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  demandeParId?: Types.ObjectId;

  @Prop()
  demandeParNom?: string;

  // Super admin qui a validé ou refusé
  @Prop()
  traiteParNom?: string;

  @Prop()
  traiteLe?: Date;

  // Raison d'un refus ou d'un échec
  @Prop()
  raison?: string;

  @Prop({ index: true })
  referenceCampay?: string;

  @Prop()
  dateEnvoi?: Date;
}

export const RetraitMobileSchema = SchemaFactory.createForClass(RetraitMobile);
RetraitMobileSchema.index({ centreId: 1, createdAt: -1 });
RetraitMobileSchema.plugin(centrePlugin);