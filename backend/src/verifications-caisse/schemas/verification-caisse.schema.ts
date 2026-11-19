import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type VerificationCaisseDocument = HydratedDocument<VerificationCaisse>;

/**
 * - en_attente : l'email est parti, l'administrateur n'a encore rien choisi
 * - confirmee  : « Je confirme » — la journée est bonne
 * - a_verifier : « À vérifier » — l'administrateur veut regarder de plus près
 * - signalee   : « À signaler » — il y a un problème
 */
export enum StatutVerification {
  EN_ATTENTE = 'en_attente',
  CONFIRMEE = 'confirmee',
  A_VERIFIER = 'a_verifier',
  SIGNALEE = 'signalee',
}

/** Une question de l'administrateur ou une réponse de la personne qui a encaissé */
@Schema({ _id: false })
export class MessageVerification {
  // admin : question de l'administrateur ; caissier : réponse de la personne concernée
  @Prop({ type: String, enum: ['admin', 'caissier'], required: true })
  auteur!: 'admin' | 'caissier';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  auteurId?: Types.ObjectId;

  @Prop({ required: true })
  auteurNom!: string;

  @Prop({ required: true })
  texte!: string;

  @Prop({ required: true })
  date!: Date;
}

export const MessageVerificationSchema = SchemaFactory.createForClass(MessageVerification);

/**
 * Vérification de la caisse d'une personne pour une journée.
 *
 * Créée chaque matin à 6 h pour la veille, au moment où l'email part à
 * l'administrateur. Les montants enregistrés ici sont une « photo » de la
 * caisse à ce moment-là : si la caisse de cette journée change ensuite
 * (facture supprimée…), l'administrateur le voit.
 *
 * Les messages ne sont jamais modifiés ni supprimés.
 */
@Schema({ timestamps: true })
export class VerificationCaisse {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  // Jour vérifié, à l'heure de Douala : "2026-11-18"
  @Prop({ required: true })
  jour!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  encaisseParId!: Types.ObjectId;

  @Prop({ required: true })
  encaisseParNom!: string;

  // Photo de la caisse au moment de l'envoi de l'email
  @Prop({ required: true })
  total!: number;

  @Prop({ default: 0 })
  especes!: number;

  @Prop({ default: 0 })
  mobile!: number;

  @Prop({ default: 0 })
  nombrePaiements!: number;

  @Prop({ type: String, enum: StatutVerification, default: StatutVerification.EN_ATTENTE })
  statut!: StatutVerification;

  @Prop()
  decisionLe?: Date;

  // Nom de l'administrateur, ou « Email » quand le choix vient d'un bouton de l'email
  @Prop()
  decisionPar?: string;

  // Lien secret des boutons de l'email (un clic, sans connexion)
  @Prop({ required: true, unique: true })
  jeton!: string;

  @Prop({ required: true })
  jetonExpireLe!: Date;

  @Prop({ type: [MessageVerificationSchema], default: [] })
  messages!: MessageVerification[];
}

export const VerificationCaisseSchema = SchemaFactory.createForClass(VerificationCaisse);
// Une seule vérification par personne et par jour
VerificationCaisseSchema.index({ centreId: 1, jour: 1, encaisseParId: 1 }, { unique: true });
VerificationCaisseSchema.index({ centreId: 1, statut: 1 });
VerificationCaisseSchema.plugin(centrePlugin);