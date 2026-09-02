// Logique partagée entre la page /classes et la page /candidats (quand elle
// est filtrée par une classe) pour déterminer dans quelle classe range une
// inscription.

export type CodeClasse = "jour1" | "jour2" | "soir1" | "soir2";

export const NOM_CLASSE: Record<CodeClasse, string> = {
  jour1: "Jour 1",
  jour2: "Jour 2",
  soir1: "Soir 1",
  soir2: "Soir 2",
};

export const DESCRIPTION_CLASSE: Record<CodeClasse, string> = {
  jour1: "Journée — moins de 14 jours de formation écoulés",
  jour2: "Journée — 14 jours ou plus de formation écoulés",
  soir1: "Soirée — moins de 14 jours de formation écoulés",
  soir2: "Soirée — 14 jours ou plus de formation écoulés",
};

// Nombre de jours écoulés depuis le début du test jusqu'à aujourd'hui.
export function joursEcoules(dateDebut?: string): number | null {
  if (!dateDebut) return null;
  const debut = new Date(dateDebut);
  const maintenant = new Date();
  const diffMs = maintenant.getTime() - debut.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Normalise un régime saisi librement par l'admin (espaces, majuscules...)
// pour le comparer de façon fiable à "jour" / "soir". Le champ "regimes"
// des tarifs est du texte libre (ex: "Jour", " jour", "JOUR ") : sans cette
// normalisation, ces variantes ne correspondent à rien et le candidat
// disparaît silencieusement de toutes les classes.
function regimeNormalise(regime?: string): string {
  return (regime ?? "").trim().toLowerCase();
}

// Détermine dans quelle classe (Jour1/Jour2/Soir1/Soir2) range une inscription,
// ou null si elle n'a pas de régime jour/soir (ex: Examen blanc, TCF SPECIAL).
export function classeDe(insc: {
  regime?: string;
  dateDebutTest?: string;
}): CodeClasse | null {
  const regime = regimeNormalise(insc.regime);
  if (regime !== "jour" && regime !== "soir") return null;
  const jours = joursEcoules(insc.dateDebutTest);
  if (jours === null) return null;
  const recente = jours < 14;
  if (regime === "jour") return recente ? "jour1" : "jour2";
  return recente ? "soir1" : "soir2";
}

// Explique pourquoi une inscription en régime jour/soir n'apparaît dans
// aucune classe, pour permettre de repérer et corriger les données au lieu
// que le candidat disparaisse silencieusement. Retourne null si l'inscription
// n'est pas censée avoir de classe (pas de régime jour/soir renseigné).
export function raisonNonClasse(insc: {
  regime?: string;
  dateDebutTest?: string;
}): string | null {
  const brut = insc.regime;
  const regime = regimeNormalise(brut);
  if (!brut) return null; // service sans régime jour/soir : normal
  if (regime !== "jour" && regime !== "soir") {
    return `Régime "${brut}" non reconnu (attendu : "jour" ou "soir")`;
  }
  if (joursEcoules(insc.dateDebutTest) === null) {
    return "Date de début du test manquante";
  }
  return null;
}