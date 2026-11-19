"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

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
  nombreImpressions?: number;
};

// En-tête et bas du reçu : viennent des Paramètres du centre
type InfosCentre = {
  nom: string;
  ville: string;
  telephone: string;
  adresse: string;
  niu: string;
  rccm: string;
  piedDePageRecu: string;
  logoUrl: string | null;
};

// Libellés des anciens services (données existantes) ; tout autre service
// est affiché tel qu'il a été saisi dans la page Services
const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  tcf_2mois: "TCF 2 mois",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

const LABEL_PAIEMENT: Record<string, string> = {
  especes: "Espèces",
  orange_money: "Orange Money",
  mobile_money: "MTN Mobile Money",
  mobile_especes: "Mixte (Mobile + Espèces)",
};

export default function RecuPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [infosCentre, setInfosCentre] = useState<InfosCentre | null>(null);
  const [erreur, setErreur] = useState("");
  // Nombre d'impressions déjà faites : dès la 1re, le reçu affiché devient un DUPLICATA
  const [nombreImpressions, setNombreImpressions] = useState(0);
  // Le reçu lui-même reste en français (document officiel du centre) :
  // seuls les messages et les boutons autour suivent la langue choisie
  const { t } = useLangue();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    async function charger() {
      // Le reçu et les informations du centre sont chargés en même temps
      const [resRecu, resCentre] = await Promise.all([
        apiFetch(`/registrations/${id}/receipt`),
        apiFetch("/center/settings"),
      ]);

      if (!resRecu.ok) {
        setErreur(t("recu.introuvable"));
        return;
      }
      if (!resCentre.ok) {
        setErreur(t("recu.erreurCentre"));
        return;
      }

      const donneesRecu: Inscription = await resRecu.json();
      setInscription(donneesRecu);
      setNombreImpressions(donneesRecu.nombreImpressions ?? 0);
      setInfosCentre(await resCentre.json());
    }

    charger().catch(() => setErreur(t("connexion.erreurServeur")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // Le serveur compte chaque impression : la 1re est l'original, les suivantes
  // portent « DUPLICATA »
  async function imprimer() {
    let nouveauNombre = nombreImpressions + 1;
    try {
      const res = await apiFetch(`/registrations/${id}/print`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        nouveauNombre = data.nombreImpressions ?? nouveauNombre;
      }
    } catch {
      // Sans réponse du serveur, on imprime quand même
    }

    if (nouveauNombre >= 2 && nombreImpressions === 0) {
      // Déjà imprimé ailleurs entre-temps : on affiche DUPLICATA avant d'imprimer
      setNombreImpressions(nouveauNombre);
      setTimeout(() => window.print(), 100);
      return;
    }
    window.print();
    setNombreImpressions(nouveauNombre);
  }

  if (erreur) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-red-600">{erreur}</p>
      </div>
    );
  }

  if (!inscription || !infosCentre) {
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

  const adresseComplete = [infosCentre.adresse, infosCentre.ville].filter(Boolean).join(", ");
  // Numéro utilisable dans un lien "tel:" (chiffres et + uniquement)
  const telephoneLien = infosCentre.telephone.replace(/[^\d+]/g, "");

  return (
    <div className="min-h-screen bg-white px-4 py-8 text-black">
      <div className="mx-auto max-w-sm">
        <div className="text-center text-sm leading-relaxed">
          {infosCentre.logoUrl && (
            <img
              src={infosCentre.logoUrl}
              alt="Logo"
              className="mx-auto h-20 w-auto object-contain"
            />
          )}
          <p className="mt-1 font-bold">{infosCentre.nom}</p>
          {infosCentre.niu && <p>NIU : {infosCentre.niu}</p>}
          {infosCentre.rccm && <p>RCCM : {infosCentre.rccm}</p>}
          {infosCentre.telephone && (
            <p>
              Contact :{" "}
              <a href={`tel:${telephoneLien}`} className="text-blue-600 underline">
                {infosCentre.telephone}
              </a>
            </p>
          )}
          {adresseComplete && <p>{adresseComplete}</p>}

          <p className="mt-2 tracking-widest">
            ------------------------------------
          </p>
          <p className="font-bold">REÇU DE PAIEMENT</p>
          {nombreImpressions >= 1 && (
            <p className="my-1 text-lg font-bold tracking-[0.3em]">*** DUPLICATA ***</p>
          )}
          <p className="tracking-widest">
            ------------------------------------
          </p>
        </div>

        <div className="mt-2 space-y-1 text-left text-sm">
          <p>
            <span className="font-bold">N° reçu :</span> {inscription.numeroRecu}
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
            <span className="font-bold">Téléphone :</span>{" "}
            {inscription.candidatId?.telephone}
          </p>
          {inscription.regime && (
            <p>
              <span className="font-bold">Régime :</span> {inscription.regime}
            </p>
          )}
          <p>
            <span className="font-bold">Service :</span>{" "}
            {LABEL_SERVICE[inscription.service] ?? inscription.service}
          </p>
          {dateDebutAffichee && (
            <p>
              <span className="font-bold">📅 Début :</span> {dateDebutAffichee}
            </p>
          )}
          {dateFinAffichee && (
            <p>
              <span className="font-bold">📅 Fin :</span> {dateFinAffichee}
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

          {infosCentre.piedDePageRecu && (
            <p className="text-center tracking-widest">
              ------------------------------------
            </p>
          )}
        </div>

        {/* Texte libre du centre (Paramètres → Reçu) */}
        {infosCentre.piedDePageRecu && (
          <p className="mt-4 whitespace-pre-line text-center text-sm">
            {infosCentre.piedDePageRecu}
          </p>
        )}

        <div className="mb-6 mt-6 flex justify-center gap-3 print:hidden">
          <button
            onClick={imprimer}
            className="rounded-full bg-blue-100 px-6 py-2 font-medium text-blue-700 transition hover:bg-blue-200"
          >
            {t("recu.imprimer")}
          </button>
          <button
            onClick={() => router.push("/candidats")}
            className="rounded-full bg-blue-100 px-6 py-2 font-medium text-blue-700 transition hover:bg-blue-200"
          >
            {t("recu.retour")}
          </button>
        </div>
      </div>
    </div>
  );
}