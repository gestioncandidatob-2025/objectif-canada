import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReglageMobileDocument = HydratedDocument<ReglageMobile>;

/**
 * Réglages du paiement CamPay des candidats, communs à toute la plateforme
 * (un seul document, modifiable par le super admin).
 */
@Schema({ timestamps: true, collection: 'reglagesmobiles' })
export class ReglageMobile {
  // Toujours "principal" : il n'y a qu'un seul document
  @Prop({ required: true, unique: true, default: 'principal' })
  cle!: string;

  // Frais prélevés par CamPay sur chaque paiement, en % (ex : 2.5)
  @Prop({ default: 0 })
  tauxFraisCampay!: number;

  // Commission de HREFF sur chaque paiement, en % (0 = pas de commission)
  @Prop({ default: 0 })
  tauxCommission!: number;

  // Montant minimum d'un retrait, en FCFA
  @Prop({ default: 1000 })
  retraitMinimum!: number;
}

export const ReglageMobileSchema = SchemaFactory.createForClass(ReglageMobile);