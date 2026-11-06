// Outils partagés autour du centre de l'utilisateur connecté.

/**
 * Événement envoyé dans le navigateur quand l'administrateur modifie les
 * paramètres du centre (nom, logo...). Le menu l'écoute pour se mettre à
 * jour tout de suite, sans recharger la page.
 */
export const EVENEMENT_CENTRE_MODIFIE = "centre-modifie";

/** À appeler après chaque modification réussie des paramètres du centre */
export function signalerCentreModifie() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENEMENT_CENTRE_MODIFIE));
}