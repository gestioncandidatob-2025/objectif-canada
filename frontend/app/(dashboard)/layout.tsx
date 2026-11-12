"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import DialogueConfiguration from "../components/DialogueConfiguration";
import { apiFetch } from "../lib/api";
import { EVENEMENT_CENTRE_MODIFIE } from "../lib/centre";
import { useLangue } from "../lib/langue";
import BoutonLangue from "../components/BoutonLangue";
import BarreRecherche from "../components/BarreRecherche";
import AssistantFlottant from "../components/AssistantFlottant";
import BandeauAbonnement, { FacturationBloquee } from "../components/BandeauAbonnement";
import { useEtatAbonnement } from "../lib/abonnement";

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
  | "caisse"
  | "abonnement"
  | "historique"
  | "parametres"
  | "plus"
  | "menu"
  | "fermer"
  | "sortir";

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
    caisse: (
      <>
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <circle cx="12" cy="12.5" r="2.5" />
        <path d="M6 9.5h.01M18 15.5h.01" />
      </>
    ),
    abonnement: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
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
  const { t } = useLangue();
  // Abonnement du centre : rechargé à chaque changement de page (les quotas bougent)
  const etatAbonnement = useEtatAbonnement(pret, pathname);

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
    { href: "/bienvenue", label: t("menu.accueil"), icone: "accueil", visible: true },
    { href: "/candidats", label: t("menu.listeCandidats"), icone: "candidats", visible: true },
    { href: "/groupes", label: t("menu.groupes"), icone: "classes", visible: true },
    { href: "/factures", label: t("menu.factures"), icone: "factures", visible: true },
    // Point de caisse : l'admin voit celui de chaque personne, la secrétaire le sien
    { href: "/point-de-caisse", label: t("menu.pointDeCaisse"), icone: "caisse", visible: true },
    { href: "/tableau-de-bord", label: t("menu.tableauDeBord"), icone: "tableau", visible: estAdmin },
    { href: "/utilisateurs", label: t("menu.utilisateurs"), icone: "utilisateurs", visible: estAdmin },
    { href: "/historique", label: t("menu.historique"), icone: "historique", visible: estAdmin },
    // Plan, quotas et paiement de l'abonnement (CamPay)
    { href: "/abonnement", label: t("menu.abonnement"), icone: "abonnement", visible: estAdmin },
    // Paramètres du centre (les tarifs sont dans l'onglet Services)
    { href: "/parametres", label: t("menu.parametres"), icone: "parametres", visible: estAdmin },
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
          alt={nomCentre ? t("menu.logoDe", { nom: nomCentre }) : t("menu.logoDuCentre")}
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
        <p className="text-[13px] text-ink-soft">
          {user.role === "admin" || user.role === "secretariat" ? t(`roles.${user.role}`) : user.role}
        </p>
      </div>
      <button
        onClick={handleLogout}
        aria-label={t("menu.seDeconnecter")}
        title={t("menu.seDeconnecter")}
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
          {t("menu.nouvelleFacture")}
        </Link>

        <nav aria-label={t("menu.principal")} className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
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

        <div className="flex flex-col gap-3 border-t border-ink/10 px-2 pt-4">
          {blocUtilisateur}
          <BoutonLangue className="self-start" />
        </div>
      </aside>

      {/* ---------- Téléphone : barre du haut ---------- */}
      <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-ink/10 bg-white px-4 py-3 lg:hidden">
        <div className="min-w-0">{marqueCentre}</div>
        <BarreRecherche />
      </header>

      {/* Sur téléphone, on laisse de la place en bas pour la barre de menu */}
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">
        {/* ---------- Ordinateur : barre de recherche en haut de chaque page ---------- */}
        <div className="sticky top-0 z-20 hidden border-b border-ink/10 bg-paper/95 px-8 py-3 backdrop-blur lg:block">
          <div className="mx-auto max-w-5xl">
            <BarreRecherche />
          </div>
        </div>
        <BandeauAbonnement etat={etatAbonnement} estAdmin={estAdmin} />
        {/* Plus de nouvelle facture possible : on l'explique au lieu d'afficher le formulaire */}
        {etatAbonnement && !etatAbonnement.peutFacturer && estActif("/enregistrement") ? (
          <FacturationBloquee estAdmin={estAdmin} />
        ) : (
          children
        )}
      </main>

      {/* ---------- Téléphone : barre du bas ---------- */}
      <nav
        aria-label={t("menu.rapide")}
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
          {t("menu.accueil")}
        </Link>
        <Link
          href="/candidats"
          className={
            "flex min-h-12 flex-col items-center justify-center gap-1 text-xs " +
            (estActif("/candidats") ? "font-semibold text-accent" : "font-medium text-ink-soft")
          }
        >
          <Icone nom="candidats" taille={22} />
          {t("menu.candidats")}
        </Link>
        <Link
          href="/enregistrement"
          aria-label={t("menu.nouvelleFacture")}
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
          {t("menu.factures")}
        </Link>
        <button
          type="button"
          onClick={() => setMenuOuvert(true)}
          aria-expanded={menuOuvert}
          className="flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-soft"
        >
          <Icone nom="menu" taille={22} />
          {t("menu.menu")}
        </button>
      </nav>

      {/* ---------- Téléphone : menu complet ---------- */}
      {menuOuvert && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("menu.menu")}>
          <button
            type="button"
            aria-label={t("menu.fermer")}
            onClick={() => setMenuOuvert(false)}
            className="absolute inset-0 h-full w-full bg-ink/40"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-6 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="px-2 text-base font-semibold text-ink">{t("menu.menu")}</span>
              <button
                type="button"
                onClick={() => setMenuOuvert(false)}
                aria-label={t("menu.fermer")}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:bg-paper"
              >
                <Icone nom="fermer" />
              </button>
            </div>
            <nav aria-label={t("menu.principal")} className="flex flex-col gap-0.5">
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
            <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 px-2 pt-4">
              {blocUtilisateur}
              <BoutonLangue className="self-start" />
            </div>
          </div>
        </div>
      )}

      {/* Assistant IA : bouton rond en bas à droite, administrateur uniquement */}
      {estAdmin && <AssistantFlottant />}

      {/* Rappel de configuration : administrateur uniquement */}
      {estAdmin && user.centreId && <DialogueConfiguration centreId={String(user.centreId)} />}
    </div>
  );
}