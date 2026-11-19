"use client";

import { useLangue, type Langue } from "../lib/langue";

const LANGUES: Langue[] = ["fr", "en"];

// Petit interrupteur FR | EN
export default function BoutonLangue({ className = "" }: { className?: string }) {
  const { langue, changerLangue, t } = useLangue();

  return (
    <div
      role="group"
      aria-label={t("langue.choisir")}
      className={`inline-flex gap-0.5 rounded-full border border-ink/10 bg-white p-[3px] ${className}`}
    >
      {LANGUES.map((code) => {
        const actif = code === langue;
        return (
          <button
            key={code}
            type="button"
            onClick={() => changerLangue(code)}
            aria-pressed={actif}
            title={code === "fr" ? t("langue.francais") : t("langue.anglais")}
            className={
              "min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition " +
              (actif ? "bg-accent text-white" : "text-ink-soft hover:text-ink")
            }
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}