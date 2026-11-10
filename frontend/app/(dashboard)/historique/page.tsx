"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

type EntreeHistorique = {
  _id: string;
  utilisateurEmail: string;
  utilisateurNom?: string;
  role?: string;
  action: string;
  module: string;
  route?: string;
  statut: "succès" | "échec";
  details?: string;
  motif?: string;
  changements?: { champ: string; avant: string; apres: string }[];
  date: string;
};

// Valeur enregistrée par le serveur (en français) → clé de traduction pour l'affichage
const MODULES: { valeur: string; cle: string }[] = [
  { valeur: "Candidats", cle: "historique.moduleCandidats" },
  { valeur: "Inscriptions", cle: "historique.moduleInscriptions" },
  { valeur: "Utilisateurs", cle: "historique.moduleUtilisateurs" },
  { valeur: "Tarifs", cle: "historique.moduleTarifs" },
  { valeur: "Factures", cle: "historique.moduleFactures" },
  { valeur: "Authentification", cle: "historique.moduleAuthentification" },
];

const LIMITE = 30;

export default function HistoriquePage() {
  const [entrees, setEntrees] = useState<EntreeHistorique[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [utilisateur, setUtilisateur] = useState("");
  const [module, setModule] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const { t, locale } = useLangue();

  function libelleModule(valeur: string) {
    const trouve = MODULES.find((m) => m.valeur === valeur);
    return trouve ? t(trouve.cle) : valeur;
  }

  const charger = useCallback(
    async (pageDemandee: number) => {
      setChargement(true);
      setErreur("");

      const params = new URLSearchParams();
      if (utilisateur) params.set("utilisateur", utilisateur);
      if (module) params.set("module", module);
      if (dateDebut) params.set("dateDebut", dateDebut);
      if (dateFin) params.set("dateFin", dateFin);
      params.set("page", String(pageDemandee));
      params.set("limite", String(LIMITE));

      const res = await apiFetch(`/historique?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntrees(data.donnees);
        setTotal(data.total);
        setPage(data.page);
      } else {
        setErreur(t("historique.erreurChargement"));
      }
      setChargement(false);
    },
    [utilisateur, module, dateDebut, dateFin],
  );

  useEffect(() => {
    charger(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur, module, dateDebut, dateFin]);

  function reinitialiserFiltres() {
    setUtilisateur("");
    setModule("");
    setDateDebut("");
    setDateFin("");
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMITE));

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-xs font-medium text-ink-soft";

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1
            className="text-2xl text-ink sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("historique.titre")}
          </h1>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          <div>
            <label className={labelClass}>{t("historique.utilisateur")}</label>
            <input
              value={utilisateur}
              onChange={(e) => setUtilisateur(e.target.value)}
              placeholder={t("historique.nomOuEmail")}
              className={champClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("historique.module")}</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className={champClass}
            >
              <option value="">{t("historique.tous")}</option>
              {MODULES.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {t(m.cle)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t("historique.du")}</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className={champClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t("historique.au")}</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className={champClass}
            />
          </div>
          {(utilisateur || module || dateDebut || dateFin) && (
            <button
              onClick={reinitialiserFiltres}
              className="text-left text-sm font-medium text-seal hover:underline sm:col-span-2 lg:col-span-4"
            >
              {t("historique.reinitialiser")}
            </button>
          )}
        </div>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        {chargement && <p className="text-sm text-ink-soft">{t("commun.chargement")}</p>}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">{t("factures.date")}</th>
                <th className="px-4 py-3 font-medium">{t("historique.utilisateur")}</th>
                <th className="px-4 py-3 font-medium">{t("candidats.action")}</th>
                <th className="px-4 py-3 font-medium">{t("historique.module")}</th>
                <th className="px-4 py-3 font-medium">{t("candidats.statut")}</th>
                <th className="px-4 py-3 font-medium">{t("historique.element")}</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((entree) => (
                <tr key={entree._id} className="border-b border-ink/5">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                    {new Date(entree.date).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">
                      {entree.utilisateurNom || entree.utilisateurEmail}
                    </div>
                    {entree.utilisateurNom && (
                      <div className="text-xs text-ink-soft">
                        {entree.utilisateurEmail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{entree.action}</td>
                  <td className="px-4 py-3">{libelleModule(entree.module)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-3 py-1 text-xs font-medium " +
                        (entree.statut === "succès"
                          ? "bg-accent/10 text-accent"
                          : "bg-error/10 text-error")
                      }
                    >
                      {entree.statut === "succès" ? t("historique.succes") : t("historique.echec")}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-ink-soft">
                    {entree.details || "—"}
                    {/* Correction : ancienne et nouvelle valeur de chaque champ */}
                    {entree.changements && entree.changements.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {entree.changements.map((c, i) => (
                          <li key={i} className="rounded-md bg-paper px-2 py-1">
                            <span className="font-medium text-ink">{c.champ}</span> :{" "}
                            <span className="line-through">{c.avant}</span> →{" "}
                            <span className="font-medium text-ink">{c.apres}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {entree.motif && (
                      <p className="mt-1">
                        <span className="font-medium text-ink">{t("historique.motif")}</span> :{" "}
                        {entree.motif}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {entrees.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              {t("historique.aucune")}
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
            <button
              onClick={() => charger(page - 1)}
              disabled={page <= 1 || chargement}
              className="rounded-lg border border-ink/15 px-4 py-2 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("candidats.precedent")}
            </button>
            <span>
              {t("historique.pagination", { page, total: totalPages, n: total })}
            </span>
            <button
              onClick={() => charger(page + 1)}
              disabled={page >= totalPages || chargement}
              className="rounded-lg border border-ink/15 px-4 py-2 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("historique.suivant")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}