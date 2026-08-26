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

// Détermine dans quelle classe (Jour1/Jour2/Soir1/Soir2) range une inscription,
// ou null si elle n'a pas de régime jour/soir (ex: Examen blanc, TCF SPECIAL).
export function classeDe(insc: {
  regime?: string;
  dateDebutTest?: string;
}): CodeClasse | null {
  if (insc.regime !== "jour" && insc.regime !== "soir") return null;
  const jours = joursEcoules(insc.dateDebutTest);
  if (jours === null) return null;
  const recente = jours < 14;
  if (insc.regime === "jour") return recente ? "jour1" : "jour2";
  return recente ? "soir1" : "soir2";
}