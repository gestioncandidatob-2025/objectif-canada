import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { validerEnvironnement } from '../config/environnement';
import { Role, UserSchema } from '../users/schemas/user.schema';

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

  const motDePasseHache = await bcrypt.hash(motDePasse, 10);
  const existant = await User.findOne({ email });
  if (existant) {
    existant.motDePasse = motDePasseHache;
    existant.role = Role.ADMIN;
    existant.emailVerifie = true;
    await existant.save();
    console.log(`[${config.APP_ENV}/${dbName}] Admin mis à jour : ${email}`);
  } else {
    await User.create({ nom, email, motDePasse: motDePasseHache, role: Role.ADMIN, emailVerifie: true });
    console.log(`[${config.APP_ENV}/${dbName}] Admin créé : ${email}`);
  }

  await mongoose.disconnect();
}

main().catch(async (erreur) => {
  console.error((erreur as Error).message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});