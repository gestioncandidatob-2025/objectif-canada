import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type PaiementDocument = HydratedDocument<Paiement>;

/**
 * - inscription : l'argent reçu au moment où la facture est créée (l'avance)
 * - reste       : un reste à payer encaissé plus tard sur la même facture
 * - correction  : un montant payé modifié après coup (peut être négatif)
 */
export enum TypePaiement {
  INSCRIPTION = 'inscription',
  RESTE = 'reste',
  CORRECTION = 'correction',
}

/**
 * Journal des paiements : une ligne pour chaque somme encaissée, avec la
 * personne qui l'a encaissée. C'est ce journal qui alimente le point de
 * caisse. Une ligne n'est jamais modifiée : une erreur se corrige par une
 * nouvelle ligne de type "correction".
 */
@Schema({ timestamps: true })
export class Paiement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Inscription', required: true, index: true })
  inscriptionId!: Types.ObjectId;

  // Copiés au moment du paiement, pour afficher le détail sans recherche
  @Prop()
  numeroRecu?: string;

  @Prop()
  candidatNom?: string;

  @Prop({ type: String, enum: TypePaiement, required: true })
  type!: TypePaiement;

  // Montant total de la ligne = especes + mobile
  @Prop({ required: true })
  montant!: number;

  @Prop({ default: 0 })
  especes!: number;

  @Prop({ default: 0 })
  mobile!: number;

  @Prop()
  modePaiement?: string;

  // Compte qui a encaissé. Absent pour les anciens paiements dont le
  // "Facturé par" ne correspond à aucun compte existant.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  encaisseParId?: Types.ObjectId;

  @Prop({ required: true })
  encaisseParNom!: string;

  @Prop({ required: true })
  date!: Date;
}

export const PaiementSchema = SchemaFactory.createForClass(Paiement);
PaiementSchema.index({ centreId: 1, encaisseParId: 1, date: -1 });
PaiementSchema.plugin(centrePlugin);