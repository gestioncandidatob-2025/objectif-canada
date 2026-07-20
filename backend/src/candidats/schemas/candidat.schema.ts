import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CandidatDocument = HydratedDocument<Candidat>;

@Schema({ timestamps: true })
export class Candidat {
  @Prop({ required: true })
  nom!: string;

  @Prop({ required: true })
  prenom!: string;

  @Prop({ required: true })
  telephone!: string;
}

export const CandidatSchema = SchemaFactory.createForClass(Candidat);