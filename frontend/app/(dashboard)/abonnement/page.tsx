"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";
import { EVENEMENT_ABONNEMENT_MODIFIE, nomDuPlan, type EtatAbonnement } from "../../lib/abonnement";

type PlanPayable = {
  code: string;
  nom: string;
  prixMensuel: number | null;
  prixAnnuel: number | null;
  factures: number;
  comptes: number;
};

type Paiement = {
  id: string;
  plan: string;
  periodicite: "mensuel" | "annuel";
  montant: number;
  moyen: "mobile" | "carte";
  statut: "en_attente" | "reussi" | "echoue";
  raisonEchec: string | null;
  payeParNom: string;
  date: string | null;
  finPeriode: string | null;
};

type Resume = EtatAbonnement & {
  paiementEnLigne: boolean;
  plansGratuits: { code: string; nom: string; factures: number; comptes: number }[];
  plans: PlanPayable[];
  paiements: Paiement[];
};

type Periodicite = "mensuel" | "annuel";

// Suivi d'un paiement en cours : on redemande son état toutes les 4 secondes
const INTERVALLE_SUIVI_MS = 4000;
// Après 3 minutes sans réponse, on arrête d'attendre (le paiement pourra encore réussir)
const DUREE_MAX_SUIVI_MS = 3 * 60 * 1000;

/**
 * Abonnement du centre (administrateur seulement) : plan actuel, factures
 * et comptes utilisés, choix d'un plan et paiement avec CamPay.
 * - Mobile Money : demande de code PIN envoyée sur le téléphone, sans quitter l'application ;
 * - Carte : page de paiement de CamPay, puis retour ici.
 */
export default function AbonnementPage() {
  const { t, locale } = useLangue();
  const router = useRouter();

  const [autorise, setAutorise] = useState(false);
  const [resume, setResume] = useState<Resume | null>(null);
  const [erreurChargement, setErreurChargement] = useState("");
  const [periodicite, setPeriodicite] = useState<Periodicite>("mensuel");

  // Fenêtre de paiement
  const [planChoisi, setPlanChoisi] = useState<PlanPayable | null>(null);
  const [moyen, setMoyen] = useState<"mobile" | "carte">("mobile");
  const [telephone, setTelephone] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState("");

  // Paiement en cours de suivi (mobile, ou retour de la page carte)
  const [suivi, setSuivi] = useState<{ id: string; ussdCode?: string | null } | null>(null);
  const [resultat, setResultat] = useState<{ type: "succes" | "echec" | "attente"; texte: string } | null>(null);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);

  const formaterMontant = (montant: number) => `${montant.toLocaleString(locale)} FCFA`;
  const formaterDate = (valeur: string | null) =>
    valeur ? new Date(valeur).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "";

  // Page réservée à l'administrateur
  useEffect(() => {
    try {
      const utilisateur = JSON.parse(localStorage.getItem("user") ?? "{}");
      if (utilisateur.role !== "admin") {
        router.replace("/bienvenue");
        return;
      }
      setAutorise(true);
    } catch {
      router.replace("/bienvenue");
    }
  }, [router]);

  const charger = useCallback(async () => {
    try {
      const res = await apiFetch("/subscription");
      if (!res.ok) {
        setErreurChargement(t("abonnement.erreurChargement"));
        return;
      }
      const data: Resume = await res.json();
      setResume(data);
      setErreurChargement("");
      if (data.periodicite) setPeriodicite(data.periodicite);
    } catch {
      setErreurChargement(t("abonnement.erreurChargement"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autorise) charger();
  }, [autorise, charger]);

  // Retour de la page de paiement par carte : /abonnement?paiement=<id>
  useEffect(() => {
    if (!autorise) return;
    const parametres = new URLSearchParams(window.location.search);
    const id = parametres.get("paiement");
    if (id) {
      setSuivi({ id });
      setResultat({ type: "attente", texte: t("abonnement.verification") });
      // On retire le paramètre de l'adresse pour ne pas revérifier à chaque rechargement
      window.history.replaceState(null, "", "/abonnement");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorise]);

  // Suivi d'un paiement : on demande au serveur où il en est
  useEffect(() => {
    if (!suivi) return;
    const debut = Date.now();

    async function verifier() {
      try {
        const res = await apiFetch(`/subscription/payments/${suivi!.id}`);
        if (!res.ok) return;
        const paiement: Paiement = await res.json();
        if (paiement.statut === "reussi") {
          arreter();
          setResultat({
            type: "succes",
            texte: t("abonnement.paiementReussi", {
              plan: nomDuPlan(paiement.plan, t),
              date: formaterDate(paiement.finPeriode),
            }),
          });
          window.dispatchEvent(new Event(EVENEMENT_ABONNEMENT_MODIFIE));
          charger();
        } else if (paiement.statut === "echoue") {
          arreter();
          setResultat({
            type: "echec",
            texte: t("abonnement.paiementEchoue", { raison: paiement.raisonEchec ?? "" }),
          });
          charger();
        } else if (Date.now() - debut > DUREE_MAX_SUIVI_MS) {
          arreter();
          setResultat({ type: "attente", texte: t("abonnement.paiementToujoursEnAttente") });
          charger();
        }
      } catch {
        // réseau coupé un instant : on réessaie au prochain tour
      }
    }

    function arreter() {
      if (minuterie.current) clearInterval(minuterie.current);
      minuterie.current = null;
      setSuivi(null);
    }

    verifier();
    minuterie.current = setInterval(verifier, INTERVALLE_SUIVI_MS);
    return () => {
      if (minuterie.current) clearInterval(minuterie.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivi?.id]);

  function ouvrirPaiement(plan: PlanPayable) {
    setPlanChoisi(plan);
    setMoyen("mobile");
    setErreurPaiement("");
    setResultat(null);
  }

  function fermerPaiement() {
    if (envoi) return;
    setPlanChoisi(null);
    setErreurPaiement("");
  }

  async function payer() {
    if (!planChoisi) return;
    setEnvoi(true);
    setErreurPaiement("");
    try {
      if (moyen === "mobile") {
        const res = await apiFetch("/subscription/pay/mobile", {
          method: "POST",
          body: JSON.stringify({ plan: planChoisi.code, periodicite, telephone }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErreurPaiement(typeof data.message === "string" ? data.message : t("abonnement.erreurPaiement"));
          return;
        }
        setPlanChoisi(null);
        setSuivi({ id: data.id, ussdCode: data.ussdCode });
        setResultat({ type: "attente", texte: t("abonnement.validerSurTelephone") });
      } else {
        const res = await apiFetch("/subscription/pay/card", {
          method: "POST",
          body: JSON.stringify({ plan: planChoisi.code, periodicite }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.lien) {
          setErreurPaiement(typeof data.message === "string" ? data.message : t("abonnement.erreurPaiement"));
          return;
        }
        // Direction la page de paiement de CamPay ; elle revient ici à la fin
        window.location.href = data.lien;
      }
    } catch {
      setErreurPaiement(t("abonnement.erreurPaiement"));
    } finally {
      setEnvoi(false);
    }
  }

  if (!autorise) return null;

  const prixDe = (plan: PlanPayable) => (periodicite === "annuel" ? plan.prixAnnuel : plan.prixMensuel);

  function libelleStatut(etat: EtatAbonnement) {
    if (etat.statut === "gratuit") return t("abonnement.statut.gratuit");
    if (etat.statut === "actif") {
      return etat.finAbonnement
        ? t("abonnement.statut.actifJusquau", { date: formaterDate(etat.finAbonnement) })
        : t("abonnement.statut.actif");
    }
    if (etat.statut === "grace") {
      return t("abonnement.statut.grace", { date: formaterDate(etat.finGrace) });
    }
    return t("abonnement.statut.lectureSeule");
  }

  function barre(utilise: number, limite: number) {
    const pourcentage = Math.min(100, Math.round((utilise / Math.max(1, limite)) * 100));
    const couleur = pourcentage >= 100 ? "bg-error" : pourcentage >= 80 ? "bg-seal" : "bg-accent";
    return (
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${pourcentage}%` }} />
      </div>
    );
  }

  const couleurStatut = (statut: EtatAbonnement["statut"]) =>
    statut === "lecture_seule"
      ? "bg-error/10 text-error"
      : statut === "grace"
        ? "bg-seal/15 text-ink"
        : "bg-accent/10 text-accent";

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl text-ink sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {t("abonnement.titre")}
        </h1>
        <p className="mb-6 mt-2 text-base text-ink-soft">{t("abonnement.consigne")}</p>

        {erreurChargement && (
          <p className="mb-6 rounded-xl bg-error/10 px-4 py-3 text-base text-error">{erreurChargement}</p>
        )}

        {/* Résultat d'un paiement (en attente, réussi, échoué) */}
        {resultat && (
          <div
            role="status"
            className={
              "mb-6 rounded-xl px-4 py-3 text-base " +
              (resultat.type === "succes"
                ? "bg-accent/10 text-accent"
                : resultat.type === "echec"
                  ? "bg-error/10 text-error"
                  : "bg-seal/15 text-ink")
            }
          >
            <p className="font-medium">{resultat.texte}</p>
            {suivi?.ussdCode && resultat.type === "attente" && (
              <p className="mt-1 text-sm">{t("abonnement.codeUssd", { code: suivi.ussdCode })}</p>
            )}
            {suivi && <p className="mt-1 text-sm text-ink-soft">{t("abonnement.attenteEnCours")}</p>}
          </div>
        )}

        {!resume && !erreurChargement && <p className="text-base text-ink-soft">{t("commun.chargement")}</p>}

        {resume && (
          <>
            {/* Plan actuel et utilisation */}
            <section className="mb-8 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-soft">{t("abonnement.planActuel")}</p>
                  <p className="mt-1 text-2xl font-semibold text-ink">
                    {nomDuPlan(resume.plan.code, t, resume.plan.nom)}
                    {resume.periodicite && resume.statut !== "gratuit" && (
                      <span className="ml-2 text-base font-medium text-ink-soft">
                        · {resume.periodicite === "annuel" ? t("abonnement.annuel") : t("abonnement.mensuel")}
                      </span>
                    )}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${couleurStatut(resume.statut)}`}>
                  {libelleStatut(resume)}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{t("abonnement.facturesCeMois")}</span>
                    <span className="text-ink-soft">
                      {resume.factures.utilisees} / {resume.factures.limite}
                    </span>
                  </div>
                  {barre(resume.factures.utilisees, resume.factures.limite)}
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{t("abonnement.comptes")}</span>
                    <span className="text-ink-soft">
                      {resume.comptes.utilises} / {resume.comptes.limite}
                    </span>
                  </div>
                  {barre(resume.comptes.utilises, resume.comptes.limite)}
                </div>
              </div>
            </section>

            {/* Choix d'un plan */}
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">{t("abonnement.choisirPlan")}</h2>
              <div role="tablist" className="flex rounded-full border border-ink/15 bg-white p-1">
                {(["mensuel", "annuel"] as Periodicite[]).map((p) => (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={periodicite === p}
                    onClick={() => setPeriodicite(p)}
                    className={
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
                      (periodicite === p ? "bg-accent text-white" : "text-ink hover:bg-paper")
                    }
                  >
                    {p === "annuel" ? t("abonnement.parAn") : t("abonnement.parMois")}
                  </button>
                ))}
              </div>
            </div>

            {!resume.paiementEnLigne && (
              <p className="mb-4 rounded-xl bg-seal/15 px-4 py-3 text-sm text-ink">{t("abonnement.paiementIndisponible")}</p>
            )}

            <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Plan Gratuit : rien à payer */}
              {resume.plansGratuits.map((plan) => (
                <div key={plan.code} className="flex flex-col rounded-2xl border border-ink/10 bg-white p-5">
                  <p className="text-lg font-semibold text-ink">{nomDuPlan(plan.code, t, plan.nom)}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">0 FCFA</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
                    <li>{t("abonnement.nbFactures", { nombre: plan.factures })}</li>
                    <li>{t("abonnement.nbComptes", { nombre: plan.comptes })}</li>
                    <li>{t("abonnement.assistantInclus")}</li>
                  </ul>
                  {resume.plan.code === plan.code && (
                    <p className="mt-auto pt-5 text-sm font-semibold text-accent">{t("abonnement.votrePlan")}</p>
                  )}
                </div>
              ))}

              {resume.plans.map((plan) => {
                const prix = prixDe(plan);
                const estActuel = resume.plan.code === plan.code;
                return (
                  <div
                    key={plan.code}
                    className={
                      "flex flex-col rounded-2xl border bg-white p-5 " +
                      (estActuel ? "border-accent ring-2 ring-accent/20" : "border-ink/10")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-ink">{nomDuPlan(plan.code, t, plan.nom)}</p>
                      {estActuel && (
                        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                          {t("abonnement.votrePlan")}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-ink">
                      {prix ? formaterMontant(prix) : "—"}
                      {prix ? (
                        <span className="text-sm font-medium text-ink-soft">
                          {" "}
                          / {periodicite === "annuel" ? t("abonnement.an") : t("abonnement.mois")}
                        </span>
                      ) : null}
                    </p>
                    <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">
                      <li>{t("abonnement.nbFactures", { nombre: plan.factures })}</li>
                      <li>{t("abonnement.nbComptes", { nombre: plan.comptes })}</li>
                      <li>{t("abonnement.assistantInclus")}</li>
                    </ul>
                    <div className="mt-auto pt-5">
                      <button
                        type="button"
                        disabled={!prix || !resume.paiementEnLigne || Boolean(suivi)}
                        onClick={() => ouvrirPaiement(plan)}
                        className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                      >
                        {!prix
                          ? t("abonnement.pasDisponible")
                          : estActuel
                            ? t("abonnement.renouveler")
                            : t("abonnement.choisir")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="-mt-6 mb-10 text-sm text-ink-soft">{t("abonnement.surMesure")}</p>

            {/* Derniers paiements */}
            <h2 className="mb-3 text-xl font-semibold text-ink">{t("abonnement.historique")}</h2>
            {resume.paiements.length === 0 ? (
              <p className="text-base text-ink-soft">{t("abonnement.aucunPaiement")}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-ink/10 text-ink-soft">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("abonnement.colDate")}</th>
                      <th className="px-4 py-3 font-medium">{t("abonnement.colPlan")}</th>
                      <th className="px-4 py-3 font-medium">{t("abonnement.colMoyen")}</th>
                      <th className="px-4 py-3 font-medium">{t("abonnement.colPar")}</th>
                      <th className="px-4 py-3 text-right font-medium">{t("abonnement.colMontant")}</th>
                      <th className="px-4 py-3 font-medium">{t("abonnement.colStatut")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resume.paiements.map((p) => (
                      <tr key={p.id} className="border-b border-ink/5 last:border-0">
                        <td className="px-4 py-3 text-ink-soft">{formaterDate(p.date)}</td>
                        <td className="px-4 py-3 text-ink">
                          {nomDuPlan(p.plan, t)} ·{" "}
                          {p.periodicite === "annuel" ? t("abonnement.annuel") : t("abonnement.mensuel")}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          {p.moyen === "carte" ? t("abonnement.carte") : t("abonnement.mobileMoney")}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{p.payeParNom || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{formaterMontant(p.montant)}</td>
                        <td className="px-4 py-3">
                          <span
                            title={p.raisonEchec ?? undefined}
                            className={
                              "rounded-full px-2.5 py-1 text-xs font-semibold " +
                              (p.statut === "reussi"
                                ? "bg-accent/10 text-accent"
                                : p.statut === "echoue"
                                  ? "bg-error/10 text-error"
                                  : "bg-seal/15 text-ink")
                            }
                          >
                            {t(`abonnement.statutPaiement.${p.statut}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fenêtre de paiement */}
      {planChoisi && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t("abonnement.payer")}>
          <button
            type="button"
            aria-label={t("abonnement.fermer")}
            onClick={fermerPaiement}
            className="absolute inset-0 h-full w-full bg-ink/40"
          />
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-3xl">
            <h2 className="text-xl font-semibold text-ink">
              {t("abonnement.payerPlan", { plan: nomDuPlan(planChoisi.code, t, planChoisi.nom) })}
            </h2>
            <p className="mt-1 text-base text-ink-soft">
              {formaterMontant(prixDe(planChoisi) ?? 0)} ·{" "}
              {periodicite === "annuel" ? t("abonnement.unAn") : t("abonnement.unMois")}
            </p>
            {resume && resume.plan.code !== planChoisi.code && resume.statut === "actif" && (
              <p className="mt-3 rounded-xl bg-seal/15 px-3 py-2 text-sm text-ink">{t("abonnement.changementPlan")}</p>
            )}

            {/* Mobile Money ou carte */}
            <div role="tablist" className="mt-5 grid grid-cols-2 gap-2">
              {(["mobile", "carte"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={moyen === m}
                  onClick={() => setMoyen(m)}
                  className={
                    "h-11 rounded-xl text-sm font-semibold transition " +
                    (moyen === m ? "bg-ink text-white" : "border border-ink/15 bg-white text-ink hover:bg-paper")
                  }
                >
                  {m === "mobile" ? t("abonnement.mobileMoney") : t("abonnement.carte")}
                </button>
              ))}
            </div>

            {moyen === "mobile" ? (
              <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-ink">
                {t("abonnement.numeroQuiPaie")}
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="6 90 00 00 00"
                  className="h-12 rounded-xl border border-ink/15 bg-white px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <span className="text-xs font-normal text-ink-soft">{t("abonnement.aideMobile")}</span>
              </label>
            ) : (
              <p className="mt-5 text-sm text-ink-soft">{t("abonnement.aideCarte")}</p>
            )}

            {erreurPaiement && (
              <p className="mt-4 rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{erreurPaiement}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={fermerPaiement}
                disabled={envoi}
                className="h-12 flex-1 rounded-xl border border-ink/15 bg-white text-sm font-semibold text-ink hover:bg-paper disabled:opacity-50"
              >
                {t("abonnement.annuler")}
              </button>
              <button
                type="button"
                onClick={payer}
                disabled={envoi || (moyen === "mobile" && telephone.replace(/\D/g, "").length < 9)}
                className="h-12 flex-1 rounded-xl bg-accent text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {envoi
                  ? t("abonnement.envoiEnCours")
                  : moyen === "mobile"
                    ? t("abonnement.envoyerDemande")
                    : t("abonnement.allerPageCarte")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}