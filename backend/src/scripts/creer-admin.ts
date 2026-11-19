import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { validerEnvironnement } from '../config/environnement';
import { Role, UserSchema } from '../users/schemas/user.schema';
import { CentreSchema } from '../centres/schemas/centre.schema';

/**
 * Crée (ou met à jour) un administrateur de centre.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NOM=...] [CENTRE_ID=...] npm run admin:creer
 *
 * CENTRE_ID est facultatif s'il n'existe qu'un seul centre dans la base.
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

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const motDePasse = process.env.ADMIN_PASSWORD;
  const nom = process.env.ADMIN_NOM?.trim() || 'Administrateur';
  if (!email || !motDePasse) {
    throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD sont obligatoires');
  }
  if (motDePasse.length < 8) {
    throw new Error('ADMIN_PASSWORD doit faire au moins 8 caractères');
  }

  const dbName = String(config.MONGODB_DB_NAME);
  await mongoose.connect(String(config.MONGODB_URI), { dbName });
  const User = mongoose.model('User', UserSchema);
  const Centre = mongoose.model('Centre', CentreSchema);

  // Choix du centre de l'administrateur
  let centreId = process.env.CENTRE_ID?.trim();
  if (!centreId) {
    const centres = await Centre.find().limit(2);
    if (centres.length !== 1) {
      throw new Error(
        centres.length === 0
          ? "Aucun centre dans la base : lance d'abord la migration (npm run migration:centre)"
          : 'Plusieurs centres existent : précise CENTRE_ID',
      );
    }
    centreId = String(centres[0]._id);
  } else if (!(await Centre.exists({ _id: centreId }))) {
    throw new Error(`Centre introuvable : ${centreId}`);
  }

  const motDePasseHache = await bcrypt.hash(motDePasse, 10);
  const existant = await User.findOne({ email }).setOptions({ sansCentre: true });
  if (existant) {
    if (existant.centreId && String(existant.centreId) !== centreId) {
      throw new Error(`${email} appartient déjà à un autre centre`);
    }
    existant.motDePasse = motDePasseHache;
    existant.role = Role.ADMIN;
    existant.emailVerifie = true;
    existant.centreId = new mongoose.Types.ObjectId(centreId);
    await existant.save();
    console.log(`[${config.APP_ENV}/${dbName}] Admin mis à jour : ${email} (centre ${centreId})`);
  } else {
    await User.create({
      nom,
      email,
      motDePasse: motDePasseHache,
      role: Role.ADMIN,
      emailVerifie: true,
      centreId,
    });
    console.log(`[${config.APP_ENV}/${dbName}] Admin créé : ${email} (centre ${centreId})`);
  }

  await mongoose.disconnect();
}

main().catch(async (erreur) => {
  console.error((erreur as Error).message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});