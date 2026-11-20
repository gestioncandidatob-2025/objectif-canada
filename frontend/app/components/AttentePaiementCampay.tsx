"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";

/**
 * Fenêtre d'attente d'un paiement CamPay : le candidat reçoit une demande de
 * code PIN sur son téléphone. On redemande au serveur toutes les 4 secondes
 * où en est le paiement, pendant 3 minutes au plus.
 *
 * - Paiement réussi → onReussi (avec l'identifiant de la facture)
 * - Échec ou attente trop longue → message, puis onFermer
 */

export type SuiviPaiementCampay = {
  id: string;
  statut: "en_attente" | "reussi" | "echoue";
  montant: number;
  raisonEchec: string | null;
  inscriptionId: string | null;
  erreurFacture: string | null;
};

const INTERVALLE_MS = 4000;
const DUREE_MAX_MS = 3 * 60 * 1000;

export default function AttentePaiementCampay({
  paiementId,
  montant,
  telephone,
  ussdCode,
  onReussi,
  onFermer,
}: {
  paiementId: string;
  montant: number;
  telephone: string;
  ussdCode?: string | null;
  onReussi: (suivi: SuiviPaiementCampay) => void;
  onFermer: () => void;
}) {
  const { t, locale } = useLangue();
  const [secondes, setSecondes] = useState(0);
  const [fin, setFin] = useState<{ type: "echec" | "delai" | "erreurFacture"; texte: string } | null>(null);
  // Les fonctions du parent peuvent changer à chaque affichage : on garde la dernière
  const rappels = useRef({ onReussi });
  rappels.current = { onReussi };

  useEffect(() => {
    const debut = Date.now();
    let termine = false;

    async function verifier() {
      if (termine) return;
      try {
        const res = await apiFetch(`/mobile-payments/${paiementId}`);
        if (!res.ok) return;
        const suivi: SuiviPaiementCampay = await res.json();
        if (suivi.statut === "reussi") {
          // Argent reçu ; la facture se crée juste après, on attend de l'avoir
          if (suivi.erreurFacture) {
            arreter();
            setFin({ type: "erreurFacture", texte: t("campay.erreurFacture", { message: suivi.erreurFacture }) });
            return;
          }
          if (suivi.inscriptionId) {
            arreter();
            rappels.current.onReussi(suivi);
            return;
          }
        } else if (suivi.statut === "echoue") {
          arreter();
          setFin({ type: "echec", texte: suivi.raisonEchec || t("campay.texteEchec") });
          return;
        }
        if (Date.now() - debut > DUREE_MAX_MS) {
          arreter();
          setFin({ type: "delai", texte: t("campay.texteDelai") });
        }
      } catch {
        // réseau coupé un instant : on réessaie au prochain tour
      }
    }

    function arreter() {
      termine = true;
      clearInterval(minuterie);
      clearInterval(chrono);
    }

    const minuterie = setInterval(verifier, INTERVALLE_MS);
    const chrono = setInterval(() => setSecondes((s) => s + 1), 1000);
    verifier();
    return arreter;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiementId]);

  const numero = telephone.replace(/^237/, "");
  const temps = `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl sm:p-8">
        {!fin ? (
          <>
            <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-accent/20 border-t-accent" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-semibold text-ink">{t("campay.titre")}</h2>
            <p className="mt-2 text-base text-ink-soft">
              {t("campay.texte", { montant: `${montant.toLocaleString(locale)} FCFA`, numero })}
            </p>
            <ol className="mt-5 space-y-2 rounded-2xl bg-paper p-4 text-left text-sm text-ink">
              {[t("campay.etape1"), t("campay.etape2"), t("campay.etape3")].map((etape, i) => (
                <li key={etape} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{etape}</span>
                </li>
              ))}
            </ol>
            {ussdCode && <p className="mt-3 text-sm text-ink-soft">{t("campay.codeUssd", { code: ussdCode })}</p>}
            <p className="mt-5 text-sm font-medium text-ink">{t("campay.enAttente", { temps })}</p>
            <p className="mt-1 text-xs text-ink-soft">{t("campay.nePasFermer")}</p>
          </>
        ) : (
          <>
            <div
              className={
                "mx-auto flex h-14 w-14 items-center justify-center rounded-full " +
                (fin.type === "delai" ? "bg-seal/15 text-ink" : "bg-error/10 text-error")
              }
              aria-hidden="true"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {fin.type === "delai" ? (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </>
                ) : (
                  <path d="M6 6l12 12M18 6L6 18" />
                )}
              </svg>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-ink">
              {fin.type === "delai"
                ? t("campay.titreDelai")
                : fin.type === "erreurFacture"
                  ? t("campay.titreErreurFacture")
                  : t("campay.titreEchec")}
            </h2>
            <p className="mt-2 text-base text-ink-soft">{fin.texte}</p>
            <button
              type="button"
              onClick={onFermer}
              className="mt-6 h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white hover:bg-accent-hover"
            >
              {t("campay.fermer")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}