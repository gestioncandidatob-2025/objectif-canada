"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type HistoriqueEntree = {
  raison: string;
  modifiePar: string;
  champsModifies: string;
  date: string;
};

type Candidat = {
  _id: string;
  nom: string;
  prenom: string;
  telephone: string;
  historique?: HistoriqueEntree[];
};

type Inscription = {
  _id: string;
  service: string;
  regime?: string;
  dateInscription: string;
  dateDebutTest?: string;
  dateFin?: string;
  montantTotal: number;
  montantPaye: number;
  resteAPayer: number;
  numeroRecu: string;
};

const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

export default function DossierCandidatPage() {
  const { id } = useParams<{ id: string }>();

  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [chargement, setChargement] = useState(true);
  const [role, setRole] = useState("");

  const [modeEdition, setModeEdition] = useState(false);
  const [editNom, setEditNom] = useState("");
  const [editPrenom, setEditPrenom] = useState("");
  const [editTelephone, setEditTelephone] = useState("");
  const [editRaison, setEditRaison] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setRole(JSON.parse(userStr).role);
    }
  }, []);

  async function charger() {
    const [rCandidat, rInscriptions] = await Promise.all([
      apiFetch(`/candidates/${id}`),
      apiFetch(`/registrations?candidatId=${id}`),
    ]);

    if (!rCandidat.ok || !rInscriptions.ok) {
      setErreur("Impossible de charger ce dossier");
      setChargement(false);
      return;
    }

    const c = await rCandidat.json();
    setCandidat(c);
    setEditNom(c.nom);
    setEditPrenom(c.prenom);
    setEditTelephone(c.telephone);
    setInscriptions(await rInscriptions.json());
    setChargement(false);
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function enregistrerModificationCandidat(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");

    if (!editRaison.trim()) {
      setErreur("La raison de la modification est obligatoire");
      return;
    }

    setEnvoiEnCours(true);
    const res = await apiFetch(`/candidates/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        nom: editNom,
        prenom: editPrenom,
        telephone: editTelephone,
        raison: editRaison,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnvoiEnCours(false);
      return;
    }

    setMessage("Informations mises à jour");
    setModeEdition(false);
    setEditRaison("");
    setEnvoiEnCours(false);
    charger();
  }

  if (chargement) {
    return null;
  }

  if (erreur && !candidat) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-error">{erreur}</p>
      </div>
    );
  }

  if (!candidat) {
    return null;
  }

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-xs font-medium text-ink-soft";

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1
                className="text-2xl text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {candidat.nom} {candidat.prenom}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                Téléphone : {candidat.telephone}
              </p>
            </div>
            <button
              onClick={() => setModeEdition(!modeEdition)}
              className="whitespace-nowrap rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper"
            >
              {modeEdition ? "Annuler" : "Modifier"}
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
              {message}
            </p>
          )}
          {erreur && (
            <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              {erreur}
            </p>
          )}

          {modeEdition && (
            <form
              onSubmit={enregistrerModificationCandidat}
              className="mt-4 space-y-3 rounded-xl border border-ink/10 bg-paper p-5"
            >
              <div>
                <label className={labelClass}>Nom</label>
                <input
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className={`${champClass} bg-white`}
                />
              </div>
              <div>
                <label className={labelClass}>Prénom</label>
                <input
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  className={`${champClass} bg-white`}
                />
              </div>
              <div>
                <label className={labelClass}>Téléphone</label>
                <input
                  value={editTelephone}
                  onChange={(e) => setEditTelephone(e.target.value)}
                  className={`${champClass} bg-white`}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Raison de la modification (obligatoire)
                </label>
                <input
                  value={editRaison}
                  onChange={(e) => setEditRaison(e.target.value)}
                  placeholder="Ex : correction faute de frappe sur le nom"
                  className={`${champClass} bg-white`}
                />
              </div>
              <button
                type="submit"
                disabled={envoiEnCours}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent-hover"
              >
                {envoiEnCours ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          )}

          <p className="mt-6 mb-3 text-sm font-semibold text-ink-soft">
            {inscriptions.length} inscription{inscriptions.length > 1 ? "s" : ""} au total
          </p>

          {inscriptions.length === 0 ? (
            <p className="text-sm text-ink-soft">Aucune inscription pour ce candidat.</p>
          ) : (
            <div className="space-y-3">
              {inscriptions.map((insc) => (
                <div key={insc._id} className="rounded-xl border border-ink/10 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {LABEL_SERVICE[insc.service] ?? insc.service}
                      {insc.regime ? ` — ${insc.regime}` : ""}
                    </span>
                    <a
                      href={`/recu/${insc._id}`}
                      target="_blank"
                      className="rounded-full border border-seal/30 bg-seal/10 px-3 py-1 text-xs font-medium text-seal transition hover:bg-seal/20"
                    >
                      N° {insc.numeroRecu}
                    </a>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-ink-soft">
                    <p>Inscrit le : {insc.dateInscription?.slice(0, 10)}</p>
                    <p>Début du test : {insc.dateDebutTest?.slice(0, 10) ?? "—"}</p>
                    <p>Montant total : {insc.montantTotal.toLocaleString("fr-FR")} FCFA</p>
                    <p>Reste à payer : {insc.resteAPayer.toLocaleString("fr-FR")} FCFA</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {role === "admin" && candidat.historique && candidat.historique.length > 0 && (
            <div className="mt-8 border-t border-ink/10 pt-5">
              <p className="mb-3 text-sm font-semibold text-ink-soft">
                Historique des modifications
              </p>
              <div className="space-y-2">
                {[...candidat.historique].reverse().map((h, i) => (
                  <div key={i} className="rounded-lg border border-ink/10 p-3 text-xs">
                    <p className="font-medium text-ink">{h.raison}</p>
                    <p className="mt-1 text-ink-soft">
                      Modifié par {h.modifiePar} le {new Date(h.date).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-ink-soft">Champs modifiés : {h.champsModifies}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}