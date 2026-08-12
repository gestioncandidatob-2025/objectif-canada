"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Candidat = {
  _id: string;
  nom: string;
  prenom: string;
  telephone: string;
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

type ColonneTri = "nom" | "prenom" | "service" | "regime" | "resteAPayer" | "dateFin";
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
    <th className="px-4 py-3 font-medium">
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
    case "prenom":
      return insc.candidatId?.prenom?.toLowerCase() ?? "";
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

export default function CandidatsPage() {
  const [role, setRole] = useState<string>("");

  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreService, setFiltreService] = useState("");
  const [filtreRegime, setFiltreRegime] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreDateDebut, setFiltreDateDebut] = useState("");
  const [filtreDateFin, setFiltreDateFin] = useState("");
  const [filtrePaiement, setFiltrePaiement] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const [ligneEnEdition, setLigneEnEdition] = useState<string | null>(null);
  const [ligneASupprimer, setLigneASupprimer] = useState<string | null>(null);
  const [lettreConfirmation, setLettreConfirmation] = useState("");

  const [editRegime, setEditRegime] = useState("jour");
  const [editDateDebutTest, setEditDateDebutTest] = useState("");
  const [editMontantPaye, setEditMontantPaye] = useState("");
  const [editFacturePar, setEditFacturePar] = useState("STEPHANE");
  const [editReference, setEditReference] = useState("");
  const [editRaison, setEditRaison] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const [triColonne, setTriColonne] = useState<ColonneTri | null>(null);
  const [triOrdre, setTriOrdre] = useState<OrdreTri>("asc");

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
      setErreur("Impossible de charger la liste");
    }
    setChargement(false);
  }

  useEffect(() => {
    chargerInscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 function ouvrirEdition(insc: Inscription) {
    setLigneEnEdition(insc._id);
    setLigneOuverte(null);
    setLigneASupprimer(null);
    setEditRegime(insc.regime ?? "jour");
    setEditDateDebutTest(insc.dateDebutTest ? insc.dateDebutTest.slice(0, 10) : "");
    setEditMontantPaye(String(insc.montantPaye));
    setEditFacturePar(insc.facturePar);
    setEditReference(insc.reference ?? "");
    setEditRaison("");
  }

  async function enregistrerModification(id: string) {
    if (!editRaison.trim()) {
      setErreur("La raison de la modification est obligatoire");
      return;
    }
    setEnregistrementEnCours(true);
    const body: Record<string, unknown> = {
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
      setErreur("Suppression impossible");
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

  const inscriptionsTriees = triColonne
    ? [...inscriptions].sort((a, b) => {
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
    : inscriptions;

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1
          className="mb-6 text-3xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Liste des candidats
        </h1>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou prénom"
            className={`${champClass} bg-white sm:col-span-2`}
          />
          <select
            value={filtreService}
            onChange={(e) => setFiltreService(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">Tous les services</option>
            <option value="tcf">TCF</option>
            <option value="examen_blanc">Examen blanc</option>
            <option value="tcf_special">TCF SPECIAL</option>
          </select>
          <select
            value={filtreRegime}
            onChange={(e) => setFiltreRegime(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">Tous les régimes</option>
            <option value="jour">Jour</option>
            <option value="soir">Soir</option>
          </select>
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">Tous les statuts</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
          </select>
          <select
            value={filtrePaiement}
            onChange={(e) => setFiltrePaiement(e.target.value)}
            className={`${champClass} bg-white`}
          >
            <option value="">Tous les paiements</option>
            <option value="avec_reste">Avec reste à payer</option>
            <option value="solde">Soldé</option>
          </select>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Inscrit à partir du
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
              Inscrit jusqu'au
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
          {chargement ? "Recherche..." : "Chercher"}
        </button>

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">N°</th>
                <EnTeteTriable colonne="nom" label="Nom" triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="prenom" label="Prénom" triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="service" label="Service" triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="regime" label="Régime" triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="resteAPayer" label="Reste à payer" triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <EnTeteTriable colonne="dateFin" label="Date de fin" triColonne={triColonne} triOrdre={triOrdre} onClick={basculerTri} />
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {inscriptionsTriees.map((insc, index) => (
                <>
                  <tr key={insc._id} className="border-b border-ink/5">
                    <td className="px-4 py-3 text-ink-soft">{index + 1}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`/candidats/${insc.candidatId?._id}`}
                        className="font-medium text-ink underline-offset-2 hover:underline"
                      >
                        {insc.candidatId?.nom}
                      </a>
                    </td>
                    <td className="px-4 py-3">{insc.candidatId?.prenom}</td>
                    <td className="px-4 py-3">
                      {LABEL_SERVICE[insc.service] ?? insc.service}
                    </td>
                    <td className="px-4 py-3">{insc.regime ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          insc.resteAPayer > 0
                            ? "font-medium text-error"
                            : "font-medium text-accent"
                        }
                      >
                        {insc.resteAPayer.toLocaleString("fr-FR")} FCFA
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {insc.dateFin ? insc.dateFin.slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/recu/${insc._id}`}
                        target="_blank"
                        className="rounded-full border border-seal/30 bg-seal/10 px-3 py-1 text-xs font-medium text-seal transition active:scale-[0.95] hover:bg-seal/20"
                      >
                        N° {insc.numeroRecu}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setLigneOuverte(ligneOuverte === insc._id ? null : insc._id)
                          }
                          title="Voir plus"
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
                        {estAdmin && (
                          <>
                            <button
                              onClick={() => ouvrirEdition(insc)}
                              title="Modifier"
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
                            <button
                              onClick={() => {
                                setLigneASupprimer(insc._id);
                                setLigneOuverte(null);
                                setLigneEnEdition(null);
                                setLettreConfirmation("");
                              }}
                              title="Supprimer"
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
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                          <p>Téléphone : {insc.candidatId?.telephone}</p>
                          <p>Date d'inscription : {insc.dateInscription?.slice(0, 10)}</p>
                          <p>Début du test : {insc.dateDebutTest?.slice(0, 10) ?? "—"}</p>
                          <p>Date de fin : {insc.dateFin?.slice(0, 10) ?? "—"}</p>
                          <p>Montant total : {insc.montantTotal} FCFA</p>
                          <p>Montant payé : {insc.montantPaye} FCFA</p>
                          <p>Reste à payer : {insc.resteAPayer} FCFA</p>
                          <p>Mode de paiement : {insc.modePaiement}</p>
                          <p>Facturé par : {insc.facturePar}</p>
                          <p>Référence : {insc.reference ?? "—"}</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {ligneEnEdition === insc._id && (
                    <tr className="border-b border-ink/5 bg-accent/5">
                      <td colSpan={9} className="space-y-3 px-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Régime
                            </label>
                            <select
                              value={editRegime}
                              onChange={(e) => setEditRegime(e.target.value)}
                              className={`${champClass} bg-white`}
                            >
                              <option value="jour">Jour</option>
                              <option value="soir">Soir</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Date de début du test
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
                              Montant payé
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
                              Facturé par
                            </label>
                            <select
                              value={editFacturePar}
                              onChange={(e) => setEditFacturePar(e.target.value)}
                              className={`${champClass} bg-white`}
                            >
                              <option value="STEPHANE">STEPHANE</option>
                              <option value="VANELLE">VANELLE</option>
                              <option value="SILAINE">SILAINE</option>
                              <option value="BOFIA.S">BOFIA.S</option>
                            </select>
                            </div>
                            <div className="col-span-2">
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Référence
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
                            {enregistrementEnCours ? "Enregistrement..." : "Enregistrer"}
                          </button>
                          <button
                            onClick={() => setLigneEnEdition(null)}
                            disabled={enregistrementEnCours}
                            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {ligneASupprimer === insc._id && (
                    <tr className="border-b border-ink/5 bg-error/5">
                      <td colSpan={9} className="px-4 py-4">
                        <p className="mb-2 text-sm font-medium text-error">
                          Pour confirmer la suppression de {insc.candidatId?.nom}{" "}
                          {insc.candidatId?.prenom}, tape la lettre <strong>S</strong> majuscule
                          ci-dessous.
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
                            {suppressionEnCours ? "Suppression..." : "Confirmer la suppression"}
                          </button>
                          <button
                            onClick={() => {
                              setLigneASupprimer(null);
                              setLettreConfirmation("");
                            }}
                            disabled={suppressionEnCours}
                            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {inscriptions.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              Aucun candidat trouvé.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}