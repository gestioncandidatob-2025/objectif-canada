"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { jetonExpire, terminerSession, useSurveillanceSession } from "../lib/session";

/**
 * Cadre commun de l'espace super admin (équipe HREFF) :
 * menu à gauche sur ordinateur, barre en haut sur téléphone.
 */

const LIENS = [
  {
    href: "/super-admin",
    label: "Centres",
    icone: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M3 21V8l9-5 9 5v13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/super-admin/plans",
    label: "Plans",
    icone: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M3 12V4h8l10 10-8 8L3 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="7.5" cy="8.5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/super-admin/paiements",
    label: "Paiements",
    icone: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/super-admin/transactions",
    label: "Transactions",
    icone: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/super-admin/suivi",
    label: "À suivre",
    icone: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/super-admin/reglage",
    label: "Régler un abonnement",
    icone: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const chemin = usePathname();
  const [nom, setNom] = useState("");
  const [pret, setPret] = useState(false);

  // Session expirée pendant que la page est ouverte : retour à la connexion
  useSurveillanceSession(pret);

  // Seul le super admin a accès à cet espace (vérifié ici pour toutes les pages)
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const utilisateur = JSON.parse(localStorage.getItem("user") ?? "{}");
      if (!token || !utilisateur.role) {
        router.replace("/login");
        return;
      }
      if (jetonExpire(token)) {
        terminerSession("expiree");
        return;
      }
      if (utilisateur.role !== "super_admin") {
        router.replace("/bienvenue");
        return;
      }
      setNom(utilisateur.nom ?? "");
      setPret(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  function deconnexion() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  }

  if (!pret) return null;

  const initiales =
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((mot) => mot.charAt(0).toUpperCase())
      .join("") || "SA";

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* ---------- Ordinateur : menu à gauche ---------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-ink px-4 py-6 text-white lg:flex">
        <div>
          <div className="mb-8 flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-seal font-bold text-ink">H</span>
            <div>
              <p className="text-sm font-semibold tracking-[0.2em]">HREFF</p>
              <p className="text-xs text-white/60">Espace super admin</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {LIENS.map((lien) => {
              const actif = chemin === lien.href;
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    actif ? "bg-white text-ink shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {lien.icone}
                  {lien.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rounded-xl bg-white/5 p-3">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {initiales}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{nom || "Super admin"}</p>
              <p className="text-xs text-white/60">Équipe HREFF</p>
            </div>
          </div>
          <button
            onClick={deconnexion}
            className="w-full rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ---------- Téléphone : barre en haut ---------- */}
      <header className="sticky top-0 z-30 bg-ink text-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-seal text-sm font-bold text-ink">H</span>
            <p className="text-sm font-semibold tracking-[0.2em]">HREFF</p>
          </div>
          <button
            onClick={deconnexion}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium"
          >
            Se déconnecter
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-1 px-2 pb-2 sm:grid-cols-3">
          {LIENS.map((lien) => {
            const actif = chemin === lien.href;
            return (
              <Link
                key={lien.href}
                href={lien.href}
                className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium ${
                  actif ? "bg-white text-ink" : "text-white/75"
                }`}
              >
                {lien.icone}
                {lien.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}