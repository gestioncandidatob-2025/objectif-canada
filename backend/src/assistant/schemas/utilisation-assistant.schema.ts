import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type UtilisationAssistantDocument = HydratedDocument<UtilisationAssistant>;

/**
 * Compteur de questions posées à l'assistant : une ligne par centre et par
 * jour. Sert à limiter le nombre de questions par jour (le service Groq
 * gratuit a une limite, et elle est partagée par tous les centres).
 */
@Schema({ timestamps: true })
export class UtilisationAssistant {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  // Le jour à Douala, au format AAAA-MM-JJ
  @Prop({ required: true })
  jour!: string;

  @Prop({ default: 0 })
  questions!: number;
}

export const UtilisationAssistantSchema = SchemaFactory.createForClass(UtilisationAssistant);
UtilisationAssistantSchema.index({ centreId: 1, jour: 1 }, { unique: true });
UtilisationAssistantSchema.plugin(centrePlugin);