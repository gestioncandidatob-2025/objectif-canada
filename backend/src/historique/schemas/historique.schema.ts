import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type HistoriqueDocument = HydratedDocument<Historique>;

@Schema()
export class Historique {
  // Centre auquel appartient ce document (multi-centres)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

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

  // Motif donné pour une modification
  @Prop()
  motif?: string;

  // Ce qui a changé : ancienne et nouvelle valeur de chaque champ
  @Prop({
    type: [{ champ: String, avant: String, apres: String, _id: false }],
    default: undefined,
  })
  changements?: { champ: string; avant: string; apres: string }[];

  @Prop({ default: () => new Date() })
  date!: Date;
}

export const HistoriqueSchema = SchemaFactory.createForClass(Historique);
HistoriqueSchema.index({ centreId: 1, date: -1 });
HistoriqueSchema.plugin(centrePlugin);