import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type InscriptionDocument = HydratedDocument<Inscription>;

export enum ModePaiement {
  ORANGE_MONEY = 'orange_money',
  MOBILE_MONEY = 'mobile_money',
  ESPECES = 'especes',
  MOBILE_ESPECES = 'mobile_especes',
  // Payé dans l'application : le candidat valide avec son code PIN, l'argent
  // arrive sur le compte CamPay de HREFF (jamais choisi à la main)
  CAMPAY = 'campay',
}

/**
 * Modes acceptés par défaut par un centre. CamPay n'en fait pas partie :
 * le centre doit l'activer lui-même dans Paramètres → Paiements.
 */
export const MODES_PAIEMENT_PAR_DEFAUT: string[] = Object.values(ModePaiement).filter(
  (mode) => mode !== ModePaiement.CAMPAY,
);

@Schema({ timestamps: true })
export class Inscription {
  // Centre auquel appartient ce document (multi-centres)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

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

  // Unique PAR CENTRE (voir l'index composé en bas du fichier) : deux
  // centres peuvent avoir chacun un reçu n°06112026-0001.
  @Prop({ required: true })
  numeroRecu!: string;

  // Empêche d'envoyer plusieurs fois la notification "formation terminée"
  @Prop({ default: false })
  formationTermineeNotifiee!: boolean;

  // Clé S3 du PDF de la facture stockée sur AWS (pour la compta/les impôts)
  @Prop()
  factureS3Key?: string;

  // Nombre de fois où le reçu a été imprimé : à partir de la 2e impression,
  // le reçu porte la mention « DUPLICATA »
  @Prop({ default: 0 })
  nombreImpressions!: number;
}

export const InscriptionSchema = SchemaFactory.createForClass(Inscription);
InscriptionSchema.index({ centreId: 1, numeroRecu: 1 }, { unique: true });
InscriptionSchema.plugin(centrePlugin);