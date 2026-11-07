"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import DialogueConfiguration from "../components/DialogueConfiguration";
import { apiFetch } from "../lib/api";
import { EVENEMENT_CENTRE_MODIFIE } from "../lib/centre";

type User = {
  nom: string;
  role: string;
  centreId?: string;
  nomCentre?: string;
};

// Ce que le menu affiche en haut : le logo du centre, ou son nom s'il n'a pas de logo
type IdentiteCentre = {
  nom: string;
  logoUrl: string | null;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [pret, setPret] = useState(false);
  const [identiteCentre, setIdentiteCentre] = useState<IdentiteCentre | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.push("/login");
      return;
    }
    const utilisateur = JSON.parse(userStr);
    // Le super admin n'appartient à aucun centre : il a son propre espace
    if (utilisateur.role === "super_admin") {
      router.replace("/super-admin");
      return;
    }
    setUser(utilisateur);
    setPret(true);
  }, [router]);

  // Logo et nom du centre, pour tous les utilisateurs du centre (admin et
  // secrétaires). Rechargés dès que l'admin modifie les paramètres.
  useEffect(() => {
    if (!pret) return;

    async function chargerIdentiteCentre() {
      try {
        const res = await apiFetch("/center/settings");
        if (!res.ok) return;
        const data = await res.json();
        setIdentiteCentre({ nom: data.nom, logoUrl: data.logoUrl ?? null });
      } catch {
        // serveur injoignable : on garde le nom du centre déjà connu
      }
    }

    chargerIdentiteCentre();
    window.addEventListener(EVENEMENT_CENTRE_MODIFIE, chargerIdentiteCentre);
    return () => window.removeEventListener(EVENEMENT_CENTRE_MODIFIE, chargerIdentiteCentre);
  }, [pret]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  if (!pret || !user) {
    return null;
  }

  const estAdmin = user.role === "admin";

  // En attendant la réponse du serveur, on affiche le nom du centre gardé à la connexion
  const nomCentre = identiteCentre?.nom ?? user.nomCentre ?? "";
  const logoUrl = identiteCentre?.logoUrl ?? null;

  const liens = [
    { href: "/bienvenue", label: "Accueil", visible: true },
    { href: "/enregistrement", label: "Enregistrement", visible: true },
    { href: "/candidats", label: "Liste des candidats", visible: true },
    // Groupes de candidats (remplacent les anciennes classes Jour/Soir)
    { href: "/groupes", label: "Groupes", visible: true },
    { href: "/tableau-de-bord", label: "Tableau de bord", visible: estAdmin },
    { href: "/utilisateurs", label: "Utilisateurs", visible: estAdmin },
    { href: "/factures", label: "Factures", visible: true },
    { href: "/historique", label: "Historique", visible: estAdmin },
    // Paramètres du centre (les tarifs sont dans l'onglet Services)
    { href: "/parametres", label: "Paramètres", visible: estAdmin },
  ];

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-64 shrink-0 flex-col border-r border-ink/10 bg-white px-5 py-6">
        <Link href="/bienvenue" className="mb-8 flex min-h-14 items-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={nomCentre ? `Logo de ${nomCentre}` : "Logo du centre"}
              className="h-14 w-auto max-w-full object-contain"
            />
          ) : (
            // Pas de logo : on affiche le nom du centre (jamais le logo d'un autre centre)
            <span
              className="text-xl leading-tight text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {nomCentre}
            </span>
          )}
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {liens
            .filter((l) => l.visible)
            .map((lien) => {
              const actif = pathname === lien.href;
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={
                    "rounded-lg px-4 py-2.5 text-sm font-medium transition " +
                    (actif
                      ? "bg-accent text-white"
                      : "text-ink-soft hover:bg-paper hover:text-ink")
                  }
                >
                  {lien.label}
                </Link>
              );
            })}
        </nav>

        <div className="mt-6 border-t border-ink/10 pt-4">
          <p className="mb-2 text-xs text-ink-soft">
            Connecté : <span className="font-medium text-ink">{user.nom}</span>
          </p>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-ink-soft transition hover:text-error"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Rappel de configuration : administrateur uniquement */}
      {estAdmin && user.centreId && <DialogueConfiguration centreId={String(user.centreId)} />}
    </div>
  );
}