"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

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
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

export default function CandidatsPage() {
  const [pret, setPret] = useState(false);
  const [role, setRole] = useState<string>("");
  const router = useRouter();

  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [recherche, setRecherche] = useState("");
  const [filtreService, setFiltreService] = useState("");
  const [filtreRegime, setFiltreRegime] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const [ligneEnEdition, setLigneEnEdition] = useState<string | null>(null);

  const [editRegime, setEditRegime] = useState("jour");
  const [editDateDebutTest, setEditDateDebutTest] = useState("");
  const [editMontantPaye, setEditMontantPaye] = useState("");
  const [editFacturePar, setEditFacturePar] = useState("Secretaire 1");
  const [editReference, setEditReference] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.push("/login");
      return;
    }
    setRole(JSON.parse(userStr).role);
    setPret(true);
  }, [router]);

  async function chargerInscriptions() {
    setChargement(true);
    setErreur("");

    const params = new URLSearchParams();
    if (recherche) params.set("nom", recherche);
    if (filtreService) params.set("service", filtreService);
    if (filtreRegime) params.set("regime", filtreRegime);
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
    if (pret) {
      chargerInscriptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  function ouvrirEdition(insc: Inscription) {
    setLigneEnEdition(insc._id);
    setLigneOuverte(null);
    setEditRegime(insc.regime ?? "jour");
    setEditDateDebutTest(insc.dateDebutTest ? insc.dateDebutTest.slice(0, 10) : "");
    setEditMontantPaye(String(insc.montantPaye));
    setEditFacturePar(insc.facturePar);
    setEditReference(insc.reference ?? "");
  }

  async function enregistrerModification(id: string) {
    const body: Record<string, unknown> = {
      regime: editRegime,
      dateDebutTest: editDateDebutTest || undefined,
      montantPaye: Number(editMontantPaye),
      facturePar: editFacturePar,
      reference: editReference || undefined,
    };
    const res = await apiFetch(`/registrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      return;
    }
    setLigneEnEdition(null);
    chargerInscriptions();
  }

  async function supprimer(id: string) {
    if (!window.confirm("Confirmer la suppression de cette inscription ?")) return;
    const res = await apiFetch(`/registrations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setErreur("Suppression impossible");
      return;
    }
    chargerInscriptions();
  }

  if (!pret) {
    return null;
  }

  const estAdmin = role === "admin";
  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          ← Retour
        </button>
        
        <a href="/bienvenue">
          <img
            src="/logo.jpeg"
            alt="Logo"
            className="mx-auto h-20 w-auto object-contain"
          />
        </a>
        <h1
          className="mb-6 mt-2 text-3xl text-ink"
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
        </div>

        <button
          onClick={chargerInscriptions}
          className="mb-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover"
        >
          Chercher
        </button>

        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Prénom</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Régime</th>
                <th className="px-4 py-3 font-medium">Reçu</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {inscriptions.map((insc) => (
                <>
                  <tr key={insc._id} className="border-b border-ink/5">
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
                              onClick={() => supprimer(insc._id)}
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
                      <td colSpan={6} className="px-4 py-4 text-sm text-ink-soft">
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
                      <td colSpan={6} className="space-y-3 px-4 py-4">
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
                              <option value="Secretaire 1">Secretaire 1</option>
                              <option value="Secretaire 2">Secretaire 2</option>
                              <option value="Secretaire 3">Secretaire 3</option>
                              <option value="Admin">Admin</option>
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
                            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={() => setLigneEnEdition(null)}
                            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition active:scale-[0.97] hover:bg-paper"
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