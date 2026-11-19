"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

type User = {
  nom: string;
  email: string;
  role: string;
};

type EntreeHistorique = {
  _id: string;
  utilisateurEmail: string;
  utilisateurNom?: string;
  action: string;
  module: string;
  details?: string;
  statut: "succès" | "échec";
  date: string;
};

type Raccourci = {
  href: string;
  label: string;
  // Tracés SVG de l'icône
  icone: React.ReactNode;
};

export default function BienvenuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [recentes, setRecentes] = useState<EntreeHistorique[]>([]);
  const { t, locale } = useLangue();

  // "il y a 12 min", "il y a 3 h", sinon la date
  function quandLisible(date: string): string {
    const ecartMinutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
    if (ecartMinutes < 1) return t("accueil.aLInstant");
    if (ecartMinutes < 60) return t("accueil.ilYaMinutes", { n: ecartMinutes });
    const ecartHeures = Math.round(ecartMinutes / 60);
    if (ecartHeures < 24) return t("accueil.ilYaHeures", { n: ecartHeures });
    return new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short" });
  }

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  // Activité récente : réservée à l'administrateur, comme avant
  useEffect(() => {
    if (user?.role !== "admin") return;
    async function chargerRecentes() {
      const res = await apiFetch("/historique?limite=5&page=1");
      if (res.ok) {
        const data = await res.json();
        setRecentes(data.donnees ?? []);
      }
    }
    chargerRecentes();
  }, [user]);

  if (!user) {
    return null;
  }

  const estAdmin = user.role === "admin";
  const prenom = user.nom.split(/\s+/)[0] ?? user.nom;
  const aujourdhui = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Icônes au trait des raccourcis
  const ICONES = {
    candidats: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </>
    ),
    factures: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    caisse: (
      <>
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <circle cx="12" cy="12.5" r="2.5" />
        <path d="M6 9.5h.01M18 15.5h.01" />
      </>
    ),
    tableau: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </>
    ),
  };

  // Trois raccourcis seulement : ce qu'on ouvre le plus souvent. Le reste
  // est dans le menu.
  // - Secrétaire : Candidats, Factures, Ma caisse
  // - Administrateur : Candidats, Point de caisse, Tableau de bord
  const raccourcis: Raccourci[] = estAdmin
    ? [
        { href: "/candidats", label: t("menu.candidats"), icone: ICONES.candidats },
        { href: "/point-de-caisse", label: t("menu.pointDeCaisse"), icone: ICONES.caisse },
        { href: "/tableau-de-bord", label: t("menu.tableauDeBord"), icone: ICONES.tableau },
      ]
    : [
        { href: "/candidats", label: t("menu.candidats"), icone: ICONES.candidats },
        { href: "/factures", label: t("menu.factures"), icone: ICONES.factures },
        { href: "/point-de-caisse", label: t("caisse.maCaisse"), icone: ICONES.caisse },
      ];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-9">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* ---------- Bonjour ---------- */}
        <div>
          <p className="text-sm capitalize text-ink-soft">{aujourdhui}</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
            {t("accueil.bonjour", { prenom })}
          </h1>
        </div>

        {/* ---------- Nouvelle facture : toute la largeur ---------- */}
        <Link
          href="/enregistrement"
          className="flex items-center gap-4 rounded-2xl bg-accent p-5 text-white transition hover:bg-accent-hover sm:p-6"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span>
            <span className="block text-[17px] font-semibold sm:text-lg">
              {t("menu.nouvelleFacture")}
            </span>
            <span className="block text-sm text-white/90">
              {t("accueil.nouvelleFactureDetail")}
            </span>
          </span>
        </Link>

        {/* ---------- Trois raccourcis, toujours sur une seule ligne ---------- */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {raccourcis.map((raccourci) => (
            <Link
              key={raccourci.href}
              href={raccourci.href}
              className="flex h-full min-h-[96px] flex-col justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-3.5 text-ink transition hover:border-accent/40 sm:p-5"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                aria-hidden="true"
              >
                {raccourci.icone}
              </svg>
              <span className="text-sm font-semibold leading-tight sm:text-[15px]">{raccourci.label}</span>
            </Link>
          ))}
        </div>

        {/* ---------- Activité récente (administrateur) ---------- */}
        {estAdmin && (
          <section className="rounded-2xl border border-ink/10 bg-white px-4 py-1 sm:px-6">
            <div className="flex items-center justify-between py-3">
              <h2 className="text-base font-semibold text-ink sm:text-[17px]">
                {t("accueil.activiteRecente")}
              </h2>
              <Link
                href="/historique"
                className="py-2 text-sm font-medium text-accent hover:underline"
              >
                {t("accueil.toutVoir")}
              </Link>
            </div>

            {recentes.length === 0 ? (
              <p className="border-t border-ink/5 py-4 text-sm text-ink-soft">
                {t("accueil.aucuneAction")}
              </p>
            ) : (
              <ul>
                {recentes.map((entree) => (
                  <li
                    key={entree._id}
                    className="flex items-start gap-3 border-t border-ink/5 py-3"
                  >
                    <span
                      className={
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                        (entree.statut === "succès" ? "bg-accent" : "bg-error")
                      }
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        {entree.action} — {entree.details || entree.module}
                        {entree.statut !== "succès" && (
                          <span className="ml-2 rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
                            {t("accueil.echec")}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        {t("accueil.par", { nom: entree.utilisateurNom || entree.utilisateurEmail })} ·{" "}
                        {quandLisible(entree.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}