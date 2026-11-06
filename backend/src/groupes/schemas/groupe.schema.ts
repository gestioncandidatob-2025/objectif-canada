import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type GroupeDocument = HydratedDocument<Groupe>;

/**
 * Un groupe de candidats créé par l'administrateur du centre (remplace les
 * classes fixes Jour/Soir). Exemple : « Soir 1 », lundi au vendredi 17h-19h,
 * 25 places, premier groupe du régime « soir », qui passe dans « Soir 2 »
 * après 14 jours. La secrétaire n'intervient pas : tout est automatique.
 */
@Schema({ timestamps: true })
export class Groupe {
  // Centre auquel appartient ce document (multi-centres)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nom!: string;

  // Texte libre : "Lundi au vendredi, 17h - 19h"
  @Prop({ trim: true })
  horaire?: string;

  // Nombre de places. Absent = pas de limite. Un groupe plein continue de
  // recevoir des candidats : la page Groupes affiche un avertissement.
  @Prop()
  capacite?: number;

  // Régime dont ce groupe est le PREMIER groupe (ex : "soir") : chaque
  // nouvel inscrit de ce régime y entre automatiquement. Un seul groupe
  // actif par régime. Écrit en minuscules, sans espaces autour.
  @Prop({ trim: true, lowercase: true })
  regimeEntree?: string;

  // Un groupe désactivé ne reçoit plus de nouveaux inscrits
  @Prop({ default: true })
  actif!: boolean;

  // Passage automatique : après `joursAvantPassage` jours dans ce groupe,
  // le candidat passe dans `groupeSuivantId`. Les deux vont ensemble.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Groupe' })
  groupeSuivantId?: Types.ObjectId;

  @Prop()
  joursAvantPassage?: number;
}

export const GroupeSchema = SchemaFactory.createForClass(Groupe);
// Deux groupes d'un même centre ne peuvent pas avoir le même nom
// (sans tenir compte des majuscules)
GroupeSchema.index(
  { centreId: 1, nom: 1 },
  { unique: true, collation: { locale: 'fr', strength: 2 } },
);
GroupeSchema.plugin(centrePlugin);