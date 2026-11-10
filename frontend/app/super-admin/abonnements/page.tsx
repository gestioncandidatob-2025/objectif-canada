"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

/**
 * Espace super admin — Plans et paiements (en français uniquement).
 * Revenus du mois, plans (prix modifiables), abonnements à suivre,
 * derniers paiements CamPay, et réglage à la main de l'abonnement d'un
 * centre (plan offert, Sur mesure, paiement reçu hors CamPay).
 */

type Plan = {
  code: string;
  nom: string;
  prixMensuel: number | null;
  prixAnnuel: number | null;
  factures: number;
  comptes: number;
  nombreCentres: number;
};

type VueEnsemble = {
  revenusDuMois: number;
  nombreCentres: number;
  centresPayants: number;
  enGrace: number;
  enLectureSeule: number;
  plans: Plan[];
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
    planNom: string;
    periodicite: string;
    montant: number;
    moyen: string;
    dateConfirmation: string | null;
  }[];
};

type CentreListe = { _id: string; nom: string; ville?: string };

type AbonnementCentre = {
  plan: { code: string; nom: string };
  statut: string;
  periodicite: string | null;
  finAbonnement: string | null;
  factures: { utilisees: number; limite: number };
  comptes: { utilises: number; limite: number };
  surMesure: { factures?: number; comptes?: number; prixMensuel?: number; prixAnnuel?: number } | null;
};

const champClass =
  "w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

const montant = (valeur: number) => `${valeur.toLocaleString("fr-FR")} F`;
const date = (valeur: string | null) =>
  valeur ? new Date(valeur).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

async function messageErreur(res: Response) {
  try {
    const data = await res.json();
    if (Array.isArray(data.message)) return data.message.join(" — ");
    return data.message || "Une erreur est survenue";
  } catch {
    return "Une erreur est survenue";
  }
}

/** "" → null ; "12 000" → 12000 */
function versNombre(texte: string): number | null {
  const chiffres = texte.replace(/\D/g, "");
  return chiffres === "" ? null : Number(chiffres);
}

export default function PlansEtPaiementsPage() {
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [vue, setVue] = useState<VueEnsemble | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Modification d'un plan
  const [planEnCours, setPlanEnCours] = useState<{
    code: string;
    nom: string;
    prixMensuel: string;
    prixAnnuel: string;
    factures: string;
    comptes: string;
  } | null>(null);

  // Réglage de l'abonnement d'un centre
  const [centres, setCentres] = useState<CentreListe[]>([]);
  const [centreChoisi, setCentreChoisi] = useState("");
  const [abonnementCentre, setAbonnementCentre] = useState<AbonnementCentre | null>(null);
  const [reglage, setReglage] = useState({
    plan: "gratuit",
    periodicite: "mensuel",
    finAbonnement: "",
    smFactures: "",
    smComptes: "",
    smPrixMensuel: "",
    smPrixAnnuel: "",
  });

  useEffect(() => {
    try {
      const utilisateur = JSON.parse(localStorage.getItem("user") ?? "{}");
      if (utilisateur.role !== "super_admin") {
        router.replace("/login");
        return;
      }
      setPret(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

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
    if (pret) charger();
  }, [pret, charger]);

  // Abonnement du centre choisi
  useEffect(() => {
    if (!centreChoisi) {
      setAbonnementCentre(null);
      return;
    }
    async function chargerCentre() {
      const res = await apiFetch(`/subscriptions/centers/${centreChoisi}`);
      if (!res.ok) {
        setErreur(await messageErreur(res));
        return;
      }
      const data: AbonnementCentre = await res.json();
      setAbonnementCentre(data);
      setReglage({
        plan: data.plan.code,
        periodicite: data.periodicite ?? "mensuel",
        finAbonnement: data.finAbonnement ? data.finAbonnement.slice(0, 10) : "",
        smFactures: data.surMesure?.factures ? String(data.surMesure.factures) : "",
        smComptes: data.surMesure?.comptes ? String(data.surMesure.comptes) : "",
        smPrixMensuel: data.surMesure?.prixMensuel ? String(data.surMesure.prixMensuel) : "",
        smPrixAnnuel: data.surMesure?.prixAnnuel ? String(data.surMesure.prixAnnuel) : "",
      });
    }
    chargerCentre();
  }, [centreChoisi]);

  async function enregistrerPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planEnCours) return;
    setErreur("");
    setSucces("");
    const res = await apiFetch(`/subscriptions/plans/${planEnCours.code}`, {
      method: "PATCH",
      body: JSON.stringify({
        prixMensuel: versNombre(planEnCours.prixMensuel),
        prixAnnuel: versNombre(planEnCours.prixAnnuel),
        factures: versNombre(planEnCours.factures) ?? undefined,
        comptes: versNombre(planEnCours.comptes) ?? undefined,
      }),
    });
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces(`Plan « ${planEnCours.nom} » enregistré. Les nouveaux prix valent pour les prochains paiements.`);
    setPlanEnCours(null);
    charger();
  }

  async function enregistrerReglage(e: React.FormEvent) {
    e.preventDefault();
    if (!centreChoisi) return;
    setErreur("");
    setSucces("");
    const corps: Record<string, unknown> = { plan: reglage.plan };
    if (reglage.plan !== "gratuit") {
      corps.periodicite = reglage.periodicite;
      corps.finAbonnement = reglage.finAbonnement || null;
    }
    if (reglage.plan === "sur_mesure") {
      corps.surMesure = {
        factures: versNombre(reglage.smFactures) ?? undefined,
        comptes: versNombre(reglage.smComptes) ?? undefined,
        prixMensuel: versNombre(reglage.smPrixMensuel) ?? undefined,
        prixAnnuel: versNombre(reglage.smPrixAnnuel) ?? undefined,
      };
    }
    const res = await apiFetch(`/subscriptions/centers/${centreChoisi}`, {
      method: "PATCH",
      body: JSON.stringify(corps),
    });
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setAbonnementCentre(await res.json());
    setSucces("Abonnement du centre enregistré.");
    charger();
  }

  if (!pret) return null;

  const libelleSuivi = {
    echeance_proche: { texte: "Échéance proche", classe: "bg-accent/10 text-accent" },
    grace: { texte: "Grâce", classe: "bg-seal/15 text-ink" },
    lecture_seule: { texte: "Lecture seule", classe: "bg-error/10 text-error" },
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">HREFF</p>
            <h1 className="text-xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Plans et paiements
            </h1>
          </div>
          <Link
            href="/super-admin"
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            ← Centres
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <p className="text-sm text-ink-soft">Les abonnements des centres, payés par CamPay (Mobile Money ou carte).</p>

        {erreur && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{erreur}</p>}
        {succes && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">{succes}</p>}
        {!vue && !erreur && <p className="text-ink-soft">Chargement…</p>}

        {vue && (
          <>
            {/* Chiffres clés */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { titre: "Revenus du mois", valeur: montant(vue.revenusDuMois), detail: "paiements confirmés" },
                { titre: "Centres payants", valeur: String(vue.centresPayants), detail: `sur ${vue.nombreCentres} centres` },
                { titre: "En période de grâce", valeur: String(vue.enGrace), detail: "7 jours pour payer" },
                { titre: "En lecture seule", valeur: String(vue.enLectureSeule), detail: "plus de nouvelle facture" },
              ].map((carte) => (
                <div key={carte.titre} className="rounded-2xl border border-ink/10 bg-white p-5">
                  <p className="text-sm text-ink-soft">{carte.titre}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{carte.valeur}</p>
                  <p className="mt-1 text-xs text-ink-soft">{carte.detail}</p>
                </div>
              ))}
            </div>

            {/* Les plans */}
            <section className="rounded-2xl border border-ink/10 bg-white">
              <div className="border-b border-ink/10 px-5 py-4">
                <h2 className="text-lg font-semibold text-ink">Les plans</h2>
                <p className="text-sm text-ink-soft">
                  Un changement de prix vaut pour les prochains paiements, pas pour ceux déjà faits.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-ink-soft">
                    <tr className="border-b border-ink/10">
                      <th className="px-5 py-3 font-medium">Plan</th>
                      <th className="px-5 py-3 font-medium">Par mois</th>
                      <th className="px-5 py-3 font-medium">Par an</th>
                      <th className="px-5 py-3 font-medium">Factures / mois</th>
                      <th className="px-5 py-3 font-medium">Comptes</th>
                      <th className="px-5 py-3 font-medium">Centres</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {vue.plans.map((plan) => (
                      <tr key={plan.code} className="border-b border-ink/5 last:border-0">
                        <td className="px-5 py-3 font-semibold text-ink">{plan.nom}</td>
                        <td className="px-5 py-3">{plan.prixMensuel !== null ? montant(plan.prixMensuel) : "—"}</td>
                        <td className="px-5 py-3">{plan.prixAnnuel !== null ? montant(plan.prixAnnuel) : "—"}</td>
                        <td className="px-5 py-3">{plan.code === "sur_mesure" ? "au choix" : plan.factures}</td>
                        <td className="px-5 py-3">{plan.code === "sur_mesure" ? "au choix" : plan.comptes}</td>
                        <td className="px-5 py-3">{plan.nombreCentres}</td>
                        <td className="px-5 py-3 text-right">
                          {plan.code !== "sur_mesure" && (
                            <button
                              onClick={() =>
                                setPlanEnCours({
                                  code: plan.code,
                                  nom: plan.nom,
                                  prixMensuel: plan.prixMensuel !== null ? String(plan.prixMensuel) : "",
                                  prixAnnuel: plan.prixAnnuel !== null ? String(plan.prixAnnuel) : "",
                                  factures: String(plan.factures),
                                  comptes: String(plan.comptes),
                                })
                              }
                              className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-ink/5"
                            >
                              Modifier
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {planEnCours && (
                <form onSubmit={enregistrerPlan} className="grid grid-cols-2 gap-3 border-t border-ink/10 p-5 sm:grid-cols-5">
                  <p className="col-span-2 text-sm font-semibold text-ink sm:col-span-5">Modifier « {planEnCours.nom} »</p>
                  {(
                    [
                      ["prixMensuel", "Prix par mois (F)"],
                      ["prixAnnuel", "Prix par an (F)"],
                      ["factures", "Factures / mois"],
                      ["comptes", "Comptes"],
                    ] as const
                  ).map(([cle, libelle]) => (
                    <label key={cle} className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                      {libelle}
                      <input
                        inputMode="numeric"
                        value={planEnCours[cle]}
                        onChange={(e) => setPlanEnCours({ ...planEnCours, [cle]: e.target.value })}
                        className={champClass}
                      />
                    </label>
                  ))}
                  <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                    <button type="submit" className="h-10 flex-1 rounded-lg bg-accent px-3 text-sm font-semibold text-white">
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanEnCours(null)}
                      className="h-10 rounded-lg border border-ink/15 px-3 text-sm text-ink"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Abonnements à suivre */}
              <section className="rounded-2xl border border-ink/10 bg-white p-5">
                <h2 className="text-lg font-semibold text-ink">Abonnements à suivre</h2>
                <p className="mb-3 text-sm text-ink-soft">Échéance proche, période de grâce ou lecture seule</p>
                {vue.aSuivre.length === 0 ? (
                  <p className="text-sm text-ink-soft">Rien à suivre pour l&apos;instant.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-ink/5">
                    {vue.aSuivre.map((ligne) => (
                      <li key={ligne.centreId} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{ligne.centre}</p>
                          <p className="text-xs text-ink-soft">
                            {ligne.plan} ·{" "}
                            {ligne.statut === "grace"
                              ? `payer avant le ${date(ligne.finGrace)}`
                              : `échéance le ${date(ligne.finAbonnement)}`}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${libelleSuivi[ligne.statut].classe}`}>
                          {libelleSuivi[ligne.statut].texte}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Derniers paiements */}
              <section className="rounded-2xl border border-ink/10 bg-white p-5">
                <h2 className="text-lg font-semibold text-ink">Derniers paiements reçus</h2>
                <p className="mb-3 text-sm text-ink-soft">Confirmés par CamPay</p>
                {vue.derniersPaiements.length === 0 ? (
                  <p className="text-sm text-ink-soft">Aucun paiement pour l&apos;instant.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-ink/5">
                    {vue.derniersPaiements.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{p.centre}</p>
                          <p className="text-xs text-ink-soft">
                            {p.planNom} · {p.periodicite} · {p.moyen === "carte" ? "carte" : "Mobile Money"} ·{" "}
                            {date(p.dateConfirmation)}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-ink">{montant(p.montant)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Régler l'abonnement d'un centre à la main */}
            <section className="rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">Régler l&apos;abonnement d&apos;un centre</h2>
              <p className="mb-4 text-sm text-ink-soft">
                Plan offert, Sur mesure, ou paiement reçu en dehors de CamPay (espèces, virement).
              </p>
              <label className="flex max-w-md flex-col gap-1 text-sm font-medium text-ink-soft">
                Centre
                <select value={centreChoisi} onChange={(e) => setCentreChoisi(e.target.value)} className={champClass}>
                  <option value="">Choisir un centre…</option>
                  {centres.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.nom}
                      {c.ville ? ` — ${c.ville}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {abonnementCentre && (
                <form onSubmit={enregistrerReglage} className="mt-5 flex flex-col gap-4">
                  <p className="text-sm text-ink">
                    Actuellement : <strong>{abonnementCentre.plan.nom}</strong> ({abonnementCentre.statut.replace("_", " ")}) ·{" "}
                    {abonnementCentre.factures.utilisees}/{abonnementCentre.factures.limite} factures ce mois ·{" "}
                    {abonnementCentre.comptes.utilises}/{abonnementCentre.comptes.limite} comptes
                    {abonnementCentre.finAbonnement ? ` · payé jusqu'au ${date(abonnementCentre.finAbonnement)}` : ""}
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
                      Plan
                      <select
                        value={reglage.plan}
                        onChange={(e) => setReglage({ ...reglage, plan: e.target.value })}
                        className={champClass}
                      >
                        <option value="gratuit">Gratuit</option>
                        <option value="standard">Standard</option>
                        <option value="pro">Pro</option>
                        <option value="sur_mesure">Sur mesure</option>
                      </select>
                    </label>
                    {reglage.plan !== "gratuit" && (
                      <>
                        <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
                          Durée
                          <select
                            value={reglage.periodicite}
                            onChange={(e) => setReglage({ ...reglage, periodicite: e.target.value })}
                            className={champClass}
                          >
                            <option value="mensuel">Mensuel</option>
                            <option value="annuel">Annuel</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
                          Payé jusqu&apos;au (vide = sans fin)
                          <input
                            type="date"
                            value={reglage.finAbonnement}
                            onChange={(e) => setReglage({ ...reglage, finAbonnement: e.target.value })}
                            className={champClass}
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {reglage.plan === "sur_mesure" && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(
                        [
                          ["smFactures", "Factures / mois"],
                          ["smComptes", "Comptes"],
                          ["smPrixMensuel", "Prix par mois (F)"],
                          ["smPrixAnnuel", "Prix par an (F)"],
                        ] as const
                      ).map(([cle, libelle]) => (
                        <label key={cle} className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
                          {libelle}
                          <input
                            inputMode="numeric"
                            value={reglage[cle]}
                            onChange={(e) => setReglage({ ...reglage, [cle]: e.target.value })}
                            className={champClass}
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  <div>
                    <button type="submit" className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover">
                      Enregistrer l&apos;abonnement
                    </button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}