"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

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

// "il y a 12 min", "il y a 3 h", sinon la date
function quandLisible(date: string): string {
  const ecartMinutes = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (ecartMinutes < 1) return "à l'instant";
  if (ecartMinutes < 60) return `il y a ${ecartMinutes} min`;
  const ecartHeures = Math.round(ecartMinutes / 60);
  if (ecartHeures < 24) return `il y a ${ecartHeures} h`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function BienvenuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [recentes, setRecentes] = useState<EntreeHistorique[]>([]);

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
  const aujourdhui = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const raccourcis: Raccourci[] = [
    {
      href: "/candidats",
      label: "Candidats",
      icone: (
        <>
          <circle cx="9" cy="7" r="4" />
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        </>
      ),
    },
    {
      href: "/factures",
      label: "Factures",
      icone: (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </>
      ),
    },
    {
      href: "/classes",
      label: "Classes",
      icone: (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      ),
    },
  ];
  if (estAdmin) {
    raccourcis.push({
      href: "/tableau-de-bord",
      label: "Tableau de bord",
      icone: (
        <>
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 3 3 5-6" />
        </>
      ),
    });
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-9">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* ---------- Bonjour ---------- */}
        <div>
          <p className="text-sm capitalize text-ink-soft">{aujourdhui}</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
            Bonjour, {prenom}
          </h1>
        </div>

        {/* ---------- Nouvelle facture + raccourcis ---------- */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Link
            href="/enregistrement"
            className="col-span-2 flex items-center gap-4 rounded-2xl bg-accent p-5 text-white transition hover:bg-accent-hover sm:p-6"
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
              <span className="block text-[17px] font-semibold sm:text-lg">Nouvelle facture</span>
              <span className="block text-sm text-white/90">
                Enregistrer un candidat et son paiement
              </span>
            </span>
          </Link>

          {raccourcis.map((raccourci) => (
            <Link
              key={raccourci.href}
              href={raccourci.href}
              className="flex min-h-[92px] flex-col gap-2.5 rounded-2xl border border-ink/10 bg-white p-4 text-ink transition hover:border-accent/40 sm:p-5"
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
              <span className="text-[15px] font-semibold">{raccourci.label}</span>
            </Link>
          ))}
        </div>

        {/* ---------- Activité récente (administrateur) ---------- */}
        {estAdmin && (
          <section className="rounded-2xl border border-ink/10 bg-white px-4 py-1 sm:px-6">
            <div className="flex items-center justify-between py-3">
              <h2 className="text-base font-semibold text-ink sm:text-[17px]">Activité récente</h2>
              <Link
                href="/historique"
                className="py-2 text-sm font-medium text-accent hover:underline"
              >
                Tout voir
              </Link>
            </div>

            {recentes.length === 0 ? (
              <p className="border-t border-ink/5 py-4 text-sm text-ink-soft">
                Aucune action récente.
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
                            échec
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        Par {entree.utilisateurNom || entree.utilisateurEmail} ·{" "}
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