"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  BadgePlan,
  EnTetePage,
  Notification,
  PlanVue,
  VueEnsemble,
  boutonPrincipal,
  boutonSecondaire,
  champClass,
  labelClass,
  messageErreur,
  montant,
  versNombre,
} from "../../components/SuperAdminUI";

/**
 * Espace super admin — Les plans (en français uniquement).
 * Prix et limites de chaque plan. Un changement de prix vaut pour les
 * prochains paiements, pas pour ceux déjà faits.
 */

type FormulairePlan = {
  prixMensuel: string;
  prixAnnuel: string;
  factures: string;
  comptes: string;
};

type FormulaireSurMesure = {
  prixParFacture: string;
  facturesParCompte: string;
  prixCompteSupplementaire: string;
};

/** Une ligne « libellé : valeur » dans la carte d'un plan */
function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/5 py-2 text-sm last:border-0">
      <span className="text-ink-soft">{libelle}</span>
      <span className="text-right font-semibold text-ink">{valeur}</span>
    </div>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanVue[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Plan en cours de modification (un seul à la fois)
  const [planOuvert, setPlanOuvert] = useState<string | null>(null);
  const [formulairePlan, setFormulairePlan] = useState<FormulairePlan | null>(null);
  const [formulaireSurMesure, setFormulaireSurMesure] = useState<FormulaireSurMesure | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const charger = useCallback(async () => {
    const res = await apiFetch("/subscriptions/overview");
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const vue: VueEnsemble = await res.json();
    setPlans(vue.plans);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function ouvrir(plan: PlanVue) {
    setErreur("");
    setPlanOuvert(plan.code);
    if (plan.code === "sur_mesure") {
      setFormulairePlan(null);
      setFormulaireSurMesure({
        prixParFacture: String(plan.prixParFacture ?? ""),
        facturesParCompte: String(plan.facturesParCompte ?? ""),
        prixCompteSupplementaire: String(plan.prixCompteSupplementaire ?? ""),
      });
    } else {
      setFormulaireSurMesure(null);
      setFormulairePlan({
        prixMensuel: plan.prixMensuel !== null ? String(plan.prixMensuel) : "",
        prixAnnuel: plan.prixAnnuel !== null ? String(plan.prixAnnuel) : "",
        factures: String(plan.factures),
        comptes: String(plan.comptes),
      });
    }
  }

  function fermer() {
    setPlanOuvert(null);
    setFormulairePlan(null);
    setFormulaireSurMesure(null);
  }

  async function enregistrer(plan: PlanVue, e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    const corps =
      plan.code === "sur_mesure" && formulaireSurMesure
        ? {
            prixParFacture: versNombre(formulaireSurMesure.prixParFacture) ?? undefined,
            facturesParCompte: versNombre(formulaireSurMesure.facturesParCompte) ?? undefined,
            prixCompteSupplementaire: versNombre(formulaireSurMesure.prixCompteSupplementaire) ?? undefined,
          }
        : formulairePlan
          ? {
              prixMensuel: versNombre(formulairePlan.prixMensuel),
              prixAnnuel: versNombre(formulairePlan.prixAnnuel),
              factures: versNombre(formulairePlan.factures) ?? undefined,
              comptes: versNombre(formulairePlan.comptes) ?? undefined,
            }
          : null;
    if (!corps) return;

    setEnvoiEnCours(true);
    const res = await apiFetch(`/subscriptions/plans/${plan.code}`, {
      method: "PATCH",
      body: JSON.stringify(corps),
    });
    setEnvoiEnCours(false);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces(`Plan « ${plan.nom} » enregistré. Les nouveaux prix valent pour les prochains paiements.`);
    fermer();
    charger();
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <EnTetePage
        titre="Plans"
        description="Prix et limites de chaque plan. Un changement de prix vaut pour les prochains paiements, pas pour ceux déjà faits."
      />

      <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />
      <Notification message={succes} type="succes" onFermer={() => setSucces("")} />

      {!plans && !erreur && <p className="text-ink-soft">Chargement…</p>}

      {plans && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const ouvert = planOuvert === plan.code;
            const surMesure = plan.code === "sur_mesure";
            return (
              <div
                key={plan.code}
                className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
                  ouvert ? "border-accent shadow-md" : "border-ink/10 hover:shadow-md"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <BadgePlan code={plan.code} nom={plan.nom} />
                  <span className="text-xs text-ink-soft">{plan.nombreCentres} centre(s)</span>
                </div>

                <p className="text-2xl font-semibold text-ink">
                  {surMesure
                    ? `${montant(plan.prixParFacture ?? 0)}`
                    : plan.prixMensuel !== null
                      ? montant(plan.prixMensuel)
                      : "—"}
                  <span className="ml-1 text-sm font-normal text-ink-soft">
                    {surMesure ? "par facture / mois" : "par mois"}
                  </span>
                </p>

                <div className="mt-3 flex-1">
                  {surMesure ? (
                    <>
                      <Ligne libelle="Factures / mois" valeur="au choix" />
                      <Ligne libelle="1 compte inclus pour" valeur={`${plan.facturesParCompte ?? 40} factures`} />
                      <Ligne libelle="Compte en plus" valeur={`${montant(plan.prixCompteSupplementaire ?? 0)} / mois`} />
                      <Ligne libelle="Par an" valeur="prix du mois × 10" />
                    </>
                  ) : (
                    <>
                      <Ligne libelle="Par an" valeur={plan.prixAnnuel !== null ? montant(plan.prixAnnuel) : "—"} />
                      <Ligne libelle="Factures / mois" valeur={String(plan.factures)} />
                      <Ligne libelle="Comptes" valeur={String(plan.comptes)} />
                    </>
                  )}
                </div>

                {!ouvert && (
                  <button onClick={() => ouvrir(plan)} className={`${boutonSecondaire} mt-4 w-full`}>
                    Modifier
                  </button>
                )}

                {ouvert && (
                  <form onSubmit={(e) => enregistrer(plan, e)} className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4">
                    {formulairePlan &&
                      (
                        [
                          ["prixMensuel", "Prix par mois (F)"],
                          ["prixAnnuel", "Prix par an (F)"],
                          ["factures", "Factures / mois"],
                          ["comptes", "Comptes"],
                        ] as const
                      ).map(([cle, libelle]) => (
                        <label key={cle} className={labelClass}>
                          {libelle}
                          <input
                            inputMode="numeric"
                            value={formulairePlan[cle]}
                            onChange={(e) => setFormulairePlan({ ...formulairePlan, [cle]: e.target.value })}
                            className={champClass}
                          />
                        </label>
                      ))}
                    {formulaireSurMesure &&
                      (
                        [
                          ["prixParFacture", "Prix d'une facture par mois (F)"],
                          ["facturesParCompte", "1 compte inclus pour … factures"],
                          ["prixCompteSupplementaire", "Compte en plus, par mois (F)"],
                        ] as const
                      ).map(([cle, libelle]) => (
                        <label key={cle} className={labelClass}>
                          {libelle}
                          <input
                            inputMode="numeric"
                            value={formulaireSurMesure[cle]}
                            onChange={(e) => setFormulaireSurMesure({ ...formulaireSurMesure, [cle]: e.target.value })}
                            className={champClass}
                          />
                        </label>
                      ))}
                    <div className="flex gap-2">
                      <button type="submit" disabled={envoiEnCours} className={`${boutonPrincipal} flex-1`}>
                        {envoiEnCours ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button
                        type="button"
                        onClick={fermer}
                        className="inline-flex h-11 items-center rounded-xl border border-ink/15 px-4 text-sm font-semibold text-ink hover:bg-ink/5"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}