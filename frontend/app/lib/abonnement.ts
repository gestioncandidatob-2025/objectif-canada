"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

/** État de l'abonnement du centre, renvoyé par GET /subscription/status */
export type EtatAbonnement = {
  plan: { code: string; nom: string };
  statut: "gratuit" | "actif" | "grace" | "lecture_seule";
  periodicite: "mensuel" | "annuel" | null;
  finAbonnement: string | null;
  finGrace: string | null;
  factures: { utilisees: number; limite: number };
  comptes: { utilises: number; limite: number };
  peutFacturer: boolean;
  raisonBlocage: string | null;
  alerteQuota: boolean;
};

// Événement envoyé quand l'abonnement change (paiement réussi) : le bandeau se recharge
export const EVENEMENT_ABONNEMENT_MODIFIE = "abonnement-modifie";

/**
 * Charge l'état de l'abonnement du centre, et le recharge quand `cle`
 * change (par exemple à chaque changement de page) ou après un paiement.
 */
export function useEtatAbonnement(actif: boolean, cle?: string) {
  const [etat, setEtat] = useState<EtatAbonnement | null>(null);

  const charger = useCallback(async () => {
    try {
      const res = await apiFetch("/subscription/status");
      if (res.ok) setEtat(await res.json());
    } catch {
      // serveur injoignable : on garde l'état déjà connu
    }
  }, []);

  useEffect(() => {
    if (!actif) return;
    charger();
  }, [actif, cle, charger]);

  useEffect(() => {
    if (!actif) return;
    window.addEventListener(EVENEMENT_ABONNEMENT_MODIFIE, charger);
    return () => window.removeEventListener(EVENEMENT_ABONNEMENT_MODIFIE, charger);
  }, [actif, charger]);

  return etat;
}

/** Nom du plan dans la langue choisie (les codes viennent du serveur) */
export function nomDuPlan(code: string, t: (cle: string) => string, nomServeur?: string) {
  const cle = `abonnement.plans.${code}`;
  const traduit = t(cle);
  return traduit === cle ? (nomServeur ?? code) : traduit;
}