import mongoose from 'mongoose';
import { validerEnvironnement } from '../config/environnement';
import { repartir } from '../caisse/repartir';

/**
 * Remplit le journal des paiements (point de caisse) à partir des factures
 * déjà enregistrées avant cette fonctionnalité.
 *
 * Pour chaque facture qui n'a encore aucune ligne dans le journal et dont le
 * montant payé est supérieur à zéro, on crée UNE ligne :
 * - montant = tout ce qui a été payé sur la facture,
 * - date = date de la facture,
 * - encaissé par = le compte dont le nom correspond au "Facturé par"
 *   (sinon on garde seulement ce nom).
 *
 * Limite connue : avant cette fonctionnalité, les restes à payer encaissés
 * plus tard n'étaient pas datés. Ils sont donc comptés à la date de la facture.
 *
 * Par défaut le script ne modifie RIEN et affiche seulement ce qu'il ferait.
 * Pour appliquer réellement :  MIGRATION_APPLIQUER=oui npm run migration:paiements
 * Il peut être relancé sans danger : une facture déjà présente dans le journal est ignorée.
 */

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

  const inscriptions = db.collection('inscriptions');
  const paiements = db.collection('paiements');
  const users = db.collection('users');
  const candidats = db.collection('candidats');

  const dejaDansLeJournal = new Set(
    (await paiements.distinct('inscriptionId')).map((id) => String(id)),
  );

  let aCreer = 0;
  let avecCompte = 0;
  let total = 0;
  const curseur = inscriptions.find({ montantPaye: { $gt: 0 } });
  for await (const insc of curseur) {
    if (dejaDansLeJournal.has(String(insc._id))) continue;

    const compte = await users.findOne({ centreId: insc.centreId, nom: insc.facturePar });
    const candidat = await candidats.findOne({ _id: insc.candidatId });
    const { especes, mobile } = repartir(
      insc.modePaiement,
      insc.montantPaye,
      insc.montantMobile,
      insc.montantEspeces,
    );

    aCreer += 1;
    total += insc.montantPaye;
    if (compte) avecCompte += 1;

    if (appliquer) {
      const maintenant = new Date();
      await paiements.insertOne({
        centreId: insc.centreId,
        inscriptionId: insc._id,
        numeroRecu: insc.numeroRecu,
        candidatNom: candidat ? `${candidat.nom} ${candidat.prenom}` : undefined,
        type: 'inscription',
        montant: especes + mobile,
        especes,
        mobile,
        modePaiement: insc.modePaiement,
        ...(compte ? { encaisseParId: compte._id } : {}),
        encaisseParNom: compte ? compte.nom : insc.facturePar || 'Inconnu',
        date: insc.dateInscription ?? insc.createdAt ?? maintenant,
        createdAt: maintenant,
        updatedAt: maintenant,
      });
    }
  }

  console.log(`Factures à ajouter au journal : ${aCreer} (${total.toLocaleString('fr-FR')} FCFA)`);
  console.log(`  dont rattachées à un compte existant : ${avecCompte}`);
  console.log(`  dont gardées sous l'ancien nom "Facturé par" : ${aCreer - avecCompte}`);

  await mongoose.disconnect();
  console.log(
    appliquer
      ? 'Journal des paiements rempli.'
      : 'Simulation terminée. Relance avec MIGRATION_APPLIQUER=oui pour appliquer.',
  );
}

main().catch(async (erreur) => {
  console.error((erreur as Error).message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});