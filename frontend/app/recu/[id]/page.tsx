"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type Candidat = {
  nom: string;
  prenom: string;
  telephone: string;
};

type Inscription = {
  _id: string;
  candidatId: Candidat;
  service: string;
  regime?: string;
  dateDebutTest?: string;
  dateFin?: string;
  montantTotal: number;
  montantPaye: number;
  resteAPayer: number;
  modePaiement: string;
  facturePar: string;
  reference?: string;
  numeroRecu: string;
  dateInscription: string;
};

const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

const LABEL_PAIEMENT: Record<string, string> = {
  especes: "Espèces",
  orange_money: "Orange Money",
  mobile_money: "Mobile Money",
  mobile_especes: "Mobile + Espèces",
};

export default function RecuPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    async function charger() {
      const res = await apiFetch(`/registrations/${id}/receipt`);
      if (!res.ok) {
        setErreur("Reçu introuvable");
        return;
      }
      setInscription(await res.json());
    }

    charger();
  }, [id, router]);

  if (erreur) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-red-600">{erreur}</p>
      </div>
    );
  }

  if (!inscription) {
    return null;
  }

  const date = new Date(inscription.dateInscription);
  const dateAffichee = date.toLocaleDateString("fr-FR");
  const heureAffichee = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateDebutAffichee = inscription.dateDebutTest
    ? new Date(inscription.dateDebutTest).toLocaleDateString("fr-FR")
    : null;
  const dateFinAffichee = inscription.dateFin
    ? new Date(inscription.dateFin).toLocaleDateString("fr-FR")
    : null;

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-black">
      <div className="mx-auto max-w-sm">
        <div className="text-center text-sm leading-relaxed">
          <img
            src="/logo.jpeg"
            alt="Logo"
            className="mx-auto h-20 w-auto object-contain"
          />
          <p className="mt-1">Centre de formation TCF/TEF</p>
          <p>NIU:M022517596119U</p>
          <p>
            contact :{" "}
            <a href="tel:+237686876873" className="text-blue-600 underline">
              (+237) 686 876 873
            </a>
          </p>
          <p>DLA-Bonamoussadi ancien impôt</p>

          <p className="mt-2 tracking-widest">
            ------------------------------------
          </p>
          <p className="font-bold">REÇU DE PAIEMENT</p>
          <p className="tracking-widest">
            ------------------------------------
          </p>
        </div>

        <div className="mt-2 space-y-1 text-left text-sm">
          <p>
            <span className="font-bold">N° reçu:</span> {inscription.numeroRecu}
          </p>
          <p>
            <span className="font-bold">Date :</span> {dateAffichee}
          </p>
          <p>
            <span className="font-bold">Heure :</span> {heureAffichee}
          </p>

          <p className="text-center tracking-widest">
            ------------------------------------
          </p>

          <p className="font-bold">Nom et Prénom :</p>
          <p>
            {inscription.candidatId?.prenom} {inscription.candidatId?.nom}
          </p>
          <p>
            <span className="font-bold">Téléphone :</span>
            {inscription.candidatId?.telephone}
          </p>
          {inscription.regime && (
            <p>
              <span className="font-bold">régime :</span> {inscription.regime}
            </p>
          )}
          <p>
            <span className="font-bold">Test :</span>{" "}
            {LABEL_SERVICE[inscription.service] ?? inscription.service}
          </p>
          {dateDebutAffichee && (
            <p>
              <span className="font-bold">📅 debut du test :</span> {dateDebutAffichee}
            </p>
          )}
          {dateFinAffichee && (
            <p>
              <span className="font-bold">📅 Fin du test :</span> {dateFinAffichee}
            </p>
          )}

          <p className="text-center tracking-widest">
            ------------------------------------
          </p>

          <p className="font-bold">
            Montant : {inscription.montantTotal.toLocaleString("fr-FR")} FCFA
          </p>
          <p>Payé : {inscription.montantPaye.toLocaleString("fr-FR")} FCFA</p>
          <p>Reste : {inscription.resteAPayer.toLocaleString("fr-FR")} FCFA</p>
          <p>
            <span className="font-bold">Mode de paiement :</span>{" "}
            {LABEL_PAIEMENT[inscription.modePaiement] ?? inscription.modePaiement}
          </p>
          <p>
            Facture établie par : <span className="font-bold">{inscription.facturePar}</span>
          </p>
          {inscription.reference && (
            <p>
              <span className="font-bold">Référence :</span> {inscription.reference}
            </p>
          )}

          <p className="text-center tracking-widest">
            ------------------------------------
          </p>
        
        </div>

        <p className="mt-4 text-center text-sm">
          le goût des C2 c'est chez nous 🍁
        </p>
        <div className="mb-6 flex justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-full bg-blue-100 px-6 py-2 font-medium text-blue-700 transition hover:bg-blue-200"
          >
            Imprimer
          </button>
          <button
            onClick={() => router.push("/candidats")}
            className="rounded-full bg-blue-100 px-6 py-2 font-medium text-blue-700 transition hover:bg-blue-200"
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}