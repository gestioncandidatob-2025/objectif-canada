"use client";

import { ReactNode, useEffect, useRef } from "react";

/**
 * Petits éléments partagés de l'espace super admin : message de confirmation
 * qui s'affiche en bas de l'écran, carte de chiffre clé, bloc de section.
 */

/** Message en bas à droite de l'écran, qui disparaît tout seul après quelques secondes */
export function Notification({
  message,
  type,
  onFermer,
}: {
  message: string;
  type: "succes" | "erreur";
  onFermer: () => void;
}) {
  // Le minuteur ne repart pas à zéro quand la page se redessine
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    if (!message) return;
    const minuteur = setTimeout(() => fermer.current(), type === "succes" ? 5000 : 8000);
    return () => clearTimeout(minuteur);
  }, [message, type]);

  if (!message) return null;
  const succes = type === "succes";

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div
        role="status"
        className={`flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3.5 text-sm text-white shadow-2xl ${
          succes ? "bg-accent" : "bg-error"
        }`}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          {succes ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path d="M12 7v6M12 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <p className="flex-1 leading-relaxed">{message}</p>
        <button onClick={onFermer} aria-label="Fermer" className="text-white/80 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Carte de chiffre clé (avec une icône de couleur) */
export function CarteChiffre({
  titre,
  valeur,
  detail,
  icone,
  couleur = "accent",
}: {
  titre: string;
  valeur: string;
  detail?: string;
  icone: ReactNode;
  couleur?: "accent" | "seal" | "error" | "ink";
}) {
  const fond = {
    accent: "bg-accent/10 text-accent",
    seal: "bg-seal/15 text-seal",
    error: "bg-error/10 text-error",
    ink: "bg-ink/10 text-ink",
  }[couleur];
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-soft">{titre}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${fond}`}>{icone}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{valeur}</p>
      {detail && <p className="mt-1 text-xs text-ink-soft">{detail}</p>}
    </div>
  );
}

/** Bloc blanc avec un titre et une phrase d'explication */
export function Section({
  titre,
  description,
  action,
  children,
  className = "",
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">{titre}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Icônes des chiffres clés
export const ICONES = {
  argent: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  centres: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M3 21V8l9-5 9 5v13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  cadeau: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="3.5" y="8" width="17" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 12v8h14v-8M12 8v12M12 8S10.5 4 8 4.5 7.5 8 12 8Zm0 0s1.5-4 4-3.5.5 3.5-4 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  horloge: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  cadenas: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 9v6M14 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  factures: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

// ---------- Plans : noms et couleurs (les mêmes partout) ----------

export const NOMS_PLANS: Record<string, string> = {
  gratuit: "Gratuit",
  standard: "Standard",
  pro: "Pro",
  sur_mesure: "Sur mesure",
};

/** Couleur de chaque plan : Gratuit gris, Standard vert, Pro bleu foncé, Sur mesure doré */
export function couleurPlan(code: string) {
  if (code === "pro") return "bg-ink text-white";
  if (code === "standard") return "bg-accent/10 text-accent";
  if (code === "sur_mesure") return "bg-seal/15 text-ink";
  return "bg-ink/5 text-ink-soft";
}

/** Pastille d'un plan, toujours de la même couleur */
export function BadgePlan({ code, nom }: { code: string; nom?: string }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${couleurPlan(code)}`}>
      {nom ?? NOMS_PLANS[code] ?? code}
    </span>
  );
}

// ---------- Petits outils communs ----------

export const champClass =
  "w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
export const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-ink-soft";
export const boutonPrincipal =
  "inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";
export const boutonSecondaire =
  "inline-flex h-9 items-center justify-center rounded-lg border border-ink/15 px-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent";

export const montant = (valeur: number) => `${valeur.toLocaleString("fr-FR")} F`;

export const dateCourte = (valeur: string | null | undefined) =>
  valeur
    ? new Date(valeur).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "—";

/** Message lisible à partir d'une réponse d'erreur du serveur */
export async function messageErreur(res: Response) {
  try {
    const data = await res.json();
    if (Array.isArray(data.message)) return data.message.join(" — ");
    return data.message || "Une erreur est survenue";
  } catch {
    return "Une erreur est survenue";
  }
}

/** "" → null ; "12 000" → 12000 */
export function versNombre(texte: string): number | null {
  const chiffres = texte.replace(/\D/g, "");
  return chiffres === "" ? null : Number(chiffres);
}

/** En-tête de chaque page de l'espace super admin */
export function EnTetePage({ titre, description, action }: { titre: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">HREFF</p>
        <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
          {titre}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      </div>
      {action}
    </div>
  );
}

// ---------- Données de la vue d'ensemble (serveur : /subscriptions/overview) ----------

export type PlanVue = {
  code: string;
  nom: string;
  prixMensuel: number | null;
  prixAnnuel: number | null;
  factures: number;
  comptes: number;
  prixParFacture: number | null;
  facturesParCompte: number | null;
  prixCompteSupplementaire: number | null;
  nombreCentres: number;
};

export type VueEnsemble = {
  revenusDuMois: number;
  nombreCentres: number;
  centresPayants: number;
  centresOfferts: number;
  offresEnCours: { centreId: string; centre: string; plan: string; fin: string; planPrecedent: string }[];
  enGrace: number;
  enLectureSeule: number;
  plans: PlanVue[];
  aSuivre: {
    centreId: string;
    centre: string;
    plan: string;
    statut: "echeance_proche" | "grace" | "lecture_seule";
    finAbonnement: string | null;
    finGrace: string | null;
  }[];
  derniersPaiements: {
    id: string;
    centre: string;
    plan: string;
    planNom: string;
    periodicite: string;
    montant: number;
    moyen: string;
    dateConfirmation: string | null;
  }[];
};