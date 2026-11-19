"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { en, fr, type Dictionnaire } from "./traductions";

export type Langue = "fr" | "en";

const DICTIONNAIRES: Record<Langue, Dictionnaire> = { fr, en };
const CLE_STOCKAGE = "langue";

type ContexteLangue = {
  langue: Langue;
  changerLangue: (langue: Langue) => void;
  /** Texte traduit : t("menu.accueil") ou t("accueil.bonjour", { prenom: "Paul" }) */
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
  /** Pour formater les dates et les nombres : "fr-FR" ou "en-GB" */
  locale: string;
};

const Contexte = createContext<ContexteLangue | null>(null);

/** Cherche "menu.accueil" dans le dictionnaire ; renvoie la clé si elle manque */
function chercher(dictionnaire: Dictionnaire, cle: string): string {
  let valeur: unknown = dictionnaire;
  for (const morceau of cle.split(".")) {
    if (valeur && typeof valeur === "object" && morceau in valeur) {
      valeur = (valeur as Record<string, unknown>)[morceau];
    } else {
      return cle;
    }
  }
  return typeof valeur === "string" ? valeur : cle;
}

/**
 * Donne la langue choisie à toute l'application. La langue est retenue dans
 * le navigateur ; le français est utilisé par défaut.
 */
export function LangueProvider({ children }: { children: React.ReactNode }) {
  const [langue, setLangue] = useState<Langue>("fr");

  // Langue choisie lors d'une visite précédente
  useEffect(() => {
    try {
      const enregistree = localStorage.getItem(CLE_STOCKAGE);
      if (enregistree === "fr" || enregistree === "en") {
        setLangue(enregistree);
      }
    } catch {
      // stockage indisponible : on reste en français
    }
  }, []);

  // Langue de la page et titre de l'onglet
  useEffect(() => {
    document.documentElement.lang = langue;
    const prefixe = process.env.NEXT_PUBLIC_APP_ENV === "production" ? "" : "[TEST] ";
    document.title = `${prefixe}${DICTIONNAIRES[langue].app.titre}`;
  }, [langue]);

  const changerLangue = useCallback((nouvelle: Langue) => {
    setLangue(nouvelle);
    try {
      localStorage.setItem(CLE_STOCKAGE, nouvelle);
    } catch {
      // stockage indisponible : le choix vaut pour cette visite seulement
    }
  }, []);

  const t = useCallback(
    (cle: string, valeurs?: Record<string, string | number>) => {
      let texte = chercher(DICTIONNAIRES[langue], cle);
      if (valeurs) {
        for (const [nom, valeur] of Object.entries(valeurs)) {
          texte = texte.split(`{${nom}}`).join(String(valeur));
        }
      }
      return texte;
    },
    [langue],
  );

  return (
    <Contexte.Provider
      value={{ langue, changerLangue, t, locale: langue === "en" ? "en-GB" : "fr-FR" }}
    >
      {children}
    </Contexte.Provider>
  );
}

/** À utiliser dans une page : const { t, langue, locale } = useLangue(); */
export function useLangue(): ContexteLangue {
  const contexte = useContext(Contexte);
  if (!contexte) {
    throw new Error("useLangue doit être utilisé à l'intérieur de LangueProvider");
  }
  return contexte;
}