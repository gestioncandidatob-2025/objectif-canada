"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type Candidat = {
  _id: string;
  nom: string;
  prenom: string;
  telephone: string;
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
  const router = useRouter();

  const [candidat, setCandidat] = useState<Candidat | null>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

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

      setCandidat(await rCandidat.json());
      setInscriptions(await rInscriptions.json());
      setChargement(false);
    }

    charger();
  }, [id, router]);

  if (chargement) {
    return null;
  }

  if (erreur || !candidat) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <p className="text-error">{erreur || "Candidat introuvable"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-10">
      <div className="mx-auto max-w-3xl">
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

        <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
          <h1
            className="text-2xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {candidat.nom} {candidat.prenom}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Téléphone : {candidat.telephone}
          </p>

          <p className="mt-6 mb-3 text-sm font-semibold text-ink-soft">
            {inscriptions.length} inscription{inscriptions.length > 1 ? "s" : ""} au total
          </p>

          {inscriptions.length === 0 ? (
            <p className="text-sm text-ink-soft">Aucune inscription pour ce candidat.</p>
          ) : (
            <div className="space-y-3">
              {inscriptions.map((insc) => (
                <div
                  key={insc._id}
                  className="rounded-xl border border-ink/10 p-4 text-sm"
                >
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
        </div>
      </div>
    </div>
  );
}
