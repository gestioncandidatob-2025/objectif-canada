import mongoose from 'mongoose';
import { validerEnvironnement } from '../config/environnement';

/**
 * Migration unique vers le multi-centres.
 *
 * 1. Crée le centre "Objectif Canada" s'il n'existe pas encore.
 * 2. Rattache à ce centre toutes les données qui n'ont pas de centreId
 *    (candidats, inscriptions, tarifs, historiques, utilisateurs).
 * 3. Corrige les centreId enregistrés en texte au lieu d'identifiant.
 * 4. Remplace l'index "numeroRecu unique sur toute la base" par
 *    "numeroRecu unique par centre".
 * 5. Initialise le compteur de reçus de chaque centre.
 * 6. Compte les documents avant / après et vérifie que rien n'est perdu.
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

  // 0. Comptage AVANT (pour vérifier à la fin que rien n'a été perdu)
  const totauxAvant: Record<string, number> = {};
  for (const nom of COLLECTIONS) {
    totauxAvant[nom] = await db.collection(nom).countDocuments();
  }

  // 1. Centre Objectif Canada
  const centres = db.collection('centres');
  const centre = await centres.findOne({ nom: CENTRE_PAR_DEFAUT.nom });
  let centreId: mongoose.Types.ObjectId;
  if (centre) {
    centreId = centre._id as mongoose.Types.ObjectId;
    console.log(`Centre existant : ${CENTRE_PAR_DEFAUT.nom} (${centreId})`);
  } else if (appliquer) {
    const maintenant = new Date();
    const resultat = await centres.insertOne({
      ...CENTRE_PAR_DEFAUT,
      dernierNumeroRecu: 0,
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

  // 3. Corriger les centreId enregistrés en texte au lieu d'identifiant
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

  // 4. Index des numéros de reçu
  const inscriptions = db.collection('inscriptions');
  // La collection peut ne pas encore exister (base vide) : on ne plante pas
  const index: { name?: string }[] = await inscriptions.indexes().catch(() => []);
  if (index.some((i) => i.name === 'numeroRecu_1')) {
    if (appliquer) {
      await inscriptions.dropIndex('numeroRecu_1');
    }
    console.log(`Ancien index numeroRecu_1 ${appliquer ? 'supprimé' : 'à supprimer'}`);
  }
  if (!index.some((i) => i.name === 'centreId_1_numeroRecu_1')) {
    if (appliquer) {
      await inscriptions.createIndex({ centreId: 1, numeroRecu: 1 }, { unique: true });
    }
    console.log(`Index { centreId, numeroRecu } unique ${appliquer ? 'créé' : 'à créer'}`);
  }

  // 5. Compteur de reçus : on part du nombre de factures déjà émises par le
  //    centre, pour que la numérotation continue là où elle en était.
  const centresSansCompteur = await centres
    .find({ dernierNumeroRecu: { $exists: false } })
    .toArray();
  for (const c of centresSansCompteur) {
    const nombreFactures = await inscriptions.countDocuments({ centreId: c._id });
    if (appliquer) {
      await centres.updateOne({ _id: c._id }, { $set: { dernierNumeroRecu: nombreFactures } });
    }
    console.log(
      `Compteur de reçus de "${c.nom}" ${appliquer ? 'initialisé' : 'à initialiser'} à ${nombreFactures}`,
    );
  }

  // 6. Comptage APRÈS : chaque collection doit avoir le même nombre de
  //    documents qu'avant, et (en mode réel) tous rattachés à un centre.
  console.log('');
  console.log('Vérification avant / après :');
  let toutEstBon = true;
  for (const nom of COLLECTIONS) {
    const collection = db.collection(nom);
    const totalApres = await collection.countDocuments();
    const sansCentre = await collection.countDocuments({
      centreId: { $exists: false },
      ...(nom === 'users' ? { role: { $ne: 'super_admin' } } : {}),
    });
    const ok = totalApres === totauxAvant[nom] && (!appliquer || sansCentre === 0);
    if (!ok) toutEstBon = false;
    console.log(
      `  ${ok ? 'OK ' : 'ERREUR'} ${nom} : ${totauxAvant[nom]} avant, ${totalApres} après, ${sansCentre} sans centre`,
    );
  }

  await mongoose.disconnect();
  console.log('');
  if (!appliquer) {
    console.log('Simulation terminée. Relance avec MIGRATION_APPLIQUER=oui pour appliquer.');
  } else if (toutEstBon) {
    console.log('Migration terminée : aucune donnée perdue, tout est rattaché à un centre.');
  } else {
    console.log('ATTENTION : la vérification a trouvé une différence, ne pas utiliser cette base avant contrôle.');
    process.exit(1);
  }
}

main().catch(async (erreur) => {
  console.error((erreur as Error).message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});