"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type Candidat = {
  _id: string;
  nom: string;
  prenom: string;
  telephone: string;
};

export default function EnregistrementPage() {
  const router = useRouter();

  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Candidat[]>([]);
  const [candidatSelectionne, setCandidatSelectionne] = useState<Candidat | null>(null);

  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauPrenom, setNouveauPrenom] = useState("");
  const [nouveauTelephone, setNouveauTelephone] = useState("");
  const [erreurTelephone, setErreurTelephone] = useState("");

  const [service, setService] = useState("tcf");
  const [regime, setRegime] = useState("jour");
  const [dateDebutTest, setDateDebutTest] = useState("");
  const [montantNegocie, setMontantNegocie] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [montantPaye, setMontantPaye] = useState("");
  const [montantMobile, setMontantMobile] = useState("");
  const [montantEspeces, setMontantEspeces] = useState("");
  const [facturePar, setFacturePar] = useState("Secretaire 1");
  const [reference, setReference] = useState("");

  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function handleTelephoneChange(valeur: string) {
    const chiffresUniquement = valeur.replace(/\D/g, "").slice(0, 9);
    setNouveauTelephone(chiffresUniquement);

    if (chiffresUniquement.length === 0) {
      setErreurTelephone("");
    } else if (chiffresUniquement.length < 9) {
      setErreurTelephone("Le téléphone doit contenir exactement 9 chiffres");
    } else {
      setErreurTelephone("");
    }
  }

  async function rechercherCandidats() {
    if (!recherche) {
      setResultats([]);
      return;
    }
    const res = await apiFetch(`/candidates?nom=${encodeURIComponent(recherche)}`);
    if (res.ok) {
      setResultats(await res.json());
    }
  }

  async function creerNouveauCandidat(): Promise<Candidat | null> {
    const res = await apiFetch("/candidates", {
      method: "POST",
      body: JSON.stringify({
        nom: nouveauNom,
        prenom: nouveauPrenom,
        telephone: nouveauTelephone,
      }),
    });
    if (!res.ok) {
      setErreur("Impossible de créer le candidat");
      return null;
    }
    return res.json();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setEnvoiEnCours(true);

    let candidat = candidatSelectionne;

    if (!candidat) {
      if (!nouveauNom || !nouveauPrenom || !nouveauTelephone) {
        setErreur("Sélectionne un candidat existant ou remplis ses informations");
        setEnvoiEnCours(false);
        return;
      }
      if (nouveauTelephone.length !== 9) {
        setErreurTelephone("Le téléphone doit contenir exactement 9 chiffres");
        setEnvoiEnCours(false);
        return;
      }
      candidat = await creerNouveauCandidat();
      if (!candidat) {
        setEnvoiEnCours(false);
        return;
      }
    }

    const body: Record<string, unknown> = {
      candidatId: candidat._id,
      service,
      modePaiement,
      facturePar,
      reference: reference || undefined,
    };

    if (service !== "examen_blanc") {
      body.regime = regime;
      body.dateDebutTest = dateDebutTest;
    }
    if (service === "tcf_special") {
      body.montantNegocie = Number(montantNegocie);
    }
    if (modePaiement === "mobile_especes") {
      body.montantMobile = Number(montantMobile);
      body.montantEspeces = Number(montantEspeces);
    } else {
      body.montantPaye = Number(montantPaye);
    }

    const res = await apiFetch("/registrations", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnvoiEnCours(false);
      return;
    }

    const inscription = await res.json();
    router.push(`/recu/${inscription._id}`);
  }

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1
          className="mb-6 text-3xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Enregistrement d'un candidat
        </h1>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-ink/10 bg-white p-8 shadow-sm"
        >
          <label className={labelClass}>Rechercher un candidat existant</label>
          <div className="flex gap-2">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom ou prénom"
              className={champClass}
            />
            <button
              type="button"
              onClick={rechercherCandidats}
              className="whitespace-nowrap rounded-lg border border-ink/15 px-4 py-2.5 font-medium text-ink transition hover:bg-paper"
            >
              Chercher
            </button>
          </div>

          {resultats.length > 0 && (
            <ul className="space-y-1">
              {resultats.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCandidatSelectionne(c);
                      setResultats([]);
                      setRecherche(`${c.nom} ${c.prenom}`);
                    }}
                    className="w-full rounded-lg border border-ink/10 px-3 py-2 text-left transition hover:bg-paper"
                  >
                    {c.nom} {c.prenom} — {c.telephone}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {candidatSelectionne && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
              Candidat sélectionné : {candidatSelectionne.nom} {candidatSelectionne.prenom}
            </p>
          )}

          {!candidatSelectionne && (
            <>
              <label className={labelClass}>Nom</label>
              <input
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                className={champClass}
              />
              <label className={labelClass}>Prénom</label>
              <input
                value={nouveauPrenom}
                onChange={(e) => setNouveauPrenom(e.target.value)}
                className={champClass}
              />
              <label className={labelClass}>Téléphone (9 chiffres)</label>
              <input
                value={nouveauTelephone}
                onChange={(e) => handleTelephoneChange(e.target.value)}
                inputMode="numeric"
                maxLength={9}
                className={champClass}
              />
              {erreurTelephone && (
                <p className="text-sm text-error">{erreurTelephone}</p>
              )}
            </>
          )}

          <div className="border-t border-ink/10 pt-4">
            <label className={labelClass}>Service</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className={champClass}
            >
              <option value="tcf">TCF</option>
              <option value="examen_blanc">Examen blanc</option>
              <option value="tcf_special">TCF SPECIAL</option>
            </select>
          </div>

          {service !== "examen_blanc" && (
            <>
              <label className={labelClass}>Régime</label>
              <select
                value={regime}
                onChange={(e) => setRegime(e.target.value)}
                className={champClass}
              >
                <option value="jour">Jour</option>
                <option value="soir">Soir</option>
              </select>

              <label className={labelClass}>Date de début du test</label>
              <input
                type="date"
                value={dateDebutTest}
                onChange={(e) => setDateDebutTest(e.target.value)}
                className={champClass}
              />
            </>
          )}

          {service === "tcf_special" && (
            <>
              <label className={labelClass}>Montant négocié (FCFA)</label>
              <input
                type="number"
                value={montantNegocie}
                onChange={(e) => setMontantNegocie(e.target.value)}
                className={champClass}
              />
            </>
          )}

          <label className={labelClass}>Mode de paiement</label>
          <select
            value={modePaiement}
            onChange={(e) => setModePaiement(e.target.value)}
            className={champClass}
          >
            <option value="especes">Espèces</option>
            <option value="orange_money">Orange Money</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="mobile_especes">Mobile + Espèces</option>
          </select>

          {modePaiement === "mobile_especes" ? (
            <>
              <label className={labelClass}>Montant Mobile</label>
              <input
                type="number"
                value={montantMobile}
                onChange={(e) => setMontantMobile(e.target.value)}
                className={champClass}
              />
              <label className={labelClass}>Montant Espèces</label>
              <input
                type="number"
                value={montantEspeces}
                onChange={(e) => setMontantEspeces(e.target.value)}
                className={champClass}
              />
            </>
          ) : (
            <>
              <label className={labelClass}>Montant payé</label>
              <input
                type="number"
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                className={champClass}
              />
            </>
          )}

          <label className={labelClass}>Facturé par</label>
          <select
            value={facturePar}
            onChange={(e) => setFacturePar(e.target.value)}
            className={champClass}
          >
            <option value="Secretaire 1">stephane</option>
            <option value="Secretaire 2">vanelle</option>
            <option value="Secretaire 3">silaine</option>
            <option value="Admin">big manager</option>
          </select>

          <label className={labelClass}>Référence (optionnel)</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={champClass}
          />

          <button
            type="submit"
            disabled={envoiEnCours}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent-hover"
          >
            {envoiEnCours ? "Enregistrement..." : "Enregistrer l'inscription"}
          </button>
        </form>
      </div>
    </div>
  );
}