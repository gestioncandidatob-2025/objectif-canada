export type AppEnv = 'production' | 'staging' | 'development';

const ENVIRONNEMENTS_VALIDES: AppEnv[] = ['production', 'staging', 'development'];
const MARQUEURS_BASE_TEST = ['staging', 'test', 'dev'];

export function nomBaseDepuisUri(uri: string): string {
  const sansParams = uri.split('?')[0];
  const apresHote = sansParams.replace(/^mongodb(\+srv)?:\/\/[^/]+/, '');
  return decodeURIComponent(apresHote.replace(/^\//, ''));
}

function estBaseDeTest(nomBase: string): boolean {
  const nom = nomBase.toLowerCase();
  return MARQUEURS_BASE_TEST.some((marqueur) => nom.includes(marqueur));
}

function versBooleen(valeur: unknown, parDefaut: boolean): boolean {
  if (valeur === undefined || valeur === null || valeur === '') return parDefaut;
  return ['1', 'true', 'oui', 'yes', 'on'].includes(String(valeur).toLowerCase());
}

export function validerEnvironnement(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const erreurs: string[] = [];

  const appEnv = String(config.APP_ENV ?? 'development') as AppEnv;
  if (!ENVIRONNEMENTS_VALIDES.includes(appEnv)) {
    erreurs.push(`APP_ENV="${appEnv}" invalide (production, staging ou development)`);
  }

  const mongoUri = String(config.MONGODB_URI ?? '');
  const nomBase = mongoUri ? nomBaseDepuisUri(mongoUri) : '';

  if (!mongoUri) {
    erreurs.push('MONGODB_URI manquant');
  } else if (!nomBase) {
    erreurs.push("MONGODB_URI doit contenir le nom de la base après l'hôte (.../objectifcanada?...)");
  } else if (appEnv === 'production' && estBaseDeTest(nomBase)) {
    erreurs.push(`APP_ENV=production mais la base "${nomBase}" est une base de test — refus de démarrer`);
  } else if (appEnv !== 'production' && !estBaseDeTest(nomBase)) {
    erreurs.push(`APP_ENV=${appEnv} mais la base "${nomBase}" est la prod — refus de démarrer`);
  }

  const jwtSecret = String(config.JWT_SECRET ?? '');
  if (!jwtSecret) {
    erreurs.push('JWT_SECRET manquant');
  } else if (appEnv !== 'development' && jwtSecret.length < 32) {
    erreurs.push('JWT_SECRET trop court (32 caractères minimum hors développement)');
  }

  if (appEnv !== 'development' && !config.CORS_ORIGINS) {
    erreurs.push('CORS_ORIGINS manquant');
  }

  if (erreurs.length > 0) {
    throw new Error(`Configuration invalide (${appEnv}) :\n  - ${erreurs.join('\n  - ')}`);
  }

  return {
    ...config,
    APP_ENV: appEnv,
    MONGODB_DB_NAME: nomBase,
    ENABLE_CRONS: versBooleen(config.ENABLE_CRONS, appEnv === 'production'),
    ENABLE_SWAGGER: versBooleen(config.ENABLE_SWAGGER, appEnv !== 'production'),
    S3_KEY_PREFIX:
      config.S3_KEY_PREFIX !== undefined
        ? String(config.S3_KEY_PREFIX)
        : appEnv === 'production' ? '' : `${appEnv}/`,
  };
}