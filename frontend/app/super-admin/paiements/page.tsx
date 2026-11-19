"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import {
  BadgePlan,
  CarteChiffre,
  EnTetePage,
  ICONES,
  Notification,
  VueEnsemble,
  boutonSecondaire,
  dateCourte,
  messageErreur,
  montant,
} from "../../components/SuperAdminUI";

/**
 * Espace super admin — Paiements (en français uniquement).
 * Chiffres clés, paiements reçus par CamPay, abonnements à suivre et plans
 * offerts en cours. Le super admin ne voit jamais le contenu des factures.
 */

/** Le code d'un plan à partir de son nom affiché ("Pro" → "pro") */
function codeDuPlan(nom: string) {
  const n = nom.toLowerCase();
  if (n.startsWith("pro")) return "pro";
  if (n.startsWith("standard")) return "standard";
  if (n.startsWith("sur")) return "sur_mesure";
  return "gratuit";
}

export default function PaiementsPage() {
  const [vue, setVue] = useState<VueEnsemble | null>(null);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    const res = await apiFetch("/subscriptions/overview");
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setVue(await res.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <EnTetePage
        titre="Paiements"
        description="L'argent reçu des centres (CamPay : Mobile Money ou carte) et les plans offerts en cours."
      />

      <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />
      {!vue && !erreur && <p className="text-ink-soft">Chargement…</p>}

      {vue && (
        <>
          {/* Chiffres clés */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <CarteChiffre titre="Revenus du mois" valeur={montant(vue.revenusDuMois)} detail="paiements confirmés" icone={ICONES.argent} />
            <CarteChiffre titre="Centres payants" valeur={String(vue.centresPayants)} detail={`sur ${vue.nombreCentres} centres`} icone={ICONES.centres} couleur="ink" />
            <CarteChiffre titre="Plans offerts" valeur={String(vue.centresOfferts)} detail="sans paiement, pour une période" icone={ICONES.cadeau} couleur="seal" />
            <CarteChiffre titre="En période de grâce" valeur={String(vue.enGrace)} detail="7 jours pour payer" icone={ICONES.horloge} couleur="seal" />
            <CarteChiffre titre="En lecture seule" valeur={String(vue.enLectureSeule)} detail="plus de nouvelle facture" icone={ICONES.cadenas} couleur="error" />
          </div>

          {/* Derniers paiements */}
          <section className="rounded-2xl border border-ink/10 bg-white shadow-sm">
            <div className="border-b border-ink/10 px-5 py-4">
              <h2 className="text-base font-semibold text-ink">Derniers paiements reçus</h2>
              <p className="mt-0.5 text-sm text-ink-soft">Confirmés par CamPay, du plus récent au plus ancien</p>
            </div>
            {vue.derniersPaiements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-soft">Aucun paiement pour l&apos;instant.</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {vue.derniersPaiements.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      {ICONES.argent}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{p.centre}</p>
                      <p className="text-xs text-ink-soft">
                        {p.periodicite === "annuel" ? "1 an" : "1 mois"} · {p.moyen === "carte" ? "carte" : "Mobile Money"} ·{" "}
                        {dateCourte(p.dateConfirmation)}
                      </p>
                    </div>
                    <BadgePlan code={p.plan ?? codeDuPlan(p.planNom)} nom={p.planNom} />
                    <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">+ {montant(p.montant)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>


            {/* Plans offerts en cours */}
            <section className="rounded-2xl border border-ink/10 bg-white shadow-sm">
              <div className="border-b border-ink/10 px-5 py-4">
                <h2 className="text-base font-semibold text-ink">Plans offerts en cours</h2>
                <p className="mt-0.5 text-sm text-ink-soft">À la date de fin, le centre revient tout seul à son plan d&apos;avant</p>
              </div>
              {vue.offresEnCours.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-soft">Aucun plan offert en ce moment.</p>
              ) : (
                <ul className="divide-y divide-ink/5">
                  {vue.offresEnCours.map((ligne) => (
                    <li key={ligne.centreId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{ligne.centre}</p>
                        <p className="text-xs text-ink-soft">
                          jusqu&apos;au {dateCourte(ligne.fin)}, puis retour au plan {ligne.planPrecedent}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <BadgePlan code={codeDuPlan(ligne.plan)} nom={ligne.plan} />
                        <Link href={`/super-admin?plan=${ligne.centreId}`} className={boutonSecondaire}>
                          Voir
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
        </>
      )}
    </main>
  );
}