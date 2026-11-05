import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { centrePlugin } from '../../common/centre.plugin';

export type TarifDocument = HydratedDocument<Tarif>;

@Schema({ timestamps: true })
export class Tarif {
  // Centre auquel appartient ce document (multi-centres)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Centre', required: true, index: true })
  centreId!: Types.ObjectId;

  @Prop({ required: true })
  service!: string;

  // Liste des régimes proposés pour ce service (ex: ["jour", "soir"]),
  // saisis librement par l'administrateur. Pertinent uniquement si
  // regimeActif est vrai.
  @Prop({ type: [String] })
  regimes?: string[];

  @Prop()
  prix?: number;

  @Prop()
  dureeJours?: number;

  @Prop({ default: true })
  actif!: boolean;

  // Si vrai : la date de fin est saisie manuellement dans le formulaire
  // d'inscription. Si faux : elle est calculée automatiquement à partir
  // de dureeJours (le champ date de fin n'est alors pas affiché).
  @Prop({ default: false })
  dateFinNecessaire!: boolean;

  // Si vrai : le champ "remise" est affiché et applicable dans le
  // formulaire d'inscription pour ce service.
  @Prop({ default: false })
  remiseActive!: boolean;

  // Si vrai : le champ "régime" (et la date de début du test) est
  // affiché et obligatoire dans le formulaire d'inscription. La liste
  // déroulante est alimentée par le tableau "regimes" ci-dessus.
  @Prop({ default: false })
  regimeActif!: boolean;

  // Si vrai : à l'inscription, l'opérateur saisit un "montant négocié"
  // libre et le champ prix de cette offre est ignoré.
  @Prop({ default: false })
  montantNegociable!: boolean;
}

export const TarifSchema = SchemaFactory.createForClass(Tarif);
TarifSchema.plugin(centrePlugin);