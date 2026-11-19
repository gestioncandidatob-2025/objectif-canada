import { Schema } from 'mongoose';

/**
 * Garde-fou du multi-centres.
 *
 * Ce plugin est branché sur toutes les collections qui appartiennent à un
 * centre (candidats, inscriptions, tarifs, historiques, users). Il refuse
 * toute lecture, modification ou suppression qui ne précise pas `centreId`
 * dans son filtre, et tout enregistrement sans `centreId`.
 *
 * Résultat : si un développeur oublie de filtrer par centre, l'application
 * renvoie une erreur au lieu de montrer les données d'un autre centre.
 *
 * Exception volontaire (connexion, vérification d'email, tâches de
 * migration) : ajouter `.setOptions({ sansCentre: true })` à la requête.
 */

const OPERATIONS_FILTREES = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'countDocuments',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'replaceOne',
  'distinct',
] as const;

export interface OptionsCentrePlugin {
  /** Documents autorisés à ne pas avoir de centre (ex : le super administrateur) */
  sansCentreAutorise?: (doc: any) => boolean;
}

export function centrePlugin(schema: Schema, options: OptionsCentrePlugin = {}) {
  schema.pre([...OPERATIONS_FILTREES] as any, function (this: any) {
    const optionsRequete = this.getOptions?.() ?? {};
    if (optionsRequete.sansCentre) return;
    const filtre = this.getFilter?.() ?? {};
    if (!filtre.centreId) {
      throw new Error(
        `Multi-centres : requête "${this.op}" sur "${this.model?.modelName}" sans centreId`,
      );
    }
  });

  schema.pre('save', function (this: any) {
    if (this.$locals?.sansCentre) return;
    if (options.sansCentreAutorise?.(this)) return;
    if (!this.centreId) {
      throw new Error(
        `Multi-centres : enregistrement "${this.constructor?.modelName}" sans centreId`,
      );
    }
  });

  schema.pre('aggregate', function (this: any) {
    if (this.options?.sansCentre) return;
    const premiereEtape = this.pipeline()[0];
    if (!premiereEtape?.$match?.centreId) {
      throw new Error('Multi-centres : agrégation sans $match sur centreId en premier');
    }
  });
}