"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";

type ElementConfiguration = {
  cle: string;
  libelle: string;
  fait: boolean;
};

// Fenêtre affichée à l'administrateur tant que son centre n'est pas
// entièrement configuré. Elle apparaît une fois par session : si
// l'administrateur clique « Plus tard », elle revient à sa prochaine visite.
export default function DialogueConfiguration({ centreId }: { centreId: string }) {
  const cleSession = `dialogue-configuration-vu:${centreId}`;
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLangue();

  const [aFaire, setAFaire] = useState<ElementConfiguration[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Pas de fenêtre sur la page Paramètres : l'administrateur y est déjà
    if (pathname.startsWith("/parametres")) {
      setVisible(false);
      return;
    }

    let dejaVu = false;
    try {
      dejaVu = sessionStorage.getItem(cleSession) === "1";
    } catch {
      // stockage indisponible : on affiche quand même la fenêtre
    }
    if (dejaVu) return;

    async function charger() {
      try {
        const res = await apiFetch("/center/setup-status");
        if (!res.ok) return;
        const data = await res.json();
        const restants: ElementConfiguration[] = (data.elements ?? []).filter(
          (element: ElementConfiguration) => !element.fait,
        );
        setAFaire(restants);
        setVisible(restants.length > 0);
      } catch {
        // serveur injoignable : pas de fenêtre
      }
    }
    charger();
  }, [cleSession, pathname]);

  function memoriserVu() {
    try {
      sessionStorage.setItem(cleSession, "1");
    } catch {
      // stockage indisponible : la fenêtre pourra réapparaître
    }
  }

  function plusTard() {
    memoriserVu();
    setVisible(false);
  }

  function allerAuxParametres() {
    memoriserVu();
    setVisible(false);
    router.push("/parametres");
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-dialogue-configuration"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2
          id="titre-dialogue-configuration"
          className="text-2xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("dialogue.titre")}
        </h2>
        <p className="mt-3 text-sm text-ink-soft">{t("dialogue.texte")}</p>

        <ul className="mt-4 space-y-2">
          {aFaire.map((element) => (
            <li key={element.cle} className="flex items-center gap-3 text-sm text-ink">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-seal"
                aria-hidden="true"
              />
              {/* Texte traduit d'après la clé ; le libellé du serveur sert de secours */}
              {t(`dialogue.elements.${element.cle}`) === `dialogue.elements.${element.cle}`
                ? element.libelle
                : t(`dialogue.elements.${element.cle}`)}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={plusTard}
            className="rounded-lg border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-paper"
          >
            {t("dialogue.plusTard")}
          </button>
          <button
            type="button"
            onClick={allerAuxParametres}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            {t("dialogue.allerParametres")}
          </button>
        </div>
      </div>
    </div>
  );
}