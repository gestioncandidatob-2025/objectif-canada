"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";

type CandidatTrouve = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
};

type FactureTrouvee = {
  id: string;
  numeroRecu: string;
  candidatNom: string;
  service: string;
  dateInscription: string;
  montantTotal: number;
  resteAPayer: number;
};

type Resultats = {
  candidats: CandidatTrouve[];
  factures: FactureTrouvee[];
};

// Attente après la dernière lettre tapée avant de lancer la recherche
const DELAI_MS = 300;

/**
 * Barre de recherche du haut de page : on tape un nom, un téléphone ou un
 * numéro de reçu, et les candidats et factures du centre s'affichent.
 */
export default function BarreRecherche() {
  const { t, locale } = useLangue();
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [resultats, setResultats] = useState<Resultats | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  // Recherche lancée 300 ms après la dernière lettre (pas à chaque touche)
  useEffect(() => {
    const recherche = texte.trim();
    if (recherche.length < 2) {
      setResultats(null);
      return;
    }

    let annule = false;
    const minuteur = setTimeout(async () => {
      setEnCours(true);
      try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(recherche)}`);
        if (!annule && res.ok) {
          setResultats(await res.json());
          setOuvert(true);
        }
      } finally {
        if (!annule) setEnCours(false);
      }
    }, DELAI_MS);

    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [texte]);

  // Un clic en dehors de la barre ferme la liste
  useEffect(() => {
    function clicDehors(e: MouseEvent) {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", clicDehors);
    return () => document.removeEventListener("mousedown", clicDehors);
  }, []);

  function aller(chemin: string) {
    setOuvert(false);
    setTexte("");
    setResultats(null);
    router.push(chemin);
  }

  const aucunResultat =
    resultats !== null && resultats.candidats.length === 0 && resultats.factures.length === 0;

  return (
    <div ref={conteneur} className="relative w-full">
      <div className="relative">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onFocus={() => resultats && setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOuvert(false);
          }}
          placeholder={t("recherche.placeholder")}
          aria-label={t("recherche.placeholder")}
          className="h-11 w-full rounded-xl border border-ink/15 bg-white pl-10 pr-3 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {ouvert && (resultats || enCours) && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-ink/10 bg-white p-2 shadow-lg">
          {enCours && !resultats && (
            <p className="px-3 py-2 text-sm text-ink-soft">{t("commun.chargement")}</p>
          )}

          {aucunResultat && (
            <p className="px-3 py-2 text-sm text-ink-soft">{t("recherche.aucunResultat")}</p>
          )}

          {resultats && resultats.candidats.length > 0 && (
            <div className="mb-1">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {t("recherche.candidats")}
              </p>
              {resultats.candidats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => aller(`/candidats/${c.id}`)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-paper"
                >
                  <span className="font-medium text-ink">
                    {c.nom} {c.prenom}
                  </span>
                  <span className="shrink-0 text-sm text-ink-soft">{c.telephone}</span>
                </button>
              ))}
            </div>
          )}

          {resultats && resultats.factures.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {t("recherche.factures")}
              </p>
              {resultats.factures.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => aller(`/recu/${f.id}`)}
                  className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-paper"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-ink">
                      {t("recherche.recuN", { numero: f.numeroRecu })}
                    </span>
                    <span className="shrink-0 text-sm text-ink-soft">
                      {new Date(f.dateInscription).toLocaleDateString(locale)}
                    </span>
                  </span>
                  <span className="text-sm text-ink-soft">
                    {f.candidatNom} · {f.service}
                    {f.resteAPayer > 0
                      ? ` · ${t("recherche.reste", { montant: f.resteAPayer.toLocaleString(locale) })}`
                      : ` · ${t("recherche.solde")}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}