import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlanDocument = HydratedDocument<Plan>;

/**
 * Un plan d'abonnement de la plateforme (Gratuit, Standard, Pro, Sur mesure).
 * Commun à tous les centres : pas de centreId. Seul le super admin le modifie.
 * Un changement de prix vaut pour les prochains paiements, pas pour ceux déjà faits.
 */
@Schema({ timestamps: true })
export class Plan {
  // Identifiant fixe utilisé dans le code : gratuit, standard, pro, sur_mesure
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true })
  nom!: string;

  // Ordre d'affichage
  @Prop({ default: 0 })
  ordre!: number;

  // Prix en FCFA. null = ce plan ne se paie pas par mois (ou par an)
  @Prop({ type: Number, default: null })
  prixMensuel!: number | null;

  @Prop({ type: Number, default: null })
  prixAnnuel!: number | null;

  // Nombre maximum de factures créées par mois
  @Prop({ required: true })
  factures!: number;

  // Nombre maximum de comptes (admin + secrétaires)
  @Prop({ required: true })
  comptes!: number;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);