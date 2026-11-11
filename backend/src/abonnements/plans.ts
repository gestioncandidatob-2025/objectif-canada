/**
 * Les plans d'abonnement et les règles de l'abonnement d'un centre.
 *
 * Les plans eux-mêmes (prix et limites) sont enregistrés dans la collection
 * "plans" : le super admin peut changer les prix. Les valeurs ci-dessous
 * sont celles de départ, créées au premier démarrage du serveur.
 */

export const PLAN_GRATUIT = 'gratuit';
export const PLAN_SUR_MESURE = 'sur_mesure';

export type Periodicite = 'mensuel' | 'annuel';

export interface PlanParDefaut {
  code: string;
  nom: string;
  ordre: number;
  prixMensuel: number | null;
  prixAnnuel: number | null;
  factures: number;
  comptes: number;
}

export const PLANS_PAR_DEFAUT: PlanParDefaut[] = [
  { code: PLAN_GRATUIT, nom: 'Gratuit', ordre: 1, prixMensuel: 0, prixAnnuel: null, factures: 25, comptes: 2 },
  { code: 'standard', nom: 'Standard', ordre: 2, prixMensuel: 10000, prixAnnuel: 100000, factures: 100, comptes: 3 },
  { code: 'pro', nom: 'Pro', ordre: 3, prixMensuel: 20000, prixAnnuel: 200000, factures: 200, comptes: 5 },
  // Sur mesure : le centre choisit ses factures (et ses comptes), le prix est
  // calculé avec TARIF_SUR_MESURE_PAR_DEFAUT. Les limites ci-dessous ne
  // servent que pour un centre Sur mesure sans valeurs enregistrées.
  { code: PLAN_SUR_MESURE, nom: 'Sur mesure', ordre: 4, prixMensuel: null, prixAnnuel: null, factures: 200, comptes: 5 },
];

/**
 * Prix du plan Sur mesure (modifiables par le super admin) :
 * - prixParFacture           : prix d'une facture par mois (100 F = même prix que Standard et Pro)
 * - facturesParCompte        : 1 compte inclus pour ce nombre de factures (40 → Standard 3, Pro 5)
 * - prixCompteSupplementaire : prix par mois d'un compte en plus de ceux inclus
 */
export interface TarifSurMesure {
  prixParFacture: number;
  facturesParCompte: number;
  prixCompteSupplementaire: number;
}

export const TARIF_SUR_MESURE_PAR_DEFAUT: TarifSurMesure = {
  prixParFacture: 100,
  facturesParCompte: 40,
  prixCompteSupplementaire: 1000,
};

/** Comptes toujours inclus, même avec peu de factures (comme le plan Gratuit) */
export const COMPTES_MINIMUM = 2;

/** Abonnement annuel : 12 mois pour le prix de 10 (2 mois offerts) */
export const MOIS_PAYES_PAR_AN = 10;

/**
 * Calcule l'abonnement Sur mesure pour un nombre de factures par mois et un
 * nombre de comptes souhaité. Les comptes inclus sont offerts ; on ne paie
 * que les comptes au-delà. Demander moins de comptes que ceux inclus ne
 * baisse pas le prix (on reçoit quand même les comptes inclus).
 */
export function calculerSurMesure(factures: number, comptesSouhaites: number | undefined, tarif: TarifSurMesure) {
  const nbFactures = Math.max(1, Math.floor(factures));
  const comptesInclus = Math.max(COMPTES_MINIMUM, Math.ceil(nbFactures / Math.max(1, tarif.facturesParCompte)));
  const comptes = Math.max(comptesInclus, Math.floor(comptesSouhaites ?? comptesInclus));
  const comptesEnPlus = comptes - comptesInclus;
  const prixMensuel = nbFactures * tarif.prixParFacture + comptesEnPlus * tarif.prixCompteSupplementaire;
  return {
    factures: nbFactures,
    comptesInclus,
    comptes,
    comptesEnPlus,
    prixMensuel,
    prixAnnuel: prixMensuel * MOIS_PAYES_PAR_AN,
  };
}

/** Jours pendant lesquels un centre peut encore travailler après l'échéance */
export const JOURS_DE_GRACE = 7;

/** Seuil à partir duquel on prévient l'admin que son quota de factures approche */
export const SEUIL_ALERTE_QUOTA = 0.8;

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * - gratuit       : plan Gratuit, rien à payer
 * - actif         : plan payant, payé jusqu'à finAbonnement
 * - grace         : échéance passée, le centre a encore JOURS_DE_GRACE jours pour payer
 * - lecture_seule : grâce terminée, plus de nouvelle facture ni de nouveau compte
 */
export type StatutAbonnement = 'gratuit' | 'actif' | 'grace' | 'lecture_seule';

export function etatAbonnement(
  centre: { plan?: string; finAbonnement?: Date | null },
  maintenant = new Date(),
): { statut: StatutAbonnement; finGrace: Date | null } {
  const plan = centre.plan || PLAN_GRATUIT;
  if (plan === PLAN_GRATUIT) {
    return { statut: 'gratuit', finGrace: null };
  }
  // Plan offert sans date de fin (réglé à la main par le super admin)
  if (!centre.finAbonnement) {
    return { statut: 'actif', finGrace: null };
  }
  const fin = new Date(centre.finAbonnement);
  const finGrace = new Date(fin.getTime() + JOURS_DE_GRACE * UN_JOUR_MS);
  if (maintenant <= fin) return { statut: 'actif', finGrace };
  if (maintenant <= finGrace) return { statut: 'grace', finGrace };
  return { statut: 'lecture_seule', finGrace };
}

/** Ajoute des mois à une date (le 31 janvier + 1 mois donne le 3 mars, comme partout) */
export function ajouterMois(date: Date, mois: number) {
  const resultat = new Date(date);
  resultat.setUTCMonth(resultat.getUTCMonth() + mois);
  return resultat;
}

/** Premier jour du mois en cours à minuit, heure de Douala (UTC+1) */
export function debutDuMoisDouala(maintenant = new Date()) {
  const local = new Date(maintenant.getTime() + 60 * 60 * 1000);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 60 * 60 * 1000);
}

/**
 * Numéro camerounais au format attendu par CamPay : 2376XXXXXXXX.
 * Accepte "690 00 00 00", "+237690000000", "237 690000000"…
 * Renvoie null si le numéro n'est pas valide.
 */
export function normaliserTelephone(telephone: string): string | null {
  let chiffres = String(telephone ?? '').replace(/\D/g, '');
  if (chiffres.length === 9) chiffres = `237${chiffres}`;
  return /^2376\d{8}$/.test(chiffres) ? chiffres : null;
}