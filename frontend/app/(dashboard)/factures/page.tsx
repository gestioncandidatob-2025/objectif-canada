"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

type Candidat = {
  nom: string;
  prenom: string;
  telephone: string;
};

type Facture = {
  _id: string;
  candidatId: Candidat;
  service: string;
  numeroRecu: string;
  dateInscription: string;
  montantTotal: number;
};

const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  tcf_2mois: "TCF 2 mois",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

// Date du jour au format AAAA-MM-JJ (heure locale), pour les champs de date
function dateDuJour(decalageJour = 0): string {
  const d = new Date();
  if (decalageJour === 1) d.setDate(1); // 1er jour du mois
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function formaterNomService(service: string): string {
  if (LABEL_SERVICE[service]) return LABEL_SERVICE[service];
  return service
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

export default function FacturesPage() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [ouvertureEnCours, setOuvertureEnCours] = useState<string | null>(null);
  const { t, locale } = useLangue();

  // Export Excel (administrateur seulement) : par défaut, le mois en cours
  const [estAdmin, setEstAdmin] = useState(false);
  const [exportDebut, setExportDebut] = useState(dateDuJour(1));
  const [exportFin, setExportFin] = useState(dateDuJour());
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState("");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setEstAdmin(JSON.parse(userStr).role === "admin");
    }
  }, []);

  async function exporterExcel() {
    setErreurExport("");
    if (!exportDebut || !exportFin) {
      setErreurExport(t("factures.erreurDates"));
      return;
    }
    if (exportDebut > exportFin) {
      setErreurExport(t("factures.erreurOrdreDates"));
      return;
    }
    setExportEnCours(true);
    try {
      const res = await apiFetch(
        `/registrations/export?debut=${exportDebut}&fin=${exportFin}`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErreurExport(
          data?.message
            ? Array.isArray(data.message)
              ? data.message.join(", ")
              : data.message
            : t("factures.erreurExport"),
        );
        return;
      }
      // Le fichier arrive : on le télécharge
      const fichier = await res.blob();
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(fichier);
      lien.download = `factures-${exportDebut}-au-${exportFin}.xlsx`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(lien.href);
    } catch {
      setErreurExport(t("connexion.erreurServeur"));
    } finally {
      setExportEnCours(false);
    }
  }

  async function chargerFactures() {
    setChargement(true);
    setErreur("");
    const res = await apiFetch("/registrations/factures/liste");
    if (res.ok) {
      setFactures(await res.json());
    } else {
      setErreur(t("factures.erreurChargement"));
    }
    setChargement(false);
  }

  useEffect(() => {
    chargerFactures();
  }, []);

  async function ouvrirFacture(id: string) {
    setOuvertureEnCours(id);
    setErreur("");
    const res = await apiFetch(`/registrations/${id}/facture`);
    setOuvertureEnCours(null);

    if (!res.ok) {
      const data = await res.json();
      setErreur(
        Array.isArray(data.message) ? data.message.join(", ") : data.message,
      );
      return;
    }

    const data = await res.json();
    window.open(data.url, "_blank");
  }

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <h1
          className="mb-2 text-2xl text-ink sm:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("menu.factures")}
        </h1>
        <p className="mb-6 text-sm text-ink-soft">{t("factures.description")}</p>

        {estAdmin && (
          <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-semibold text-ink">{t("factures.exportTitre")}</h2>
            <p className="mb-3 mt-1 text-sm text-ink-soft">{t("factures.exportAide")}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm text-ink-soft">
                {t("factures.du")}
                <input
                  type="date"
                  value={exportDebut}
                  onChange={(e) => setExportDebut(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <label className="flex-1 text-sm text-ink-soft">
                {t("factures.au")}
                <input
                  type="date"
                  value={exportFin}
                  onChange={(e) => setExportFin(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <button
                onClick={exporterExcel}
                disabled={exportEnCours}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportEnCours ? t("factures.exportEnCours") : t("factures.exporter")}
              </button>
            </div>
            {erreurExport && (
              <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                {erreurExport}
              </p>
            )}
          </div>
        )}

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}
        {chargement && <p className="mb-4 text-sm text-ink-soft">{t("commun.chargement")}</p>}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">{t("factures.recuNumero")}</th>
                <th className="px-4 py-3 font-medium">{t("factures.date")}</th>
                <th className="px-4 py-3 font-medium">{t("facture.candidat")}</th>
                <th className="px-4 py-3 font-medium">{t("facture.service")}</th>
                <th className="px-4 py-3 font-medium">{t("factures.montant")}</th>
                <th className="px-4 py-3 font-medium">{t("candidats.action")}</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f._id} className="border-b border-ink/5">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                    {f.numeroRecu}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Date(f.dateInscription).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-3">
                    {f.candidatId?.prenom} {f.candidatId?.nom}
                  </td>
                  <td className="px-4 py-3">
                    {formaterNomService(f.service)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {f.montantTotal.toLocaleString(locale)} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => ouvrirFacture(f._id)}
                      disabled={ouvertureEnCours === f._id}
                      className="whitespace-nowrap rounded-full border border-seal/30 bg-seal/10 px-4 py-1.5 text-xs font-medium text-seal transition hover:bg-seal/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ouvertureEnCours === f._id ? t("factures.ouverture") : t("factures.consulter")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {factures.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              {t("factures.aucune")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}