"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { traduireReponseServeur } from "../lib/api";
import { useLangue } from "../lib/langue";
import BoutonLangue from "../components/BoutonLangue";

/**
 * Page ouverte par un bouton de l'email « Caisse d'hier ».
 * Le choix est enregistré tout de suite, sans se connecter : le lien de
 * l'email est secret et propre à cette caisse. L'administrateur peut
 * encore changer d'avis depuis cette page.
 */

type Action = "confirmer" | "verifier" | "signaler";
const ACTIONS: Action[] = ["confirmer", "verifier", "signaler"];

type Resultat = {
  centre: string;
  personne: string;
  jour: string;
  total: number;
  statut: "en_attente" | "confirmee" | "a_verifier" | "signalee";
};

const STYLE_BOUTON: Record<Action, string> = {
  confirmer: "bg-accent text-white hover:bg-accent-hover",
  verifier: "bg-seal text-white hover:opacity-90",
  signaler: "bg-error text-white hover:opacity-90",
};

function VerificationCaisse() {
  const parametres = useSearchParams();
  const { t, locale } = useLangue();
  const jeton = parametres.get("t") ?? "";
  const actionLien = parametres.get("a") as Action | null;

  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  // En développement, React lance les effets deux fois : on n'envoie le choix qu'une fois
  const dejaEnvoye = useRef(false);

  const choisir = useCallback(
    async (action: Action) => {
      setEnvoi(true);
      setErreur("");
      try {
        const res = await traduireReponseServeur(
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/cash-checks/email-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: jeton, action }),
          }),
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message ?? t("verifCaisse.erreur"));
          return;
        }
        setResultat(data);
      } catch {
        setErreur(t("verifCaisse.erreur"));
      } finally {
        setEnvoi(false);
      }
    },
    [jeton, t],
  );

  const lienValide = jeton !== "" && actionLien !== null && ACTIONS.includes(actionLien);

  useEffect(() => {
    if (!lienValide || dejaEnvoye.current) return;
    dejaEnvoye.current = true;
    choisir(actionLien as Action);
  }, [lienValide, actionLien, choisir]);

  const jourLisible = (jour: string) =>
    new Date(`${jour}T12:00:00.000Z`).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  // Les deux autres choix, pour changer d'avis
  const autresActions = ACTIONS.filter((a) => {
    if (!resultat) return false;
    const statutDeLAction = { confirmer: "confirmee", verifier: "a_verifier", signaler: "signalee" }[a];
    return statutDeLAction !== resultat.statut;
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <BoutonLangue />
        </div>

        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">
            {resultat?.centre ?? t("app.titre")}
          </p>
          <h1 className="mt-2 text-3xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {t("verifCaisse.pageTitre")}
          </h1>
        </div>

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 text-center shadow-sm sm:p-8">
          {!lienValide && <p className="text-sm text-ink-soft">{t("verifCaisse.lienIncomplet")}</p>}

          {lienValide && envoi && !resultat && (
            <p className="text-sm text-ink-soft">{t("verifCaisse.enregistrement")}</p>
          )}

          {erreur && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{erreur}</p>}

          {resultat && (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-ink">{t("verifCaisse.note")}</p>
              <div>
                <p className="text-sm text-ink-soft">
                  {t("verifCaisse.caisseDe", { personne: resultat.personne, jour: jourLisible(resultat.jour) })}
                </p>
                <p className="mt-1 text-2xl font-bold text-ink">{resultat.total.toLocaleString(locale)} F</p>
              </div>
              <p className="text-sm font-medium text-ink">
                {t("verifCaisse.tonChoix", { statut: t(`verifCaisse.statut.${resultat.statut}`) })}
              </p>

              <div className="border-t border-ink/10 pt-4">
                <p className="mb-2 text-xs text-ink-soft">{t("verifCaisse.changer")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {autresActions.map((a) => (
                    <button
                      key={a}
                      onClick={() => choisir(a)}
                      disabled={envoi}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${STYLE_BOUTON[a]}`}
                    >
                      {t(`verifCaisse.${a}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <Link href="/bienvenue" className="inline-block pt-2 text-sm font-medium text-accent hover:underline">
            {t("verifCaisse.ouvrirApp")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PageVerificationCaisse() {
  return (
    <Suspense fallback={null}>
      <VerificationCaisse />
    </Suspense>
  );
}