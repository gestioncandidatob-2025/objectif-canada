import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { validerEnvironnement } from '../config/environnement';
import { Role, UserSchema } from '../users/schemas/user.schema';

/**
 * Crée (ou met à jour) un compte super administrateur (équipe HREFF).
 * Ce compte n'appartient à aucun centre et ne voit aucune donnée de centre.
 *
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... [SUPER_ADMIN_NOM=...] npm run super-admin:creer
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

  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const motDePasse = process.env.SUPER_ADMIN_PASSWORD;
  const nom = process.env.SUPER_ADMIN_NOM?.trim() || 'Super administrateur';
  if (!email || !motDePasse) {
    throw new Error('SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD sont obligatoires');
  }
  if (motDePasse.length < 8) {
    throw new Error('SUPER_ADMIN_PASSWORD doit faire au moins 8 caractères');
  }

  const dbName = String(config.MONGODB_DB_NAME);
  await mongoose.connect(String(config.MONGODB_URI), { dbName });
  const User = mongoose.model('User', UserSchema);

  const motDePasseHache = await bcrypt.hash(motDePasse, 10);
  const existant = await User.findOne({ email }).setOptions({ sansCentre: true });
  if (existant) {
    if (existant.role !== Role.SUPER_ADMIN) {
      throw new Error(`${email} est déjà un compte de centre : utilise un autre email`);
    }
    existant.motDePasse = motDePasseHache;
    await existant.save();
    console.log(`[${config.APP_ENV}/${dbName}] Super admin mis à jour : ${email}`);
  } else {
    await User.create({
      nom,
      email,
      motDePasse: motDePasseHache,
      role: Role.SUPER_ADMIN,
      emailVerifie: true,
    });
    console.log(`[${config.APP_ENV}/${dbName}] Super admin créé : ${email}`);
  }

  await mongoose.disconnect();
}

main().catch(async (erreur) => {
  console.error((erreur as Error).message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});