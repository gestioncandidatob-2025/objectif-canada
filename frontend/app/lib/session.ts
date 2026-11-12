"use client";

import { useEffect } from "react";

/**
 * Durée de la session de connexion.
 * Le jeton de connexion contient sa date d'expiration. Quand elle est
 * passée, on renvoie tout de suite la personne sur la page de connexion
 * (au lieu de la laisser sur un écran qui ne marche plus).
 */

const CLE_SESSION_EXPIREE = "sessionExpiree";

/** Date d'expiration du jeton (en millisecondes), ou null si illisible */
export function expirationDuJeton(token: string | null): number | null {
  if (!token) return null;
  try {
    const partie = token.split(".")[1];
    if (!partie) return null;
    const base64 = partie.replace(/-/g, "+").replace(/_/g, "/");
    const contenu = JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")));
    return typeof contenu.exp === "number" ? contenu.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Vrai si le jeton est expiré (on garde 5 secondes de marge) */
export function jetonExpire(token: string | null): boolean {
  const expiration = expirationDuJeton(token);
  return expiration !== null && expiration - 5000 <= Date.now();
}

let redirectionEnCours = false;

/**
 * Termine la session : on oublie le jeton et on va sur la page de connexion.
 * "expiree" affiche un petit message sur la page de connexion.
 */
export function terminerSession(raison?: "expiree") {
  if (typeof window === "undefined" || redirectionEnCours) return;
  redirectionEnCours = true;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (raison === "expiree") {
    try {
      sessionStorage.setItem(CLE_SESSION_EXPIREE, "1");
    } catch {
      // stockage indisponible : pas de message, mais la redirection se fait
    }
  }
  window.location.replace("/login");
}

/** Lu par la page de connexion : faut-il dire que la session a expiré ? (une seule fois) */
export function lireSessionExpiree(): boolean {
  try {
    const expiree = sessionStorage.getItem(CLE_SESSION_EXPIREE) === "1";
    sessionStorage.removeItem(CLE_SESSION_EXPIREE);
    return expiree;
  } catch {
    return false;
  }
}

/**
 * À mettre dans les cadres des pages connectées (tableau de bord, super admin).
 * - au chargement : jeton expiré → page de connexion ;
 * - pendant que la page reste ouverte : redirection à l'heure exacte d'expiration ;
 * - au retour sur l'onglet (ordinateur sorti de veille…) : on vérifie de nouveau.
 */
export function useSurveillanceSession(actif = true) {
  useEffect(() => {
    if (!actif) return;

    function verifier() {
      const token = localStorage.getItem("token");
      if (!token) return;
      if (jetonExpire(token)) terminerSession("expiree");
    }

    verifier();

    const expiration = expirationDuJeton(localStorage.getItem("token"));
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    if (expiration !== null) {
      // setTimeout ne dépasse pas ~24 jours : on plafonne
      const attente = Math.min(Math.max(expiration - Date.now(), 0), 2_000_000_000);
      minuteur = setTimeout(verifier, attente);
    }

    function auRetour() {
      if (document.visibilityState === "visible") verifier();
    }
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("focus", verifier);

    return () => {
      if (minuteur) clearTimeout(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("focus", verifier);
    };
  }, [actif]);
}