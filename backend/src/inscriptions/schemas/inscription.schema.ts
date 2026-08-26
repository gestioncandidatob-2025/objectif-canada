import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InscriptionDocument = HydratedDocument<Inscription>;

export enum ModePaiement {
  ORANGE_MONEY = 'orange_money',
  MOBILE_MONEY = 'mobile_money',
  ESPECES = 'especes',
  MOBILE_ESPECES = 'mobile_especes',
}

@Schema({ timestamps: true })
export class Inscription {
  @Prop({ type: Types.ObjectId, ref: 'Candidat', required: true })
  candidatId!: Types.ObjectId;

  // Nom du service tel que défini dans /tarifs (libre, plus limité à un enum figé).
  @Prop({ required: true })
  service!: string;

  @Prop()
  regime?: string;

  @Prop({ required: true })
  dateInscription!: Date;

  @Prop()
  dateDebutTest?: Date;

  @Prop({ required: true })
  dateFin!: Date;

 @Prop({ required: true })
  montantTotal!: number;

  @Prop({ default: 0 })
  remise!: number;

  @Prop({ default: 0 })
  montantPaye!: number;

  @Prop({ required: true })
  resteAPayer!: number;

  @Prop({ type: String, enum: ModePaiement, required: true })
  modePaiement!: ModePaiement;

  @Prop()
  montantMobile?: number;

  @Prop()
  montantEspeces?: number;

  @Prop({ required: true })
  facturePar!: string;

  @Prop()
  reference?: string;

  @Prop({ required: true, unique: true })
  numeroRecu!: string;

  // Empêche d'envoyer plusieurs fois la notification "formation terminée"
  @Prop({ default: false })
  formationTermineeNotifiee!: boolean;
}

export const InscriptionSchema = SchemaFactory.createForClass(Inscription);