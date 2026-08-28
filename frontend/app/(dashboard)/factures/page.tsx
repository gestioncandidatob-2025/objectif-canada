"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

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

  async function chargerFactures() {
    setChargement(true);
    setErreur("");
    const res = await apiFetch("/registrations/factures/liste");
    if (res.ok) {
      setFactures(await res.json());
    } else {
      setErreur(
        "Impossible de charger les factures (réservé aux administrateurs)",
      );
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
    <div className="px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <h1
          className="mb-2 text-3xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Factures
        </h1>
        <p className="mb-6 text-sm text-ink-soft">
          Toutes les factures générées, stockées sur AWS, de la plus récente à
          la plus ancienne — pour la comptabilité et les impôts.
        </p>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}
        {chargement && <p className="mb-4 text-sm text-ink-soft">Chargement...</p>}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">Reçu N°</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Candidat</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f._id} className="border-b border-ink/5">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                    {f.numeroRecu}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Date(f.dateInscription).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {f.candidatId?.prenom} {f.candidatId?.nom}
                  </td>
                  <td className="px-4 py-3">
                    {formaterNomService(f.service)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {f.montantTotal.toLocaleString("fr-FR")} FCFA
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => ouvrirFacture(f._id)}
                      disabled={ouvertureEnCours === f._id}
                      className="whitespace-nowrap rounded-full border border-seal/30 bg-seal/10 px-4 py-1.5 text-xs font-medium text-seal transition hover:bg-seal/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {ouvertureEnCours === f._id ? "Ouverture..." : "Consulter / Réimprimer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {factures.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              Aucune facture stockée pour le moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}