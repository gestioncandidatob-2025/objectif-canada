"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

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
  date: string;
};

const MODULES = [
  "Candidats",
  "Inscriptions",
  "Utilisateurs",
  "Tarifs",
  "Factures",
  "Authentification",
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
        setErreur("Impossible de charger l'historique");
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
    <div className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1
            className="text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Historique des actions
          </h1>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass}>Utilisateur</label>
            <input
              value={utilisateur}
              onChange={(e) => setUtilisateur(e.target.value)}
              placeholder="Nom ou email"
              className={champClass}
            />
          </div>
          <div>
            <label className={labelClass}>Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className={champClass}
            >
              <option value="">Tous</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Du</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className={champClass}
            />
          </div>
          <div>
            <label className={labelClass}>Au</label>
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
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        {chargement && <p className="text-sm text-ink-soft">Chargement...</p>}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Élément modifié</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((entree) => (
                <tr key={entree._id} className="border-b border-ink/5">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                    {new Date(entree.date).toLocaleString("fr-FR")}
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
                  <td className="px-4 py-3">{entree.module}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-3 py-1 text-xs font-medium " +
                        (entree.statut === "succès"
                          ? "bg-accent/10 text-accent"
                          : "bg-error/10 text-error")
                      }
                    >
                      {entree.statut}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-ink-soft">
                    {entree.details || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {entrees.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              Aucune action trouvée.
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
            <button
              onClick={() => charger(page - 1)}
              disabled={page <= 1 || chargement}
              className="rounded-lg border border-ink/15 px-4 py-2 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              Précédent
            </button>
            <span>
              Page {page} sur {totalPages} — {total} action{total > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => charger(page + 1)}
              disabled={page >= totalPages || chargement}
              className="rounded-lg border border-ink/15 px-4 py-2 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}