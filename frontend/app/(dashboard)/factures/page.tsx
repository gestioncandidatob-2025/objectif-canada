"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";
import Pagination, { usePagination } from "../../components/Pagination";

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
  modePaiement?: string;
  resteAPayer?: number;
};

// Libellés des modes de paiement (clés de traduction)
const MODES_PAIEMENT: { valeur: string; cle: string }[] = [
  { valeur: "especes", cle: "paiement.especes" },
  { valeur: "orange_money", cle: "paiement.orangeMoney" },
  { valeur: "mobile_money", cle: "paiement.mobileMoney" },
  { valeur: "mobile_especes", cle: "paiement.mixte" },
  { valeur: "campay", cle: "paiement.campay" },
];

/** Jour (AAAA-MM-JJ, heure locale) d'une date, pour la filtrer par période */
function jourLocal(date: string): string {
  const d = new Date(date);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/** Minuscules et sans accents, pour chercher « Hélène » en tapant « helene » */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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

  // Filtres
  const [recherche, setRecherche] = useState("");
  const [filtreService, setFiltreService] = useState("");
  const [filtreMode, setFiltreMode] = useState("");
  const [filtrePaiement, setFiltrePaiement] = useState<"" | "solde" | "reste">("");
  const [filtreDebut, setFiltreDebut] = useState("");
  const [filtreFin, setFiltreFin] = useState("");

  const servicesExistants = Array.from(new Set(factures.map((f) => f.service))).sort();
  const filtresActifs = Boolean(
    recherche || filtreService || filtreMode || filtrePaiement || filtreDebut || filtreFin,
  );

  const termes = normaliser(recherche.trim()).split(/\s+/).filter(Boolean);
  const facturesFiltrees = factures.filter((f) => {
    if (termes.length > 0) {
      const texte = normaliser(
        `${f.candidatId?.nom ?? ""} ${f.candidatId?.prenom ?? ""} ${f.candidatId?.telephone ?? ""} ${f.numeroRecu ?? ""}`,
      );
      const texteChiffres = texte.replace(/\s/g, "");
      // Chaque mot tapé doit se retrouver (le téléphone se cherche aussi sans espaces)
      if (!termes.every((m) => texte.includes(m) || texteChiffres.includes(m))) return false;
    }
    if (filtreService && f.service !== filtreService) return false;
    if (filtreMode && f.modePaiement !== filtreMode) return false;
    if (filtrePaiement === "solde" && (f.resteAPayer ?? 0) > 0) return false;
    if (filtrePaiement === "reste" && (f.resteAPayer ?? 0) <= 0) return false;
    const jour = jourLocal(f.dateInscription);
    if (filtreDebut && jour < filtreDebut) return false;
    if (filtreFin && jour > filtreFin) return false;
    return true;
  });

  function effacerFiltres() {
    setRecherche("");
    setFiltreService("");
    setFiltreMode("");
    setFiltrePaiement("");
    setFiltreDebut("");
    setFiltreFin("");
  }

  // Un filtre changé : retour à la page 1
  const pages = usePagination(
    facturesFiltrees,
    15,
    [recherche, filtreService, filtreMode, filtrePaiement, filtreDebut, filtreFin].join("|"),
  );
  const totalFiltre = facturesFiltrees.reduce((somme, f) => somme + (f.montantTotal ?? 0), 0);

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

  const champFiltre =
    "w-full min-w-0 rounded-lg border border-ink/15 bg-white px-3 py-2 text-base text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

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

        {/* Filtres */}
        <div className="mb-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("factures.rechercher")}
            className={champFiltre}
          />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select value={filtreService} onChange={(e) => setFiltreService(e.target.value)} className={champFiltre}>
              <option value="">{t("factures.tousServices")}</option>
              {servicesExistants.map((s) => (
                <option key={s} value={s}>
                  {formaterNomService(s)}
                </option>
              ))}
            </select>
            <select value={filtreMode} onChange={(e) => setFiltreMode(e.target.value)} className={champFiltre}>
              <option value="">{t("factures.tousModes")}</option>
              {MODES_PAIEMENT.map((m) => (
                <option key={m.valeur} value={m.valeur}>
                  {t(m.cle)}
                </option>
              ))}
            </select>
            <select
              value={filtrePaiement}
              onChange={(e) => setFiltrePaiement(e.target.value as "" | "solde" | "reste")}
              className={champFiltre}
            >
              <option value="">{t("factures.tousPaiements")}</option>
              <option value="solde">{t("factures.soldees")}</option>
              <option value="reste">{t("factures.avecReste")}</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="shrink-0">{t("factures.du")}</span>
              <input
                type="date"
                value={filtreDebut}
                onChange={(e) => setFiltreDebut(e.target.value)}
                className={champFiltre}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <span className="shrink-0">{t("factures.au")}</span>
              <input
                type="date"
                value={filtreFin}
                onChange={(e) => setFiltreFin(e.target.value)}
                className={champFiltre}
              />
            </label>
          </div>
          {filtresActifs && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-ink-soft">
                {t("factures.resultat", { n: facturesFiltrees.length, total: totalFiltre.toLocaleString(locale) })}
              </p>
              <button onClick={effacerFiltres} className="font-medium text-accent hover:underline">
                {t("factures.effacerFiltres")}
              </button>
            </div>
          )}
        </div>

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
              {pages.elements.map((f) => (
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
          {factures.length > 0 && facturesFiltrees.length === 0 && (
            <p className="px-4 py-8 text-center text-ink-soft">{t("factures.aucunResultat")}</p>
          )}
        </div>

        <Pagination
          page={pages.page}
          totalPages={pages.totalPages}
          onChange={pages.setPage}
          texte={t("factures.pagination", { page: pages.page, total: pages.totalPages, n: pages.total })}
          precedent={t("candidats.precedent")}
          suivant={t("candidats.suivant")}
        />
      </div>
    </div>
  );
}