// Cache simple en mémoire, partagé entre toutes les pages tant que l'onglet
// reste ouvert. Sert à éviter de retélécharger les mêmes données (ex: la
// liste des offres) quand on navigue d'une page à l'autre en peu de temps.

type EntreeCache = { donnees: unknown; horodatage: number };

const cache = new Map<string, EntreeCache>();

/**
 * Renvoie les données en cache pour cette clé si elles existent et ne sont
 * pas plus vieilles que dureeMs. Renvoie null sinon (il faut recharger).
 */
export function lireCache<T>(cle: string, dureeMs: number): T | null {
  const entree = cache.get(cle);
  if (!entree) return null;
  if (Date.now() - entree.horodatage > dureeMs) {
    cache.delete(cle);
    return null;
  }
  return entree.donnees as T;
}

export function ecrireCache(cle: string, donnees: unknown) {
  cache.set(cle, { donnees, horodatage: Date.now() });
}

/** À appeler après une création/modification/suppression pour forcer un
 * rechargement frais la prochaine fois que cette donnée est demandée. */
export function invaliderCache(cle: string) {
  cache.delete(cle);
}