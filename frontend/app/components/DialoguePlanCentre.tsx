"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import {
  BadgePlan,
  ICONES,
  NOMS_PLANS,
  boutonPrincipal,
  champClass,
  dateCourte,
  labelClass,
  messageErreur,
  versNombre,
} from "./SuperAdminUI";

/**
 * Espace super admin — fenêtre « Changer le plan » d'un centre (en français).
 * Ouverte depuis le tableau des centres. Offrir un plan pour une période
 * (retour automatique au plan d'avant), ou régler l'abonnement à la main
 * (Sur mesure, paiement reçu hors CamPay).
 */

type AbonnementCentre = {
  plan: { code: string; nom: string };
  statut: string;
  periodicite: string | null;
  finAbonnement: string | null;
  factures: { utilisees: number; limite: number };
  comptes: { utilises: number; limite: number };
  surMesure: { factures?: number; comptes?: number; prixMensuel?: number; prixAnnuel?: number } | null;
  offre: { fin: string; planPrecedent: string } | null;
};

const STATUTS: Record<string, { texte: string; classe: string }> = {
  gratuit: { texte: "Gratuit", classe: "bg-ink/5 text-ink-soft" },
  actif: { texte: "Actif", classe: "bg-accent/10 text-accent" },
  grace: { texte: "Période de grâce", classe: "bg-seal/15 text-ink" },
  lecture_seule: { texte: "Lecture seule", classe: "bg-error/10 text-error" },
};

const REGLAGE_VIDE = {
  plan: "gratuit",
  periodicite: "mensuel",
  finAbonnement: "",
  smFactures: "",
  smComptes: "",
  smPrixMensuel: "",
  smPrixAnnuel: "",
};

export default function DialoguePlanCentre({
  centreId,
  nomCentre,
  onFermer,
  onEnregistre,
}: {
  centreId: string;
  nomCentre: string;
  onFermer: () => void;
  // Appelé après un enregistrement réussi, avec le message à afficher
  onEnregistre: (message: string) => void;
}) {
  const [abonnement, setAbonnement] = useState<AbonnementCentre | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [offre, setOffre] = useState({ plan: "pro", duree: "3", fin: "" });
  const [reglage, setReglage] = useState(REGLAGE_VIDE);

  // L'abonnement du centre choisi
  const chargerAbonnement = useCallback(async (centreId: string) => {
    const res = await apiFetch(`/subscriptions/centers/${centreId}`);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const data: AbonnementCentre = await res.json();
    setAbonnement(data);
    setReglage({
      plan: data.plan.code,
      periodicite: data.periodicite ?? "mensuel",
      finAbonnement: data.finAbonnement ? data.finAbonnement.slice(0, 10) : "",
      smFactures: data.surMesure?.factures ? String(data.surMesure.factures) : "",
      smComptes: data.surMesure?.comptes ? String(data.surMesure.comptes) : "",
      smPrixMensuel: data.surMesure?.prixMensuel ? String(data.surMesure.prixMensuel) : "",
      smPrixAnnuel: data.surMesure?.prixAnnuel ? String(data.surMesure.prixAnnuel) : "",
    });
  }, []);

  useEffect(() => {
    chargerAbonnement(centreId);
  }, [centreId, chargerAbonnement]);

  // Touche Échap : on ferme la fenêtre
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  /** Après un enregistrement réussi : la fenêtre se ferme et la page affiche le message */
  function termine(message: string) {
    onEnregistre(message);
  }

  async function offrirPlan(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    const corps: Record<string, unknown> = { plan: offre.plan };
    if (offre.duree === "date") {
      if (!offre.fin) {
        setErreur("Choisis la date de fin de l'offre");
        return;
      }
      corps.fin = offre.fin;
    } else {
      corps.mois = Number(offre.duree);
    }
    setEnvoiEnCours(true);
    const res = await apiFetch(`/subscriptions/centers/${centreId}/offer`, {
      method: "POST",
      body: JSON.stringify(corps),
    });
    setEnvoiEnCours(false);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const data: AbonnementCentre = await res.json();
    termine(
      `Plan ${NOMS_PLANS[offre.plan] ?? offre.plan} offert à « ${nomCentre} » jusqu'au ${dateCourte(data.offre?.fin)}. ` +
        "Il reviendra tout seul à son plan d'avant à cette date.",
    );
  }

  async function arreterOffre() {
    if (!window.confirm("Arrêter l'offre maintenant ? Le centre revient tout de suite à son plan d'avant.")) return;
    setErreur("");
    const res = await apiFetch(`/subscriptions/centers/${centreId}/offer`, { method: "DELETE" });
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    termine(`Offre arrêtée : « ${nomCentre} » est revenu à son plan d'avant.`);
  }

  async function enregistrerReglage(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
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
    setEnvoiEnCours(true);
    const res = await apiFetch(`/subscriptions/centers/${centreId}`, {
      method: "PATCH",
      body: JSON.stringify(corps),
    });
    setEnvoiEnCours(false);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const enregistre: AbonnementCentre = await res.json();
    const resume = [
      enregistre.plan.nom,
      enregistre.periodicite ? (enregistre.periodicite === "annuel" ? "annuel" : "mensuel") : null,
      enregistre.finAbonnement ? `payé jusqu'au ${dateCourte(enregistre.finAbonnement)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    termine(`Abonnement de « ${nomCentre} » enregistré : ${resume}.`);
  }

  const statut = abonnement ? STATUTS[abonnement.statut] ?? STATUTS.gratuit : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/50 px-3 py-6 sm:py-10"
      onMouseDown={(e) => {
        // Clic sur le fond sombre : on ferme
        if (e.target === e.currentTarget) onFermer();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-3xl rounded-2xl bg-paper shadow-2xl">
        <div className="flex items-start justify-between gap-3 rounded-t-2xl border-b border-ink/10 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-seal">Changer le plan</p>
            <h2 className="mt-0.5 text-xl font-semibold text-ink">{nomCentre}</h2>
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-lg p-2 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {erreur && <p className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">{erreur}</p>}
          {!abonnement && !erreur && <p className="text-ink-soft">Chargement…</p>}

      <section>
        {abonnement && statut && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-ink/10 bg-white p-3">
              <p className="text-xs text-ink-soft">Plan</p>
              <div className="mt-1.5">
                <BadgePlan code={abonnement.plan.code} nom={abonnement.plan.nom} />
              </div>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-3">
              <p className="text-xs text-ink-soft">État</p>
              <span className={`mt-1.5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statut.classe}`}>
                {abonnement.offre ? "Offert" : statut.texte}
              </span>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-3">
              <p className="text-xs text-ink-soft">Factures ce mois</p>
              <p className="mt-1 font-semibold text-ink">
                {abonnement.factures.utilisees} / {abonnement.factures.limite}
              </p>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-3">
              <p className="text-xs text-ink-soft">{abonnement.offre ? "Offert jusqu'au" : "Payé jusqu'au"}</p>
              <p className="mt-1 font-semibold text-ink">{dateCourte(abonnement.finAbonnement)}</p>
            </div>
          </div>
        )}
      </section>

      {abonnement && (
        <>
          {/* 2. Offrir un plan */}
          <section className="rounded-2xl border border-seal/30 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-seal/15 text-seal">{ICONES.cadeau}</span>
              Offrir un plan
            </h2>
            {abonnement.offre ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-seal/10 px-4 py-3 text-sm">
                <p className="text-ink">
                  Offre en cours : <strong>{abonnement.plan.nom}</strong> jusqu&apos;au{" "}
                  <strong>{dateCourte(abonnement.offre.fin)}</strong>, puis retour au plan{" "}
                  <strong>{NOMS_PLANS[abonnement.offre.planPrecedent] ?? abonnement.offre.planPrecedent}</strong>. Tu
                  peux la changer ci-dessous.
                </p>
                <button
                  type="button"
                  onClick={arreterOffre}
                  className="rounded-lg border border-error/30 bg-white px-3 py-2 text-sm font-semibold text-error hover:bg-error/5"
                >
                  Arrêter l&apos;offre
                </button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">
                Le centre passe à ce plan sans payer. À la fin, il revient tout seul à son plan actuel, avec le temps payé
                qu&apos;il lui restait.
              </p>
            )}
            <form onSubmit={offrirPlan} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
              <label className={labelClass}>
                Plan offert
                <select value={offre.plan} onChange={(e) => setOffre({ ...offre, plan: e.target.value })} className={champClass}>
                  <option value="standard">Standard</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
              <label className={labelClass}>
                Durée
                <select value={offre.duree} onChange={(e) => setOffre({ ...offre, duree: e.target.value })} className={champClass}>
                  <option value="1">1 mois</option>
                  <option value="2">2 mois</option>
                  <option value="3">3 mois</option>
                  <option value="6">6 mois</option>
                  <option value="12">12 mois</option>
                  <option value="date">Jusqu&apos;à une date…</option>
                </select>
              </label>
              {offre.duree === "date" && (
                <label className={labelClass}>
                  Jusqu&apos;au
                  <input
                    type="date"
                    value={offre.fin}
                    onChange={(e) => setOffre({ ...offre, fin: e.target.value })}
                    className={champClass}
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={envoiEnCours}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-seal px-5 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
              >
                {envoiEnCours ? "Enregistrement…" : abonnement.offre ? "Changer l'offre" : "Offrir"}
              </button>
            </form>
          </section>

          {/* 3. Régler à la main */}
          <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Régler l&apos;abonnement à la main</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Pour un plan Sur mesure, ou un paiement reçu en dehors de CamPay. Ce réglage remplace une offre en cours.
            </p>
            <form onSubmit={enregistrerReglage} className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  Plan
                  <select value={reglage.plan} onChange={(e) => setReglage({ ...reglage, plan: e.target.value })} className={champClass}>
                    <option value="gratuit">Gratuit</option>
                    <option value="standard">Standard</option>
                    <option value="pro">Pro</option>
                    <option value="sur_mesure">Sur mesure</option>
                  </select>
                </label>
                {reglage.plan !== "gratuit" && (
                  <>
                    <label className={labelClass}>
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
                    <label className={labelClass}>
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
                    <label key={cle} className={labelClass}>
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
                <button type="submit" disabled={envoiEnCours} className={boutonPrincipal}>
                  {envoiEnCours ? "Enregistrement…" : "Enregistrer l'abonnement"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
        </div>
      </div>
    </div>
  );
}