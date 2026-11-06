"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";

type ElementConfiguration = {
  cle: string;
  libelle: string;
  fait: boolean;
  lien?: string;
};

// Bandeau affiché à l'administrateur tant que son centre n'est pas entièrement
// configuré. Il peut le fermer : il ne revient plus sur ce navigateur.
export default function BandeauConfiguration({ centreId }: { centreId: string }) {
  const cleStockage = `bandeau-configuration-ferme:${centreId}`;
  const pathname = usePathname();

  const [aFaire, setAFaire] = useState<ElementConfiguration[]>([]);
  const [visible, setVisible] = useState(false);

  // Rechargé à chaque changement de page : un élément fait disparaît tout de suite
  useEffect(() => {
    let dejaFerme = false;
    try {
      dejaFerme = localStorage.getItem(cleStockage) === "1";
    } catch {
      // stockage indisponible : on affiche quand même le bandeau
    }
    if (dejaFerme) {
      setVisible(false);
      return;
    }

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
        // serveur injoignable : pas de bandeau
      }
    }
    charger();
  }, [cleStockage, pathname]);

  function fermer() {
    try {
      localStorage.setItem(cleStockage, "1");
    } catch {
      // stockage indisponible : le bandeau est fermé pour cette visite seulement
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="border-b border-seal/30 bg-seal/10 px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">
            Termine la configuration de ton centre
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
            {aFaire.map((element) => (
              <li key={element.cle} className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-seal" aria-hidden="true" />
                {element.lien ? (
                  <Link href={element.lien} className="text-seal hover:underline">
                    {element.libelle}
                  </Link>
                ) : (
                  <span>{element.libelle}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer le bandeau"
          className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-ink-soft transition hover:bg-white hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}