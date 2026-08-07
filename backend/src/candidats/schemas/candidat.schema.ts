import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class ModificationHistorique {
  @Prop({ required: true })
  raison!: string;

  @Prop({ required: true })
  modifiePar!: string;

  @Prop({ required: true })
  champsModifies!: string;

  @Prop({ default: () => new Date() })
  date!: Date;
}

export const ModificationHistoriqueSchema = SchemaFactory.createForClass(ModificationHistorique);

export type CandidatDocument = HydratedDocument<Candidat>;

@Schema({ timestamps: true })
export class Candidat {
  @Prop({ required: true })
  nom!: string;

  @Prop({ required: true })
  prenom!: string;

  @Prop({ required: true })
  telephone!: string;

  @Prop({ type: [ModificationHistoriqueSchema], default: [] })
  historique!: ModificationHistorique[];
}

export const CandidatSchema = SchemaFactory.createForClass(Candidat);