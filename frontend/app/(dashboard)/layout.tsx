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

type NomIcone =
  | "accueil"
  | "candidats"
  | "classes"
  | "tableau"
  | "utilisateurs"
  | "factures"
  | "historique"
  | "parametres"
  | "plus"
  | "menu"
  | "fermer"
  | "sortir";

const LIBELLE_ROLE: Record<string, string> = {
  admin: "Administrateur",
  secretariat: "Secrétariat",
};

// Petites icônes au trait, dessinées en SVG (pas d'emoji)
function Icone({ nom, taille = 20 }: { nom: NomIcone; taille?: number }) {
  const traits: Record<NomIcone, React.ReactNode> = {
    accueil: <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
    candidats: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </>
    ),
    classes: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    tableau: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </>
    ),
    utilisateurs: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </>
    ),
    factures: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ),
    historique: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    parametres: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    fermer: <path d="M6 6l12 12M18 6L6 18" />,
    sortir: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </>
    ),
  };

  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {traits[nom]}
    </svg>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [pret, setPret] = useState(false);
  const [identiteCentre, setIdentiteCentre] = useState<IdentiteCentre | null>(null);
  // Menu complet ouvert sur téléphone (bouton « Menu » de la barre du bas)
  const [menuOuvert, setMenuOuvert] = useState(false);
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

  // Quand on change de page, le menu du téléphone se referme
  useEffect(() => {
    setMenuOuvert(false);
  }, [pathname]);

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
  const initiales = nomCentre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join("");

  const liens: { href: string; label: string; icone: NomIcone; visible: boolean }[] = [
    { href: "/bienvenue", label: "Accueil", icone: "accueil", visible: true },
    { href: "/candidats", label: "Liste des candidats", icone: "candidats", visible: true },
    { href: "/classes", label: "Classes", icone: "classes", visible: true },
    { href: "/factures", label: "Factures", icone: "factures", visible: true },
    { href: "/tableau-de-bord", label: "Tableau de bord", icone: "tableau", visible: estAdmin },
    { href: "/utilisateurs", label: "Utilisateurs", icone: "utilisateurs", visible: estAdmin },
    { href: "/historique", label: "Historique", icone: "historique", visible: estAdmin },
    // Paramètres du centre (les tarifs sont dans l'onglet Services)
    { href: "/parametres", label: "Paramètres", icone: "parametres", visible: estAdmin },
  ];
  const liensVisibles = liens.filter((l) => l.visible);

  function estActif(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // Logo du centre, ou ses initiales s'il n'a pas de logo
  const marqueCentre = (
    <Link href="/bienvenue" className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={nomCentre ? `Logo de ${nomCentre}` : "Logo du centre"}
          className="h-10 w-auto max-w-[120px] shrink-0 object-contain"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-sm font-bold text-accent">
          {initiales}
        </span>
      )}
      <span className="truncate text-[15px] font-semibold text-ink">{nomCentre}</span>
    </Link>
  );

  const blocUtilisateur = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{user.nom}</p>
        <p className="text-[13px] text-ink-soft">{LIBELLE_ROLE[user.role] ?? user.role}</p>
      </div>
      <button
        onClick={handleLogout}
        aria-label="Se déconnecter"
        title="Se déconnecter"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft transition hover:bg-paper hover:text-error"
      >
        <Icone nom="sortir" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* ---------- Ordinateur : menu à gauche ---------- */}
      <aside className="hidden w-64 shrink-0 flex-col gap-5 border-r border-ink/10 bg-white px-3.5 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="px-2">{marqueCentre}</div>

        <Link
          href="/enregistrement"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-hover"
        >
          <Icone nom="plus" taille={18} />
          Nouvelle facture
        </Link>

        <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {liensVisibles.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition " +
                (estActif(lien.href)
                  ? "bg-accent/10 font-semibold text-ink"
                  : "font-medium text-ink-soft hover:bg-paper hover:text-ink")
              }
            >
              <span className={estActif(lien.href) ? "text-accent" : ""}>
                <Icone nom={lien.icone} />
              </span>
              {lien.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-ink/10 px-2 pt-4">{blocUtilisateur}</div>
      </aside>

      {/* ---------- Téléphone : barre du haut ---------- */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink/10 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0 flex-1">{marqueCentre}</div>
      </header>

      {/* Sur téléphone, on laisse de la place en bas pour la barre de menu */}
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>

      {/* ---------- Téléphone : barre du bas ---------- */}
      <nav
        aria-label="Menu rapide"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink/10 bg-white px-1 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      >
        <Link
          href="/bienvenue"
          className={
            "flex min-h-12 flex-col items-center justify-center gap-1 text-xs " +
            (estActif("/bienvenue") ? "font-semibold text-accent" : "font-medium text-ink-soft")
          }
        >
          <Icone nom="accueil" taille={22} />
          Accueil
        </Link>
        <Link
          href="/candidats"
          className={
            "flex min-h-12 flex-col items-center justify-center gap-1 text-xs " +
            (estActif("/candidats") ? "font-semibold text-accent" : "font-medium text-ink-soft")
          }
        >
          <Icone nom="candidats" taille={22} />
          Candidats
        </Link>
        <Link
          href="/enregistrement"
          aria-label="Nouvelle facture"
          className="flex items-center justify-center"
        >
          <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
            <Icone nom="plus" taille={26} />
          </span>
        </Link>
        <Link
          href="/factures"
          className={
            "flex min-h-12 flex-col items-center justify-center gap-1 text-xs " +
            (estActif("/factures") ? "font-semibold text-accent" : "font-medium text-ink-soft")
          }
        >
          <Icone nom="factures" taille={22} />
          Factures
        </Link>
        <button
          type="button"
          onClick={() => setMenuOuvert(true)}
          aria-expanded={menuOuvert}
          className="flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-soft"
        >
          <Icone nom="menu" taille={22} />
          Menu
        </button>
      </nav>

      {/* ---------- Téléphone : menu complet ---------- */}
      {menuOuvert && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMenuOuvert(false)}
            className="absolute inset-0 h-full w-full bg-ink/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="px-2 text-base font-semibold text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setMenuOuvert(false)}
                aria-label="Fermer le menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-paper"
              >
                <Icone nom="fermer" />
              </button>
            </div>
            <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
              {liensVisibles.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className={
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] transition " +
                    (estActif(lien.href)
                      ? "bg-accent/10 font-semibold text-ink"
                      : "font-medium text-ink-soft hover:bg-paper")
                  }
                >
                  <span className={estActif(lien.href) ? "text-accent" : ""}>
                    <Icone nom={lien.icone} />
                  </span>
                  {lien.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-ink/10 px-2 pt-4">{blocUtilisateur}</div>
          </div>
        </div>
      )}

      {/* Rappel de configuration : administrateur uniquement */}
      {estAdmin && user.centreId && <DialogueConfiguration centreId={String(user.centreId)} />}
    </div>
  );
}