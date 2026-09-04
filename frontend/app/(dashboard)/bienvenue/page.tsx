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

const LABEL_ROLE: Record<string, string> = {
  admin: "Administrateur",
  secretariat: "Secrétariat",
};

export default function BienvenuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [recentes, setRecentes] = useState<EntreeHistorique[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-4xl grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white p-10 text-center shadow-sm">
          <h1
            className="text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Bienvenue, {user.nom}
          </h1>

          <span className="mt-4 inline-block rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
            {LABEL_ROLE[user.role] ?? user.role}
          </span>

          <div className="mt-8 flex flex-col gap-3">
           <Link
              href="/enregistrement"
              className="rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover"
            >
              Enregistrer un candidat
            </Link>
            <Link
              href="/candidats"
              className="rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper"
            >
              Voir la liste des candidats
            </Link>
          </div>
        </div>

        {user.role === "admin" && (
          <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-ink">
                Dernières modifications
              </h2>
              <Link
                href="/historique"
                className="text-sm font-medium text-seal hover:underline"
              >
                Voir tout
              </Link>
            </div>

            {recentes.length === 0 ? (
              <p className="text-sm text-ink-soft">Aucune action récente.</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {recentes.map((entree) => (
                  <li key={entree._id} className="py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        {entree.action} — {entree.details || entree.module}
                      </span>
                      <span
                        className={
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium " +
                          (entree.statut === "succès"
                            ? "bg-accent/10 text-accent"
                            : "bg-error/10 text-error")
                        }
                      >
                        {entree.statut}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {entree.utilisateurNom || entree.utilisateurEmail} —{" "}
                      {new Date(entree.date).toLocaleString("fr-FR")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}