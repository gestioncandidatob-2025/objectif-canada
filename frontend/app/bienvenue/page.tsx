"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  nom: string;
  email: string;
  role: string;
};

const LABEL_ROLE: Record<string, string> = {
  admin: "Administrateur",
  secretariat: "Secrétariat",
};

export default function BienvenuePage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md text-center">
        <img
            src="/logo.jpeg"
            alt="Logo"
            className="mx-auto h-20 w-auto object-contain"
          />

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-10 shadow-sm">
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
            <a
              href="/enregistrement"
              className="rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover"
            >
              Enregistrer un candidat
            </a>
            <a
              href="/candidats"
              className="rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper"
            >
              Voir la liste des candidats
            </a>
            {user.role === "admin" && (
              <a
                href="/tableau-de-bord"
                className="rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper"
              >
                Tableau de bord
              </a>
            )}
            {user.role === "admin" && (
              <a
                href="/utilisateurs"
                className="rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper"
              >
                Gestion des utilisateurs
              </a>
            )}
            <button
              onClick={handleLogout}
              className="mt-2 text-sm text-ink-soft transition hover:text-error"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}