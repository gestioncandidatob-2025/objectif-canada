"use client";

import Link from "next/link";
import { useLangue } from "../lib/langue";
import { nomDuPlan, type EtatAbonnement } from "../lib/abonnement";

/**
 * Bandeau en haut des pages quand l'abonnement demande une action :
 * - période de grâce (échéance passée, encore quelques jours pour payer) ;
 * - lecture seule (plus de nouvelle facture) ;
 * - quota de factures du mois bientôt atteint, ou atteint.
 * L'administrateur a un lien vers la page Abonnement ; la secrétaire ne
 * voit que ce qui l'empêche de travailler, avec « contacte ton administrateur ».
 */
export default function BandeauAbonnement({
  etat,
  estAdmin,
}: {
  etat: EtatAbonnement | null;
  estAdmin: boolean;
}) {
  const { t, locale } = useLangue();
  if (!etat) return null;

  const date = (valeur: string | null) =>
    valeur
      ? new Date(valeur).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
      : "";

  const quotaAtteint = etat.factures.utilisees >= etat.factures.limite;
  const plan = nomDuPlan(etat.plan.code, t, etat.plan.nom);

  let ton: "rouge" | "orange" | null = null;
  let message = "";

  if (etat.statut === "lecture_seule") {
    ton = "rouge";
    message = estAdmin
      ? t("abonnement.bandeau.lectureSeuleAdmin", { date: date(etat.finAbonnement) })
      : t("abonnement.bandeau.lectureSeuleSecretaire");
  } else if (quotaAtteint) {
    ton = "rouge";
    message = estAdmin
      ? t("abonnement.bandeau.quotaAtteintAdmin", { limite: etat.factures.limite, plan })
      : t("abonnement.bandeau.quotaAtteintSecretaire", { limite: etat.factures.limite });
  } else if (estAdmin && etat.statut === "grace") {
    ton = "orange";
    message = t("abonnement.bandeau.grace", {
      date: date(etat.finAbonnement),
      limite: date(etat.finGrace),
    });
  } else if (estAdmin && etat.alerteQuota) {
    ton = "orange";
    message = t("abonnement.bandeau.quotaProche", {
      utilisees: etat.factures.utilisees,
      limite: etat.factures.limite,
    });
  }

  if (!ton) return null;

  return (
    <div
      role="status"
      className={
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm lg:px-8 " +
        (ton === "rouge" ? "bg-error/10 text-error" : "bg-seal/15 text-ink")
      }
    >
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      {estAdmin && (
        <Link
          href="/abonnement"
          className={
            "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white " +
            (ton === "rouge" ? "bg-error hover:opacity-90" : "bg-ink hover:opacity-90")
          }
        >
          {t("abonnement.bandeau.voir")}
        </Link>
      )}
    </div>
  );
}

/**
 * Remplace la page « Nouvelle facture » quand le centre ne peut plus
 * facturer (lecture seule ou quota du mois atteint) : on évite ainsi de
 * remplir tout le formulaire pour rien.
 */
export function FacturationBloquee({ estAdmin }: { estAdmin: boolean }) {
  const { t } = useLangue();
  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-error/30 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
          {t("abonnement.bloque.titre")}
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          {estAdmin ? t("abonnement.bloque.texteAdmin") : t("abonnement.bloque.texteSecretaire")}
        </p>
        {estAdmin && (
          <Link
            href="/abonnement"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            {t("abonnement.bloque.bouton")}
          </Link>
        )}
      </div>
    </div>
  );
}