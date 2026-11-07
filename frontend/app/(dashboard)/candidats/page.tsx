"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { CodeClasse, classeDe } from "../../lib/classes";
import { useLangue } from "../../lib/langue";

type Candidat = {
  _id: string;
  nom: string;
  prenom: string;
  telephone: string;
};

type Tarif = {
  _id: string;
  service: string;
  actif: boolean;
  regimes?: string[];
  regimeActif?: boolean;
};

type Inscription = {
  _id: string;
  candidatId: Candidat;
  service: string;
  regime?: string;
  dateInscription: string;
  dateDebutTest?: string;
  dateFin?: string;
  montantTotal: number;
  montantPaye: number;
  resteAPayer: number;
  modePaiement: string;
  facturePar: string;
  reference?: string;
  numeroRecu: string;
};

const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  tcf_2mois: "TCF 2 mois",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

// Clés de traduction des modes de paiement
const LIBELLES_PAIEMENT: Record<string, string> = {
  especes: "paiement.especes",
  orange_money: "paiement.orangeMoney",
  mobile_money: "paiement.mobileMoney",
  mobile_especes: "paiement.mixte",
};

type ColonneTri = "nom" | "service" | "regime" | "resteAPayer" | "dateFin";
type OrdreTri = "asc" | "desc";

function EnTeteTriable({
  colonne,
  label,
  triColonne,
  triOrdre,
  onClick,
}: {
  colonne: ColonneTri;
  label: string;
  triColonne: ColonneTri | null;
  triOrdre: OrdreTri;
  onClick: (colonne: ColonneTri) => void;
}) {
  const actif = triColonne === colonne;
  return (
    <th className="whitespace-nowrap px-4 py-3 font-medium">
      <button
        onClick={() => onClick(colonne)}
        className="flex items-center gap-1 transition hover:text-ink"
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-3.5 w-3.5 transition-transform ${
            actif && triOrdre === "desc" ? "rotate-180" : ""
          } ${actif ? "text-accent" : "text-ink-soft/50"}`}
        >
          <path
            d="M6 15l6-6 6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </th>
  );
}

function valeurTri(insc: Inscription, colonne: ColonneTri): string | number {
  switch (colonne) {
    case "nom":
      return insc.candidatId?.nom?.toLowerCase() ?? "";
    case "service":
      return LABEL_SERVICE[insc.service] ?? insc.service ?? "";
    case "regime":
      return insc.regime ?? "";
    case "resteAPayer":
      return insc.resteAPayer ?? 0;
    case "dateFin":
      return insc.dateFin ? new Date(insc.dateFin).getTime() : 0;
    default:
      return "";
  }
}

function statutDeInscription(insc: Inscription): "termine" | "en_cours" {
  if (!insc.dateFin) return "en_cours";
  return new Date(insc.dateFin) < new Date() ? "termine" : "en_cours";
}

export default function CandidatsPage() {
  const { t, locale } = useLangue();
  const searchParams = useSearchParams();
  const classeParam = searchParams.get("classe") as CodeClasse | null;

  const [role, setRole] = useState<string>("");

  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [tarifsActifs, setTarifsActifs] = useState<Tarif[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreService, setFiltreService] = useState("");
  const [filtreRegime, setFiltreRegime] = useState("");
  const [filtreStatut, setFiltreStatut] = useState(classeParam ? "en_cours" : "");
  const [filtreDateDebut, setFiltreDateDebut] = useState("");
  const [filtreDateFin, setFiltreDateFin] = useState("");
  const [filtrePaiement, setFiltrePaiement] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const [ligneEnEdition, setLigneEnEdition] = useState<string | null>(null);
  const [ligneASupprimer, setLigneASupprimer] = useState<string | null>(null);
  const [lettreConfirmation, setLettreConfirmation] = useState("");

  const [editService, setEditService] = useState("tcf");
  const [editRegime, setEditRegime] = useState("jour");
  const [editDateDebutTest, setEditDateDebutTest] = useState("");
  const [editMontantPaye, setEditMontantPaye] = useState("");
  const [editFacturePar, setEditFacturePar] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editRaison, setEditRaison] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const [triColonne, setTriColonne] = useState<ColonneTri | null>(null);
  const [triOrdre, setTriOrdre] = useState<OrdreTri>("asc");

  const CANDIDATS_PAR_PAGE = 10;
  const [page, setPage] = useState(1);

  function basculerTri(colonne: ColonneTri) {
    if (triColonne === colonne) {
      setTriOrdre(triOrdre === "asc" ? "desc" : "asc");
    } else {
      setTriColonne(colonne);
      setTriOrdre("asc");
    }
  }
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setRole(JSON.parse(userStr).role);
    }
  }, []);

  async function chargerInscriptions() {
    setChargement(true);
    setErreur("");

    const params = new URLSearchParams();
    if (recherche) params.set("nom", recherche);
    if (filtreService) params.set("service", filtreService);
    if (filtreRegime) params.set("regime", filtreRegime);
    if (filtreStatut) params.set("statut", filtreStatut);
    if (filtreDateDebut) params.set("dateInscriptionDebut", filtreDateDebut);
    if (filtreDateFin) params.set("dateInscriptionFin", filtreDateFin);
    if (filtrePaiement) params.set("paiement", filtrePaiement);
    const query = params.toString() ? `?${params.toString()}` : "";

    const res = await apiFetch(`/registrations${query}`);
    if (res.ok) {
      setInscriptions(await res.json());
    } else {
      setErreur(t("candidats.erreurChargement"));
    }
    setChargement(false);
  }

  useEffect(() => {
    chargerInscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function chargerTarifsActifs() {
      const res = await apiFetch("/tarifs");
      if (res.ok) {
        const data: Tarif[] = await res.json();
        setTarifsActifs(data.filter((t) => t.actif));
      }
    }
    chargerTarifsActifs();
  }, []);

  const servicesDisponibles = Array.from(new Set(tarifsActifs.map((t) => t.service)));
  // Tous les régimes saisis dans les services du centre (pour le filtre)
  const regimesDuCentre = Array.from(
    new Set(tarifsActifs.flatMap((t) => (t.regimeActif ? (t.regimes ?? []) : []))),
  );
  const configEditService = tarifsActifs.find((t) => t.service === editService);
  const regimesDisponibles = configEditService?.regimes ?? [];

 function ouvrirEdition(insc: Inscription) {
    setLigneEnEdition(insc._id);
    setLigneOuverte(null);
    setLigneASupprimer(null);
    setEditService(insc.service);
    setEditRegime(insc.regime ?? "jour");
    setEditDateDebutTest(insc.dateDebutTest ? insc.dateDebutTest.slice(0, 10) : "");
    setEditMontantPaye(String(insc.montantPaye));
    setEditFacturePar(insc.facturePar);
    setEditReference(insc.reference ?? "");
    setEditRaison("");
  }

  async function enregistrerModification(id: string) {
    if (!editRaison.trim()) {
      setErreur(t("candidats.erreurRaison"));
      return;
    }
    setEnregistrementEnCours(true);
    const body: Record<string, unknown> = {
      service: editService,
      regime: editRegime,
      dateDebutTest: editDateDebutTest || undefined,
      montantPaye: Number(editMontantPaye),
      facturePar: editFacturePar,
      reference: editReference || undefined,
      raison: editRaison,
    };
    const res = await apiFetch(`/registrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnregistrementEnCours(false);
      return;
    }
    setLigneEnEdition(null);
    setEnregistrementEnCours(false);
    chargerInscriptions();
  }

  async function confirmerSuppression(id: string) {
    setSuppressionEnCours(true);
    const res = await apiFetch(`/registrations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setErreur(t("candidats.erreurSuppression"));
      setSuppressionEnCours(false);
      return;
    }
    setLigneASupprimer(null);
    setLettreConfirmation("");
    setSuppressionEnCours(false);
    chargerInscriptions();
  }

  const estAdmin = role === "admin";
  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  const inscriptionsDeLaClasse = classeParam
    ? inscriptions.filter((insc) => classeDe(insc) === classeParam)
    : inscriptions;

  const inscriptionsTriees = triColonne
    ? [...inscriptionsDeLaClasse].sort((a, b) => {
        const va = valeurTri(a, triColonne);
        const vb = valeurTri(b, triColonne);
        let resultat = 0;
        if (typeof va === "number" && typeof vb === "number") {
          resultat = va - vb;
        } else {
          resultat = String(va).localeCompare(String(vb), "fr");
        }
        return triOrdre === "asc" ? resultat : -resultat;
      })
    : inscriptionsDeLaClasse;

  const totalPages = Math.max(
    1,
    Math.ceil(inscriptionsTriees.length / CANDIDATS_PAR_PAGE)
  );
  useEffect(() => {
    setPage(1);
  }, [
    recherche,
    filtreService,
    filtreRegime,
    filtreStatut,
    filtreDateDebut,
    filtreDateFin,
    filtrePaiement,
    classeParam,
    inscriptions,
  ]);

  const pageEffective = Math.min(page, totalPages);
  const inscriptionsPage = inscriptionsTriees.slice(
    (pageEffective - 1) * CANDIDATS_PAR_PAGE,
    pageEffective * CANDIDATS_PAR_PAGE
  );

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <h1
          className="mb-6 text-2xl text-ink sm:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("menu.listeCandidats")}
        </h1>

        {classeParam && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-accent/10 px-4 py-2.5 text-sm text-accent">
            <span>
              {t("candidats.filtreClasse")} <strong>{t(`classes.noms.${classeParam}`)}</strong>
            </span>
            <Link href="/candidats" className="font-medium underline hover:no-underline">
              {t("candidats.retirerFiltre")}
            </Link>
          </div>
        )}

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("candidats.rechercheNom")}
            className={`${champClass} bg-white sm:col-span-2`}
          />
          <select
            value={filtreService}
            onChange={(e) => setFiltreService(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">{t("candidats.tousServices")}</option>
            {/* Les services du centre (Paramètres → Services), jamais une liste écrite en dur */}
            {servicesDisponibles.map((svc) => (
              <option key={svc} value={svc}>
                {LABEL_SERVICE[svc] ?? svc}
              </option>
            ))}
          </select>
          <select
            value={filtreRegime}
            onChange={(e) => setFiltreRegime(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">{t("candidats.tousRegimes")}</option>
            {/* Les régimes de tous les services du centre */}
            {regimesDuCentre.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">{t("candidats.tousStatuts")}</option>
            <option value="en_cours">{t("candidats.enCours")}</option>
            <option value="termine">{t("candidats.termine")}</option>
          </select>
          <select
            value={filtrePaiement}
            onChange={(e) => setFiltrePaiement(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">{t("candidats.tousPaiements")}</option>
            <option value="avec_reste">{t("candidats.avecReste")}</option>
            <option value="solde">{t("candidats.solde")}</option>
          </select>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              {t("candidats.inscritDepuis")}
            </label>
            <input
              type="date"
              value={filtreDateDebut}
              onChange={(e) => setFiltreDateDebut(e.target.value)}
              className={`${champClass} bg-white`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              {t("candidats.inscritJusqua")}
            </label>
            <input
              type="date"
              value={filtreDateFin}
              onChange={(e) => setFiltreDateFin(e.target.value)}
              className={`${champClass} bg-white`}
            />
          </div>
        </div>

        <button
          onClick={chargerInscriptions}
          disabled={chargement}
          className="mb-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {chargement ? t("facture.rechercheEnCours") : t("facture.chercher")}
        </button>

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="whitespace-nowrap px-4 py-3 font-medium">{t("candidats.numero")}</th>
                <EnTeteTriable colonne="nom" label={t("facture.nom")} triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="service" label={t("facture.service")} triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="regime" label={t("facture.regime")} triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="resteAPayer" label={t("facture.resteAPayer")} triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="dateFin" label={t("candidats.dateFin")} triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <th className="whitespace-nowrap px-4 py-3 font-medium">{t("candidats.statut")}</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">{t("candidats.recu")}</th>
                <th className="sticky right-0 z-10 whitespace-nowrap bg-paper px-4 py-3 font-medium">
                  {t("candidats.action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {inscriptionsPage.map((insc, index) => (
                <Fragment key={insc._id}>
                  <tr className="border-b border-ink/5">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                      {(pageEffective - 1) * CANDIDATS_PAR_PAGE + index + 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/candidats/${insc.candidatId?._id}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {insc.candidatId?.nom}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {LABEL_SERVICE[insc.service] ?? insc.service}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{insc.regime ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          insc.resteAPayer > 0
                            ? "font-medium text-error"
                            : "font-medium text-accent"
                        }
                      >
                        {insc.resteAPayer.toLocaleString(locale)} FCFA
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {insc.dateFin ? insc.dateFin.slice(0, 10) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          statutDeInscription(insc) === "termine"
                            ? "rounded-full bg-error/10 px-3 py-1 text-xs font-medium text-error"
                            : "rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                        }
                      >
                        {statutDeInscription(insc) === "termine" ? t("candidats.terminee") : t("candidats.enCours")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <a
                        href={`/recu/${insc._id}`}
                        target="_blank"
                        className="rounded-full border border-seal/30 bg-seal/10 px-3 py-1 text-xs font-medium text-seal transition active:scale-[0.95] hover:bg-seal/20"
                      >
                        {t("candidats.numero")} {insc.numeroRecu}
                      </a>
                    </td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-white px-4 py-3 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setLigneOuverte(ligneOuverte === insc._id ? null : insc._id)
                          }
                          title={t("candidats.voirPlus")}
                          aria-label={t("candidats.voirPlus")}
                          className="text-accent transition hover:scale-110 active:scale-95"
                        >
                          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                            <path
                              d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </button>
                        <button
                          onClick={() => ouvrirEdition(insc)}
                          title={t("candidats.modifier")}
                          aria-label={t("candidats.modifier")}
                          className="text-blue-900 transition hover:scale-110 active:scale-95"
                        >
                          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                            <path
                              d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5.5 16.5 4 20Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {estAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setLigneASupprimer(insc._id);
                                setLigneOuverte(null);
                                setLigneEnEdition(null);
                                setLettreConfirmation("");
                              }}
                              title={t("candidats.supprimer")}
                              aria-label={t("candidats.supprimer")}
                              className="text-error transition hover:scale-110 active:scale-95"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                                <path
                                  d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {ligneOuverte === insc._id && (
                    <tr className="border-b border-ink/5 bg-paper">
                      <td colSpan={9} className="px-4 py-4 text-sm text-ink-soft">
                        <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                          <p>{t("facture.prenom")} : {insc.candidatId?.prenom}</p>
                          <p>{t("facture.telephone")} : {insc.candidatId?.telephone}</p>
                          <p>{t("candidats.dateInscription")} : {insc.dateInscription?.slice(0, 10)}</p>
                          <p>{t("candidats.debutTest")} : {insc.dateDebutTest?.slice(0, 10) ?? "—"}</p>
                          <p>{t("candidats.dateFin")} : {insc.dateFin?.slice(0, 10) ?? "—"}</p>
                          <p>{t("facture.montantTotal")} : {insc.montantTotal.toLocaleString(locale)} FCFA</p>
                          <p>{t("facture.montantPaye")} : {insc.montantPaye.toLocaleString(locale)} FCFA</p>
                          <p>{t("facture.resteAPayer")} : {insc.resteAPayer.toLocaleString(locale)} FCFA</p>
                          <p>{t("facture.modePaiement")} : {LIBELLES_PAIEMENT[insc.modePaiement] ? t(LIBELLES_PAIEMENT[insc.modePaiement]) : insc.modePaiement}</p>
                          <p>{t("facture.facturePar")} : {insc.facturePar}</p>
                          <p>{t("facture.referenceCourt")} : {insc.reference ?? "—"}</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {ligneEnEdition === insc._id && (
                    <tr className="border-b border-ink/5 bg-accent/5">
                      <td colSpan={9} className="space-y-3 px-4 py-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("candidats.raison")} <span className="text-error">*</span>
                            </label>
                            <textarea
                              value={editRaison}
                              onChange={(e) => setEditRaison(e.target.value)}
                              rows={2}
                              placeholder={t("candidats.raisonExemple")}
                              className={`${champClass} bg-white`}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("facture.service")}
                            </label>
                            <select
                              value={editService}
                              onChange={(e) => setEditService(e.target.value)}
                              className={`${champClass} bg-white`}
                            >
                              {Array.from(
                                new Set([...servicesDisponibles, editService].filter(Boolean))
                              ).map((svc) => (
                                <option key={svc} value={svc}>
                                  {svc}
                                  {!servicesDisponibles.includes(svc) ? ` (${t("candidats.offreInactive")})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("facture.regime")}
                            </label>
                            <select
                              value={editRegime}
                              onChange={(e) => setEditRegime(e.target.value)}
                              className={`${champClass} bg-white`}
                              disabled={configEditService && !configEditService.regimeActif}
                            >
                              {regimesDisponibles.length === 0 && !editRegime && (
                                <option value="">{t("facture.aucunRegime")}</option>
                              )}
                              {Array.from(
                                new Set([...regimesDisponibles, editRegime].filter(Boolean))
                              ).map((reg) => (
                                <option key={reg} value={reg}>
                                  {reg}
                                  {!regimesDisponibles.includes(reg) ? ` (${t("candidats.regimeIndisponible")})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("facture.dateDebut")}
                            </label>
                            <input
                              type="date"
                              value={editDateDebutTest}
                              onChange={(e) => setEditDateDebutTest(e.target.value)}
                              className={`${champClass} bg-white`}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("facture.montantPaye")}
                            </label>
                            <input
                              type="number"
                              value={editMontantPaye}
                              onChange={(e) => setEditMontantPaye(e.target.value)}
                              className={`${champClass} bg-white`}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("facture.facturePar")}
                            </label>
                            {/* Texte libre : plus de liste de noms écrite en dur */}
                            <input
                              value={editFacturePar}
                              onChange={(e) => setEditFacturePar(e.target.value)}
                              className={`${champClass} bg-white`}
                            />
                            </div>
                            <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              {t("facture.referenceCourt")}
                            </label>
                            <input
                              value={editReference}
                              onChange={(e) => setEditReference(e.target.value)}
                              className={`${champClass} bg-white`}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => enregistrerModification(insc._id)}
                            disabled={enregistrementEnCours}
                            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {enregistrementEnCours ? t("facture.enregistrementCourt") : t("commun.enregistrer")}
                          </button>
                          <button
                            onClick={() => setLigneEnEdition(null)}
                            disabled={enregistrementEnCours}
                            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t("commun.annuler")}
                          </button>
                        </div>
                        {erreur && (
                          <p className="text-sm text-error">{erreur}</p>
                        )}
                      </td>
                    </tr>
                  )}

                  {ligneASupprimer === insc._id && (
                    <tr className="border-b border-ink/5 bg-error/5">
                      <td  className="px-4 py-4">
                        <p className="mb-2 text-sm font-medium text-error">
                          {t("candidats.confirmerSuppressionTexte", {
                            nom: `${insc.candidatId?.nom ?? ""} ${insc.candidatId?.prenom ?? ""}`.trim(),
                          })}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            value={lettreConfirmation}
                            onChange={(e) => setLettreConfirmation(e.target.value)}
                            maxLength={1}
                            className="w-16 rounded-lg border border-error/30 px-3 py-2 text-center font-bold outline-none focus:border-error focus:ring-2 focus:ring-error/20"
                          />
                          <button
                            onClick={() => confirmerSuppression(insc._id)}
                            disabled={lettreConfirmation !== "S" || suppressionEnCours}
                            className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-red-700"
                          >
                            {suppressionEnCours ? t("candidats.suppressionEnCours") : t("candidats.confirmerSuppression")}
                          </button>
                          <button
                            onClick={() => {
                              setLigneASupprimer(null);
                              setLettreConfirmation("");
                            }}
                            disabled={suppressionEnCours}
                            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t("commun.annuler")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          {inscriptionsDeLaClasse.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              {t("candidats.aucun")}
            </p>
          )}
        </div>

        {inscriptionsTriees.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
            <p>
              {t("candidats.pagination", {
                page: pageEffective,
                total: totalPages,
                n: inscriptionsTriees.length,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageEffective <= 1}
                className="rounded-lg border border-ink/15 px-3 py-2 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("candidats.precedent")}
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (n) =>
                    n === 1 ||
                    n === totalPages ||
                    Math.abs(n - pageEffective) <= 1
                )
                .map((n, i, arr) => (
                  <Fragment key={n}>
                    {i > 0 && arr[i - 1] !== n - 1 && (
                      <span className="px-1 text-ink-soft">…</span>
                    )}
                    <button
                      onClick={() => setPage(n)}
                      className={
                        "rounded-lg px-3 py-2 font-medium transition " +
                        (n === pageEffective
                          ? "bg-accent text-white"
                          : "border border-ink/15 text-ink hover:bg-paper")
                      }
                    >
                      {n}
                    </button>
                  </Fragment>
                ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageEffective >= totalPages}
                className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("candidats.suivant")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}