import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HistoriqueDocument = HydratedDocument<Historique>;

@Schema()
export class Historique {
  @Prop({ required: true })
  utilisateurEmail!: string;

  @Prop()
  utilisateurNom?: string;

  @Prop()
  role?: string;

  // Ex : "Création", "Modification", "Suppression", "Connexion"
  @Prop({ required: true })
  action!: string;

  // Ex : "Candidats", "Utilisateurs", "Tarifs", "Factures"
  @Prop({ required: true })
  module!: string;

  // Ex : "PATCH /candidates/64f..."
  @Prop()
  route?: string;

  @Prop({ required: true, enum: ['succès', 'échec'], default: 'succès' })
  statut!: string;

  // Message d'erreur en cas d'échec, ou précision libre
  @Prop()
  details?: string;

  @Prop({ default: () => new Date() })
  date!: Date;
}

export const HistoriqueSchema = SchemaFactory.createForClass(Historique);
HistoriqueSchema.index({ date: -1 });