import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CentreDocument = HydratedDocument<Centre>;

export enum StatutCentre {
  ACTIF = 'actif',
  SUSPENDU = 'suspendu',
}

/**
 * Un centre (une entreprise cliente de la plateforme).
 * Toutes les autres données (candidats, factures, services, utilisateurs,
 * historique) portent l'identifiant du centre auquel elles appartiennent.
 */
@Schema({ timestamps: true })
export class Centre {
  @Prop({ required: true, trim: true })
  nom!: string;

  @Prop({ trim: true })
  ville?: string;

  @Prop({ trim: true })
  telephone?: string;

  @Prop({ trim: true })
  adresse?: string;

  // Numéro d'identifiant unique (contribuable) et registre du commerce
  @Prop({ trim: true })
  niu?: string;

  @Prop({ trim: true })
  rccm?: string;

  // Clé S3 du logo du centre
  @Prop()
  logoKey?: string;

  // Texte libre affiché en bas des reçus
  @Prop()
  piedDePageRecu?: string;

  // Compteur des reçus du centre : chaque nouvelle facture prend le numéro
  // suivant. Incrémenté de façon atomique (deux secrétaires qui facturent à la
  // même seconde ne peuvent pas obtenir le même numéro).
  @Prop({ default: 0 })
  dernierNumeroRecu!: number;

  // Plan d'abonnement du centre. Tout nouveau centre démarre au plan Gratuit.
  // Les limites de chaque plan (factures, comptes) viendront avec mc/abonnements.
  @Prop({ default: 'gratuit' })
  plan!: string;

  @Prop({ type: String, enum: StatutCentre, default: StatutCentre.ACTIF })
  statut!: StatutCentre;
}

export const CentreSchema = SchemaFactory.createForClass(Centre);