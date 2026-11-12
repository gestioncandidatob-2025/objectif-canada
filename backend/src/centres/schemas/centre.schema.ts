import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ModePaiement } from '../../inscriptions/schemas/inscription.schema';

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

  // Modes de paiement acceptés par le centre (toujours au moins un).
  // Un mode retiré n'apparaît plus dans le formulaire de facture.
  @Prop({ type: [String], default: () => Object.values(ModePaiement) })
  modesPaiement!: string[];

  // Compteur des reçus du centre : chaque nouvelle facture prend le numéro
  // suivant. Incrémenté de façon atomique (deux secrétaires qui facturent à la
  // même seconde ne peuvent pas obtenir le même numéro).
  @Prop({ default: 0 })
  dernierNumeroRecu!: number;

  // Plan d'abonnement du centre : gratuit, standard, pro ou sur_mesure.
  // Tout nouveau centre démarre au plan Gratuit.
  @Prop({ default: 'gratuit' })
  plan!: string;

  // Abonnement payé par mois ou par an (plans payants)
  @Prop()
  periodicite?: string;

  // Date jusqu'à laquelle l'abonnement est payé. Après : 7 jours de grâce,
  // puis lecture seule. Vide pour le plan Gratuit (ou un plan offert sans fin).
  @Prop()
  finAbonnement?: Date;

  // Plan "Sur mesure" : prix et limites réglés par le super admin pour ce centre
  @Prop(
    raw({
      factures: { type: Number },
      comptes: { type: Number },
      prixMensuel: { type: Number },
      prixAnnuel: { type: Number },
    }),
  )
  surMesure?: {
    factures?: number;
    comptes?: number;
    prixMensuel?: number;
    prixAnnuel?: number;
  };

  @Prop({ type: String, enum: StatutCentre, default: StatutCentre.ACTIF })
  statut!: StatutCentre;
}

export const CentreSchema = SchemaFactory.createForClass(Centre);