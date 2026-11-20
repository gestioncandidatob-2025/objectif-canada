"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";
import ChampTelephone from "../../components/ChampTelephone";
import Pagination, { usePagination } from "../../components/Pagination";

/**
 * Mobile Money (administrateur) : l'argent payé par les candidats avec
 * CamPay, son solde (après les frais CamPay) et les retraits vers le
 * numéro du centre. Un retrait est validé par HREFF avant l'envoi.
 */

type StatutRetrait = "demande" | "en_cours" | "envoye" | "refuse" | "echoue";

type Portefeuille = {
  brut: number;
  frais: number;
  commission: number;
  net: number;
  nombrePaiements: number;
  retire: number;
  enCours: number;
  solde: number;
  retraitMinimum: number;
  paiements: {
    id: string;
    date: string;
    type: "inscription" | "reste";
    candidatNom: string | null;
    montant: number;
    frais: number;
    net: number;
    statut: "reussi" | "echoue" | "en_attente";
    raisonEchec: string | null;
    erreurFacture: string | null;
    lanceParNom: string | null;
  }[];
  retraits: {
    id: string;
    montant: number;
    telephone: string;
    statut: StatutRetrait;
    raison: string | null;
    date: string | null;
  }[];
};

const COULEUR_RETRAIT: Record<StatutRetrait, string> = {
  demande: "bg-seal/15 text-ink",
  en_cours: "bg-seal/15 text-ink",
  envoye: "bg-accent/10 text-accent",
  refuse: "bg-error/10 text-error",
  echoue: "bg-error/10 text-error",
};

export default function MobileMoneyPage() {
  const router = useRouter();
  const { t, locale } = useLangue();
  const [autorise, setAutorise] = useState(false);
  const [donnees, setDonnees] = useState<Portefeuille | null>(null);
  const [campayActive, setCampayActive] = useState(true);
  const [erreur, setErreur] = useState("");

  // Demande de retrait
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [montant, setMontant] = useState("");
  const [telephone, setTelephone] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurRetrait, setErreurRetrait] = useState("");
  const [succes, setSucces] = useState("");

  const pages = usePagination(donnees?.paiements ?? [], 15);

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
    const [rPortefeuille, rReglages] = await Promise.all([
      apiFetch("/mobile-payments/wallet"),
      apiFetch("/center/settings"),
    ]);
    if (rPortefeuille.ok) {
      setDonnees(await rPortefeuille.json());
    } else {
      setErreur(t("connexion.erreurServeur"));
    }
    if (rReglages.ok) {
      const reglages = await rReglages.json();
      setCampayActive(Array.isArray(reglages.modesPaiement) && reglages.modesPaiement.includes("campay"));
    }
  }, [t]);

  useEffect(() => {
    if (autorise) charger();
  }, [autorise, charger]);

  async function demanderRetrait() {
    if (!donnees) return;
    setErreurRetrait("");
    setSucces("");
    const valeur = Number(montant.replace(/\D/g, ""));
    if (!valeur || valeur <= 0) {
      setErreurRetrait(t("mobileMoney.erreurMontant"));
      return;
    }
    if (telephone.length !== 9) {
      setErreurRetrait(t("mobileMoney.erreurNumero"));
      return;
    }
    setEnvoi(true);
    try {
      const res = await apiFetch("/mobile-payments/withdrawals", {
        method: "POST",
        body: JSON.stringify({ montant: valeur, telephone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreurRetrait(Array.isArray(data.message) ? data.message.join(", ") : data.message);
        return;
      }
      setSucces(t("mobileMoney.demandeEnvoyee"));
      setFormulaireOuvert(false);
      setMontant("");
      charger();
    } finally {
      setEnvoi(false);
    }
  }

  if (!autorise) return null;

  const fcfa = (valeur: number) => `${valeur.toLocaleString(locale)} FCFA`;
  const date = (valeur: string | null) =>
    valeur
      ? new Date(valeur).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
      : "—";

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl text-ink sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {t("mobileMoney.titre")}
        </h1>
        <p className="mb-6 mt-2 text-base text-ink-soft">{t("mobileMoney.description")}</p>

        {!campayActive && (
          <p className="mb-6 rounded-xl border border-seal/40 bg-seal/10 px-4 py-3 text-sm text-ink">
            {t("mobileMoney.pasActive")}
          </p>
        )}
        {erreur && <p className="mb-6 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{erreur}</p>}
        {succes && <p className="mb-6 rounded-lg bg-accent/10 px-3 py-2.5 text-sm text-accent">{succes}</p>}

        {donnees && (
          <>
            {/* Chiffres clés */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-accent p-5 text-white shadow-sm">
                <p className="text-sm font-medium text-white/85">{t("mobileMoney.solde")}</p>
                <p className="mt-2 text-3xl font-semibold">{fcfa(donnees.solde)}</p>
                <p className="mt-1 text-xs text-white/80">{t("mobileMoney.soldeAide")}</p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-ink-soft">{t("mobileMoney.recuNet")}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{fcfa(donnees.net)}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {t("mobileMoney.recuNetAide", { n: donnees.nombrePaiements, brut: fcfa(donnees.brut) })}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-ink-soft">{t("mobileMoney.frais")}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{fcfa(donnees.frais + donnees.commission)}</p>
                <p className="mt-1 text-xs text-ink-soft">{t("mobileMoney.fraisAide")}</p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-ink-soft">{t("mobileMoney.retire")}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{fcfa(donnees.retire)}</p>
                {donnees.enCours > 0 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {t("mobileMoney.enCours", { montant: fcfa(donnees.enCours) })}
                  </p>
                )}
              </div>
            </div>

            {/* Retirer */}
            <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
              {!formulaireOuvert ? (
                <button
                  onClick={() => {
                    setFormulaireOuvert(true);
                    setErreurRetrait("");
                    setSucces("");
                    setMontant(donnees.solde > 0 ? String(donnees.solde) : "");
                  }}
                  disabled={donnees.solde < donnees.retraitMinimum}
                  className="h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("mobileMoney.retirer")}
                </button>
              ) : (
                <div className="grid max-w-xl gap-4">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
                    {t("mobileMoney.montant")}
                    <input
                      inputMode="numeric"
                      value={montant}
                      onChange={(e) => setMontant(e.target.value.replace(/[^\d\s]/g, ""))}
                      className="h-11 rounded-lg border border-ink/15 px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <span className="text-xs font-normal">
                      {t("mobileMoney.minimum", { montant: fcfa(donnees.retraitMinimum) })}
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
                    {t("mobileMoney.numero")}
                    <ChampTelephone value={telephone} onChange={setTelephone} />
                  </label>
                  {erreurRetrait && (
                    <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{erreurRetrait}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFormulaireOuvert(false)}
                      disabled={envoi}
                      className="h-11 flex-1 rounded-xl border border-ink/15 text-sm font-semibold text-ink hover:bg-paper"
                    >
                      {t("mobileMoney.annuler")}
                    </button>
                    <button
                      onClick={demanderRetrait}
                      disabled={envoi}
                      className="h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                      {t("mobileMoney.envoyerDemande")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Retraits */}
            <h2 className="mb-3 mt-8 text-xl font-semibold text-ink">{t("mobileMoney.retraits")}</h2>
            {donnees.retraits.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("mobileMoney.aucunRetrait")}</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-ink/10 text-ink-soft">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("mobileMoney.colDate")}</th>
                      <th className="px-4 py-3 text-right font-medium">{t("mobileMoney.colMontant")}</th>
                      <th className="px-4 py-3 font-medium">{t("mobileMoney.colNumero")}</th>
                      <th className="px-4 py-3 font-medium">{t("mobileMoney.colStatut")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donnees.retraits.map((r) => (
                      <tr key={r.id} className="border-b border-ink/5 last:border-0">
                        <td className="px-4 py-3 text-ink-soft">{date(r.date)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{fcfa(r.montant)}</td>
                        <td className="px-4 py-3 text-ink-soft">{r.telephone.replace(/^237/, "")}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COULEUR_RETRAIT[r.statut]}`}>
                            {t(`mobileMoney.statutRetrait.${r.statut}`)}
                          </span>
                          {r.raison && <p className="mt-1 text-xs text-ink-soft">{r.raison}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paiements reçus */}
            <h2 className="mb-3 mt-8 text-xl font-semibold text-ink">{t("mobileMoney.paiements")}</h2>
            {donnees.paiements.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("mobileMoney.aucunPaiement")}</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="border-b border-ink/10 text-ink-soft">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t("mobileMoney.colDate")}</th>
                        <th className="px-4 py-3 font-medium">{t("mobileMoney.colCandidat")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("mobileMoney.colPaye")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("mobileMoney.colFrais")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("mobileMoney.colNet")}</th>
                        <th className="px-4 py-3 font-medium">{t("mobileMoney.colStatut")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.elements.map((p) => (
                        <tr key={p.id} className="border-b border-ink/5 last:border-0">
                          <td className="px-4 py-3 text-ink-soft">{date(p.date)}</td>
                          <td className="px-4 py-3 text-ink">
                            {p.candidatNom ?? "—"}
                            {p.lanceParNom && <span className="block text-xs text-ink-soft">{p.lanceParNom}</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-ink">{fcfa(p.montant)}</td>
                          <td className="px-4 py-3 text-right text-ink-soft">
                            {p.statut === "reussi" ? fcfa(p.frais) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-ink">
                            {p.statut === "reussi" ? fcfa(p.net) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                "rounded-full px-2.5 py-1 text-xs font-semibold " +
                                (p.statut === "reussi" ? "bg-accent/10 text-accent" : "bg-error/10 text-error")
                              }
                            >
                              {t(`mobileMoney.statutPaiement.${p.statut}`)}
                            </span>
                            {p.erreurFacture && (
                              <p className="mt-1 text-xs font-medium text-error" title={p.erreurFacture}>
                                ⚠ {t("mobileMoney.factureARegulariser")}
                              </p>
                            )}
                            {p.statut === "echoue" && p.raisonEchec && (
                              <p className="mt-1 text-xs text-ink-soft">{p.raisonEchec}</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={pages.page}
                  totalPages={pages.totalPages}
                  onChange={pages.setPage}
                  texte={t("mobileMoney.pagination", { page: pages.page, total: pages.totalPages, n: pages.total })}
                  precedent={t("candidats.precedent")}
                  suivant={t("candidats.suivant")}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}