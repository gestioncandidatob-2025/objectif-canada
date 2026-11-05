import mongoose from 'mongoose';
import { validerEnvironnement } from '../config/environnement';

/**
 * Migration unique vers le multi-centres.
 *
 * 1. Crée le centre "Objectif Canada" s'il n'existe pas encore.
 * 2. Rattache à ce centre toutes les données existantes qui n'ont pas de
 *    centreId (candidats, inscriptions, tarifs, historiques, utilisateurs).
 * 3. Remplace l'ancien index "numeroRecu unique sur toute la base" par
 *    "numeroRecu unique par centre".
 *
 * Par défaut le script ne modifie RIEN et affiche seulement ce qu'il ferait.
 * Pour appliquer réellement :  MIGRATION_APPLIQUER=oui npm run migration:centre
 *
 * Le script peut être relancé sans danger : ce qui est déjà migré est ignoré.
 */

const COLLECTIONS = ['candidats', 'inscriptions', 'tarifs', 'historiques', 'users'];

const CENTRE_PAR_DEFAUT = {
  nom: 'Objectif Canada',
  ville: 'Douala',
  telephone: '(+237) 686 876 873',
  adresse: 'DLA-Bonamoussadi ancien impôt',
  niu: 'M022517596119U',
  statut: 'actif',
};

function chargerFichierEnv() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* pas de .env : on utilise l'environnement tel quel */
  }
}

async function main() {
  chargerFichierEnv();
  const config = validerEnvironnement({
    ...process.env,
    CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'script',
  });
  const appliquer = process.env.MIGRATION_APPLIQUER === 'oui';
  const dbName = String(config.MONGODB_DB_NAME);

  console.log(`Base : ${config.APP_ENV}/${dbName}`);
  console.log(appliquer ? 'MODE : APPLICATION RÉELLE' : 'MODE : SIMULATION (rien ne sera modifié)');

  await mongoose.connect(String(config.MONGODB_URI), { dbName });
  const db = mongoose.connection.db;
  if (!db) throw new Error('Connexion à la base impossible');

  // 1. Centre Objectif Canada
  const centres = db.collection('centres');
  let centre = await centres.findOne({ nom: CENTRE_PAR_DEFAUT.nom });
  let centreId: mongoose.Types.ObjectId;
  if (centre) {
    centreId = centre._id as mongoose.Types.ObjectId;
    console.log(`Centre existant : ${CENTRE_PAR_DEFAUT.nom} (${centreId})`);
  } else if (appliquer) {
    const maintenant = new Date();
    const resultat = await centres.insertOne({
      ...CENTRE_PAR_DEFAUT,
      createdAt: maintenant,
      updatedAt: maintenant,
    });
    centreId = resultat.insertedId as mongoose.Types.ObjectId;
    console.log(`Centre créé : ${CENTRE_PAR_DEFAUT.nom} (${centreId})`);
  } else {
    centreId = new mongoose.Types.ObjectId();
    console.log(`[simulation] Le centre "${CENTRE_PAR_DEFAUT.nom}" serait créé`);
  }

  // 2. Rattacher les données sans centre
  for (const nom of COLLECTIONS) {
    const collection = db.collection(nom);
    const filtre: Record<string, unknown> = { centreId: { $exists: false } };
    if (nom === 'users') {
      filtre.role = { $ne: 'super_admin' };
    }
    const aMigrer = await collection.countDocuments(filtre);
    if (appliquer && aMigrer > 0) {
      await collection.updateMany(filtre, { $set: { centreId } });
    }
    console.log(`${nom} : ${aMigrer} document(s) ${appliquer ? 'rattaché(s)' : 'à rattacher'}`);
  }

  // 2 bis. Corriger les centreId enregistrés en texte au lieu d'ObjectId
  //        (créés par une première version du code multi-centres)
  for (const nom of COLLECTIONS) {
    const collection = db.collection(nom);
    const filtre = { centreId: { $type: 'string' } };
    const enTexte = await collection.countDocuments(filtre);
    if (enTexte > 0) {
      if (appliquer) {
        await collection.updateMany(filtre, [{ $set: { centreId: { $toObjectId: '$centreId' } } }]);
      }
      console.log(`${nom} : ${enTexte} centreId en texte ${appliquer ? 'corrigé(s)' : 'à corriger'}`);
    }
  }

  // 3. Index des numéros de reçu
  const inscriptions = db.collection('inscriptions');
  // La collection peut ne pas encore exister (base vide) : on ne plante pas
  const index: { name?: string }[] = await inscriptions.indexes().catch(() => []);
  const ancien = index.find((i) => i.name === 'numeroRecu_1');
  if (ancien) {
    if (appliquer) {
      await inscriptions.dropIndex('numeroRecu_1');
    }
    console.log(`Ancien index numeroRecu_1 ${appliquer ? 'supprimé' : 'à supprimer'}`);
  }
  if (appliquer) {
    await inscriptions.createIndex({ centreId: 1, numeroRecu: 1 }, { unique: true });
    console.log('Index { centreId, numeroRecu } unique : OK');
  } else {
    console.log('[simulation] Index { centreId, numeroRecu } unique serait créé');
  }

  await mongoose.disconnect();
  console.log(appliquer ? 'Migration terminée.' : 'Simulation terminée. Relance avec MIGRATION_APPLIQUER=oui pour appliquer.');
}

main().catch(async (erreur) => {
  console.error((erreur as Error).message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});