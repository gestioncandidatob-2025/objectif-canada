import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type GroupeDocument = HydratedDocument<Groupe>;

/**
 * Un groupe de candidats (remplace les classes fixes Jour/Soir).
 * Les groupes sont créés automatiquement à partir des services et de leurs
 * régimes (voir GroupesService). Exemple : « TCF Soir 1 », groupe d'entrée
 * du service TCF en régime soir, qui passe dans « TCF Soir 2 » après
 * 14 jours. La secrétaire n'intervient jamais sur les groupes.
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

  // Nombre de places (facultatif). Absent = pas de limite. Un groupe plein
  // continue de recevoir des candidats : la page Groupes affiche un avertissement.
  @Prop()
  capacite?: number;

  // Groupe d'entrée (groupe 1) d'un service, et de son régime s'il en a un :
  // chaque nouvel inscrit de ce service (et de ce régime) y entre
  // automatiquement. Absents sur un groupe 2.
  @Prop({ trim: true })
  serviceEntree?: string;

  // Régime en minuscules (ex : "soir"). Absent pour un service sans régime.
  @Prop({ trim: true, lowercase: true })
  regimeEntree?: string;

  // Un groupe désactivé ne reçoit plus de candidats
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