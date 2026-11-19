"use client";

import { Fragment, useEffect, useState } from "react";

/**
 * Découpe une liste en pages, pour éviter de trop défiler.
 *
 * - `usePagination(liste, parPage)` donne les éléments de la page affichée ;
 * - `<Pagination />` affiche « Page 2 sur 5 » et les boutons.
 *
 * Quand la liste change de taille ou que `cleReinit` change (recherche,
 * filtre, jour choisi), on revient à la première page.
 */
export function usePagination<T>(liste: T[], parPage = 15, cleReinit = "") {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(liste.length / parPage));

  // On compare la taille (et une clé de filtre), pas la liste elle-même :
  // une liste recalculée à chaque affichage ramènerait sinon toujours à la page 1
  useEffect(() => {
    setPage(1);
  }, [liste.length, cleReinit]);

  const pageEffective = Math.min(page, totalPages);
  const debut = (pageEffective - 1) * parPage;

  return {
    page: pageEffective,
    setPage,
    totalPages,
    total: liste.length,
    /** Position du premier élément de la page dans toute la liste (0, 15, 30…) */
    debut,
    elements: liste.slice(debut, debut + parPage),
  };
}

export default function Pagination({
  page,
  totalPages,
  onChange,
  texte,
  precedent = "Précédent",
  suivant = "Suivant",
  className = "",
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Ex. : « Page 2 sur 5 — 70 facture(s) » */
  texte: string;
  precedent?: string;
  suivant?: string;
  className?: string;
}) {
  // Une seule page : rien à afficher
  if (totalPages <= 1) return null;

  // On montre la 1re, la dernière, et les pages autour de la page affichée
  const numeros = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1,
  );

  function aller(n: number) {
    onChange(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft ${className}`}>
      <p>{texte}</p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={() => aller(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-ink/15 px-3 py-2 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          {precedent}
        </button>

        {numeros.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && numeros[i - 1] !== n - 1 && <span className="px-1 text-ink-soft">…</span>}
            <button
              onClick={() => aller(n)}
              className={
                "rounded-lg px-3 py-2 font-medium transition " +
                (n === page ? "bg-accent text-white" : "border border-ink/15 text-ink hover:bg-paper")
              }
            >
              {n}
            </button>
          </Fragment>
        ))}

        <button
          onClick={() => aller(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {suivant}
        </button>
      </div>
    </div>
  );
}