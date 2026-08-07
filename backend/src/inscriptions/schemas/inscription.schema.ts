import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InscriptionDocument = HydratedDocument<Inscription>;

export enum Service {
  TCF = 'tcf',
  TCF_2MOIS = 'tcf_2mois',
  EXAMEN_BLANC = 'examen_blanc',
  TCF_SPECIAL = 'tcf_special',
}

export enum Regime {
  JOUR = 'jour',
  SOIR = 'soir',
}

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

  @Prop({ type: String, enum: Service, required: true })
  service!: Service;

  @Prop({ type: String, enum: Regime })
  regime?: Regime;
    
  @Prop({ required: true })
  dateInscription!: Date;

  @Prop()
  dateDebutTest?: Date;
  
  @Prop({ required: true })
  dateFin!: Date;

  @Prop({ required: true })
  montantTotal!: number;

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
}

export const InscriptionSchema = SchemaFactory.createForClass(Inscription);