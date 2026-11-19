"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api";
import {
  BadgePlan,
  CarteChiffre,
  EnTetePage,
  ICONES,
  Notification,
  Section,
  VueEnsemble,
  boutonSecondaire,
  dateCourte,
  messageErreur,
  montant,
} from "../components/SuperAdminUI";

/**
 * Espace super admin — Tableau de bord (en français uniquement).
 * Un résumé des centres et des paiements : chiffres clés, abonnements à
 * suivre, derniers paiements, centres les plus actifs et derniers inscrits.
 * Le détail est dans les autres pages du menu.
 */

type Centre = {
  _id: string;
  nom: string;
  ville?: string;
  statut: "actif" | "suspendu";
  plan?: string;
  createdAt: string;
  nombreFactures: number;
  nombreUtilisateurs: number;
};

const STATUTS_SUIVI = {
  echeance_proche: { texte: "Échéance proche", classe: "bg-accent/10 text-accent" },
  grace: { texte: "Grâce", classe: "bg-seal/15 text-ink" },
  lecture_seule: { texte: "Lecture seule", classe: "bg-error/10 text-error" },
};

/** Premier jour du mois en cours, à minuit */
function debutDuMois() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function TableauDeBordSuperAdmin() {
  const [vue, setVue] = useState<VueEnsemble | null>(null);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    const [rVue, rCentres] = await Promise.all([apiFetch("/subscriptions/overview"), apiFetch("/centers")]);
    if (!rVue.ok) {
      setErreur(await messageErreur(rVue));
      return;
    }
    setVue(await rVue.json());
    if (rCentres.ok) setCentres(await rCentres.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const actifs = centres.filter((c) => c.statut === "actif").length;
  const suspendus = centres.length - actifs;
  const debut = debutDuMois();
  const nouveauxCeMois = centres.filter((c) => new Date(c.createdAt) >= debut).length;
  const plusActifs = [...centres].sort((a, b) => b.nombreFactures - a.nombreFactures).slice(0, 5);
  const derniersInscrits = [...centres]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <EnTetePage
        titre="Tableau de bord"
        description="L'essentiel des centres et des paiements en un coup d'œil. Le détail est dans les autres pages du menu."
      />

      <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />
      {!vue && !erreur && <p className="text-ink-soft">Chargement…</p>}

      {vue && (
        <>
          {/* Chiffres clés : argent et centres */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CarteChiffre
              titre="Revenus du mois"
              valeur={montant(vue.revenusDuMois)}
              detail="paiements confirmés par CamPay"
              icone={ICONES.argent}
            />
            <CarteChiffre
              titre="Centres"
              valeur={String(centres.length || vue.nombreCentres)}
              detail={`${actifs} actif(s) · ${suspendus} suspendu(s)`}
              icone={ICONES.centres}
              couleur="ink"
            />
            <CarteChiffre
              titre="Centres payants"
              valeur={String(vue.centresPayants)}
              detail={`${vue.centresOfferts} plan(s) offert(s)`}
              icone={ICONES.factures}
            />
            <CarteChiffre
              titre="Nouveaux ce mois"
              valeur={String(nouveauxCeMois)}
              detail="centres inscrits depuis le 1er"
              icone={ICONES.centres}
              couleur="seal"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CarteChiffre
              titre="En période de grâce"
              valeur={String(vue.enGrace)}
              detail="7 jours pour payer"
              icone={ICONES.horloge}
              couleur="seal"
            />
            <CarteChiffre
              titre="En lecture seule"
              valeur={String(vue.enLectureSeule)}
              detail="plus de nouvelle facture"
              icone={ICONES.cadenas}
              couleur="error"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* À suivre */}
            <Section
              titre="À suivre"
              description="Échéance proche, grâce ou lecture seule"
              action={
                <Link href="/super-admin/suivi" className={boutonSecondaire}>
                  Tout voir
                </Link>
              }
            >
              {vue.aSuivre.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Rien à suivre pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {vue.aSuivre.slice(0, 5).map((ligne) => (
                    <li key={ligne.centreId} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{ligne.centre}</p>
                        <p className="text-xs text-ink-soft">
                          {ligne.plan} ·{" "}
                          {ligne.statut === "grace"
                            ? `payer avant le ${dateCourte(ligne.finGrace)}`
                            : `échéance le ${dateCourte(ligne.finAbonnement)}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUTS_SUIVI[ligne.statut].classe}`}
                      >
                        {STATUTS_SUIVI[ligne.statut].texte}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Derniers paiements */}
            <Section
              titre="Derniers paiements"
              description="Confirmés par CamPay"
              action={
                <Link href="/super-admin/transactions" className={boutonSecondaire}>
                  Transactions
                </Link>
              }
            >
              {vue.derniersPaiements.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Aucun paiement pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {vue.derniersPaiements.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{p.centre}</p>
                        <p className="text-xs text-ink-soft">
                          {p.planNom} · {p.periodicite} · {p.moyen === "carte" ? "carte" : "Mobile Money"} ·{" "}
                          {dateCourte(p.dateConfirmation)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-ink">{montant(p.montant)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Centres les plus actifs */}
            <Section
              titre="Centres les plus actifs"
              description="Classés par nombre de factures"
              action={
                <Link href="/super-admin/centres" className={boutonSecondaire}>
                  Tous les centres
                </Link>
              }
            >
              {plusActifs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Aucun centre pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {plusActifs.map((c) => (
                    <li key={c._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-semibold text-ink">{c.nom}</p>
                        <BadgePlan code={c.plan ?? "gratuit"} />
                      </div>
                      <span className="shrink-0 text-ink-soft">
                        <strong className="text-ink">{c.nombreFactures.toLocaleString("fr-FR")}</strong> factures ·{" "}
                        {c.nombreUtilisateurs} comptes
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Derniers centres inscrits */}
            <Section titre="Derniers centres inscrits" description="Les 5 plus récents">
              {derniersInscrits.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Aucun centre pour l&apos;instant.</p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {derniersInscrits.map((c) => (
                    <li key={c._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{c.nom}</p>
                        <p className="text-xs text-ink-soft">
                          {c.ville ? `${c.ville} · ` : ""}inscrit le {dateCourte(c.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          c.statut === "actif" ? "bg-accent/10 text-accent" : "bg-error/10 text-error"
                        }`}
                      >
                        {c.statut === "actif" ? "Actif" : "Suspendu"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </main>
  );
}