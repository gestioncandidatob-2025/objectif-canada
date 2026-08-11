"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type Candidat = {
  _id: string;
  nom: string;
  prenom: string;
  telephone: string;
};

type DetteInfo = {
  existe: boolean;
  aUneDette?: boolean;
  candidat?: Candidat;
  inscription?: {
    _id: string;
    numeroRecu: string;
    montantTotal: number;
    montantPaye: number;
    resteAPayer: number;
  };
};

export default function EnregistrementPage() {
  const router = useRouter();

  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Candidat[]>([]);
  const [candidatSelectionne, setCandidatSelectionne] = useState<Candidat | null>(null);

  const [detteInfo, setDetteInfo] = useState<DetteInfo | null>(null);
  const [verificationDetteEnCours, setVerificationDetteEnCours] = useState(false);
  const [montantComplement, setMontantComplement] = useState("");
  const [paiementEnCours, setPaiementEnCours] = useState(false);

  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauPrenom, setNouveauPrenom] = useState("");
  const [nouveauTelephone, setNouveauTelephone] = useState("");
  const [erreurTelephone, setErreurTelephone] = useState("");

  const [service, setService] = useState("tcf");
  const [regime, setRegime] = useState("jour");
  const [dateDebutTest, setDateDebutTest] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [montantNegocie, setMontantNegocie] = useState("");
  const [remise, setRemise] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [montantPaye, setMontantPaye] = useState("");
  const [montantMobile, setMontantMobile] = useState("");
  const [montantEspeces, setMontantEspeces] = useState("");
  const [reference, setReference] = useState("");

  const [facturePar, setFacturePar] = useState("");

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setFacturePar(JSON.parse(userStr).nom);
    }
  }, []);

  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [modalConfirmationOuvert, setModalConfirmationOuvert] = useState(false);

  const serviceLabels: Record<string, string> = {
    tcf: "TCF",
    tcf_2mois: "TCF 2 mois",
    examen_blanc: "Examen blanc",
    tcf_special: "TCF SPECIAL",
  };
  const regimeLabels: Record<string, string> = { jour: "Jour", soir: "Soir" };
  const modePaiementLabels: Record<string, string> = {
    especes: "Espèces",
    orange_money: "Orange Money",
    mobile_money: "Mobile Money",
    mobile_especes: "Mobile + Espèces",
  };

  function calculerMontantTotal(): number {
    let base: number;
    switch (service) {
      case "tcf":
        base = 65000;
        return base - (Number(remise) || 0);
      case "tcf_2mois":
        base = 120000;
        break;
      case "examen_blanc":
        base = 5000;
        break;
      case "tcf_special":
        return Number(montantNegocie) || 0;
      default:
        base = 0;
    }
    return base;
  }

  function calculerMontantPaye(): number {
    if (modePaiement === "mobile_especes") {
      return (Number(montantMobile) || 0) + (Number(montantEspeces) || 0);
    }
    return Number(montantPaye) || 0;
  }

  function calculerDateFin(): string {
    if (service === "examen_blanc") {
      return new Date().toLocaleDateString("fr-FR");
    }
    if (service === "tcf_special") {
      return dateFin ? new Date(dateFin).toLocaleDateString("fr-FR") : "-";
    }
    if (!dateDebutTest) return "-";
    const debut = new Date(dateDebutTest);
    const jours = service === "tcf_2mois" ? 62 : 35;
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + jours);
    return fin.toLocaleDateString("fr-FR");
  }

  function handleTelephoneChange(valeur: string) {
    const chiffresUniquement = valeur.replace(/\D/g, "").slice(0, 9);
    setNouveauTelephone(chiffresUniquement);
    setDetteInfo(null);

    if (chiffresUniquement.length === 0) {
      setErreurTelephone("");
    } else if (chiffresUniquement.length < 9) {
      setErreurTelephone("Le téléphone doit contenir exactement 9 chiffres");
    } else {
      setErreurTelephone("");
      verifierDette(chiffresUniquement);
    }
  }

  async function verifierDette(telephone: string) {
    setVerificationDetteEnCours(true);
    const res = await apiFetch(`/registrations/dette/${telephone}`);
    setVerificationDetteEnCours(false);
    if (!res.ok) {
      return;
    }
    const data: DetteInfo = await res.json();
    setDetteInfo(data);

    // Le téléphone correspond déjà à un candidat existant : on le sélectionne
    // pour éviter de créer un doublon, qu'il ait une dette ou non.
    if (data.existe && data.candidat) {
      setCandidatSelectionne(data.candidat);
      setResultats([]);
    }
  }

  async function mettreAJourPaiement() {
    if (!detteInfo?.inscription) return;
    setErreur("");

    const montant = Number(montantComplement);
    if (!montant || montant <= 0) {
      setErreur("Le montant à ajouter doit être positif");
      return;
    }
    if (montant > detteInfo.inscription.resteAPayer) {
      setErreur("Ce montant dépasse le reste à payer");
      return;
    }

    setPaiementEnCours(true);
    const res = await apiFetch(`/registrations/${detteInfo.inscription._id}/payment`, {
      method: "PATCH",
      body: JSON.stringify({ montant }),
    });
    setPaiementEnCours(false);

    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      return;
    }

    const inscription = await res.json();
    router.push(`/recu/${inscription._id}`);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");

    if (detteInfo?.aUneDette) {
      setErreur("Ce client a une dette en cours : mets à jour son paiement au lieu de créer un nouvel enregistrement");
      return;
    }

    if (!candidatSelectionne) {
      if (!nouveauNom || !nouveauPrenom || !nouveauTelephone) {
        setErreur("Sélectionne un candidat existant ou remplis ses informations");
        return;
      }
      if (nouveauTelephone.length !== 9) {
        setErreurTelephone("Le téléphone doit contenir exactement 9 chiffres");
        return;
      }
    }

    if (service !== "examen_blanc" && !dateDebutTest) {
      setErreur("La date de début du test est obligatoire");
      return;
    }

    if (service === "tcf_special" && (!dateFin || !montantNegocie)) {
      setErreur("La date de fin et le montant négocié sont obligatoires pour le TCF SPECIAL");
      return;
    }

    // Toutes les validations sont bonnes : on ouvre le modal de récapitulatif
    // avant d'envoyer quoi que ce soit au serveur.
    setModalConfirmationOuvert(true);
  }

  async function confirmerEtEnregistrer() {
    setErreur("");
    setEnvoiEnCours(true);

    let candidat = candidatSelectionne;

    if (!candidat) {
      candidat = await creerNouveauCandidat();
      if (!candidat) {
        setEnvoiEnCours(false);
        setModalConfirmationOuvert(false);
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

    // La date de fin n'est saisie manuellement QUE pour TCF SPECIAL.
    // Pour tous les autres services, elle est calculée automatiquement côté backend.
    if (service === "tcf_special") {
      body.dateFin = dateFin;
      body.montantNegocie = Number(montantNegocie);
    } else if (service === "tcf" && remise) {
      body.remise = Number(remise);
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
      setModalConfirmationOuvert(false);
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
      <div className="mx-auto max-w-5xl">
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

        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {!detteInfo?.aUneDette && (
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm lg:sticky lg:top-8">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Aperçu du reçu
                </p>
                <div className="text-center text-sm leading-relaxed text-ink">
                  <p className="mt-1">Centre de formation TCF/TEF</p>
                  <p className="mt-2 tracking-widest text-ink-soft">
                    ------------------------------------
                  </p>
                  <p className="font-bold">REÇU DE PAIEMENT</p>
                  <p className="tracking-widest text-ink-soft">
                    ------------------------------------
                  </p>
                </div>

                <div className="mt-2 space-y-1 text-left text-sm text-ink">
                  <p className="font-bold">Nom et Prénom :</p>
                  <p>
                    {candidatSelectionne
                      ? `${candidatSelectionne.prenom} ${candidatSelectionne.nom}`
                      : nouveauNom || nouveauPrenom
                        ? `${nouveauPrenom} ${nouveauNom}`
                        : "—"}
                  </p>
                  <p>
                    <span className="font-bold">Téléphone :</span>{" "}
                    {candidatSelectionne ? candidatSelectionne.telephone : nouveauTelephone || "—"}
                  </p>
                  {service !== "examen_blanc" && (
                    <p>
                      <span className="font-bold">Régime :</span> {regimeLabels[regime]}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Test :</span> {serviceLabels[service]}
                  </p>
                  {service !== "examen_blanc" && (
                    <p>
                      <span className="font-bold">📅 Fin du test :</span> {calculerDateFin()}
                    </p>
                  )}

                  <p className="text-center tracking-widest text-ink-soft">
                    ------------------------------------
                  </p>

                  <p className="font-bold">
                    Montant : {calculerMontantTotal().toLocaleString("fr-FR")} FCFA
                  </p>
                  <p>Payé : {calculerMontantPaye().toLocaleString("fr-FR")} FCFA</p>
                  <p>
                    Reste :{" "}
                    {(calculerMontantTotal() - calculerMontantPaye()).toLocaleString("fr-FR")} FCFA
                  </p>
                  <p>
                    <span className="font-bold">Mode de paiement :</span>{" "}
                    {modePaiementLabels[modePaiement]}
                  </p>
                  {reference && (
                    <p>
                      <span className="font-bold">Référence :</span> {reference}
                    </p>
                  )}

                  <p className="text-center tracking-widest text-ink-soft">
                    ------------------------------------
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={detteInfo?.aUneDette ? "lg:col-span-2" : "order-1 lg:order-2"}>
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-ink/10 bg-white p-8 shadow-sm"
        >
          <label className={labelClass}>Rechercher un candidat existant</label>
          <div className="flex gap-2">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, prénom ou téléphone"
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
                      verifierDette(c.telephone);
                    }}
                    className="w-full rounded-lg border border-ink/10 px-3 py-2 text-left transition hover:bg-paper"
                  >
                    {c.nom} {c.prenom} — {c.telephone}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {candidatSelectionne && !detteInfo?.aUneDette && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
              Candidat sélectionné : {candidatSelectionne.nom} {candidatSelectionne.prenom}
            </p>
          )}

          {verificationDetteEnCours && (
            <p className="text-sm text-ink-soft">Vérification du client...</p>
          )}

          {detteInfo?.aUneDette && detteInfo.inscription && candidatSelectionne && (
            <div className="space-y-3 rounded-lg border border-error/30 bg-error/10 p-4">
              <p className="text-sm font-medium text-error">
                Ce client existe déjà ({candidatSelectionne.nom} {candidatSelectionne.prenom}) et
                a une dette en cours sur le reçu N° {detteInfo.inscription.numeroRecu} : reste à
                payer {detteInfo.inscription.resteAPayer.toLocaleString("fr-FR")} FCFA. Mets à
                jour son paiement au lieu de créer un nouvel enregistrement — le numéro de facture
                reste le même tant que le paiement n'est pas complété.
              </p>
              <div>
                <label className={labelClass}>Montant reçu aujourd'hui (FCFA)</label>
                <input
                  type="number"
                  value={montantComplement}
                  onChange={(e) => setMontantComplement(e.target.value)}
                  className={champClass}
                />
              </div>
              <button
                type="button"
                onClick={mettreAJourPaiement}
                disabled={paiementEnCours}
                className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent-hover"
              >
                {paiementEnCours ? "Mise à jour du paiement en cours..." : "Mettre à jour le paiement"}
              </button>
            </div>
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

          {!detteInfo?.aUneDette && (
            <>
              <div className="border-t border-ink/10 pt-4">
                <label className={labelClass}>Service</label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className={champClass}
                >
                  <option value="tcf">TCF</option>
                  <option value="tcf_2mois">TCF 2 mois</option>
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
                  <label className={labelClass}>Date de fin du test</label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className={champClass}
                  />

                  <label className={labelClass}>Montant négocié (FCFA)</label>
                  <input
                    type="number"
                    value={montantNegocie}
                    onChange={(e) => setMontantNegocie(e.target.value)}
                    className={champClass}
                  />
                </>
              )}

              {service === "tcf" && (
                <>
                  <label className={labelClass}>Remise (FCFA, optionnel)</label>
                  <input
                    type="number"
                    value={remise}
                    onChange={(e) => setRemise(e.target.value)}
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
              <input
                value={facturePar}
                disabled
                className={`${champClass} cursor-not-allowed bg-paper text-ink-soft`}
              />

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
            </>
          )}
        </form>
          </div>
        </div>
      </div>

      {modalConfirmationOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2
              className="mb-4 text-xl text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Confirmer l'enregistrement
            </h2>
            <div className="space-y-2 text-sm text-ink">
              <p>
                <span className="text-ink-soft">Candidat : </span>
                {candidatSelectionne
                  ? `${candidatSelectionne.nom} ${candidatSelectionne.prenom}`
                  : `${nouveauNom} ${nouveauPrenom}`}
              </p>
              <p>
                <span className="text-ink-soft">Téléphone : </span>
                {candidatSelectionne ? candidatSelectionne.telephone : nouveauTelephone}
              </p>
              <p>
                <span className="text-ink-soft">Service : </span>
                {serviceLabels[service]}
              </p>
              {service !== "examen_blanc" && (
                <>
                  <p>
                    <span className="text-ink-soft">Régime : </span>
                    {regimeLabels[regime]}
                  </p>
                  <p>
                    <span className="text-ink-soft">Date de fin de formation : </span>
                    {calculerDateFin()}
                  </p>
                </>
              )}
              <p>
                <span className="text-ink-soft">Montant total : </span>
                {calculerMontantTotal().toLocaleString("fr-FR")} FCFA
              </p>
              {service === "tcf" && Number(remise) > 0 && (
                <p>
                  <span className="text-ink-soft">Remise appliquée : </span>
                  {Number(remise).toLocaleString("fr-FR")} FCFA
                </p>
              )}
              <p>
                <span className="text-ink-soft">Montant payé : </span>
                {calculerMontantPaye().toLocaleString("fr-FR")} FCFA
              </p>
              <p>
                <span className="text-ink-soft">Reste à payer : </span>
                {(calculerMontantTotal() - calculerMontantPaye()).toLocaleString("fr-FR")} FCFA
              </p>
              <p>
                <span className="text-ink-soft">Mode de paiement : </span>
                {modePaiementLabels[modePaiement]}
              </p>
              <p>
                <span className="text-ink-soft">Facturé par : </span>
                {facturePar}
              </p>
              {reference && (
                <p>
                  <span className="text-ink-soft">Référence : </span>
                  {reference}
                </p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setModalConfirmationOuvert(false)}
                disabled={envoiEnCours}
                className="flex-1 rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmerEtEnregistrer}
                disabled={envoiEnCours}
                className="flex-1 rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.98] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {envoiEnCours ? "Enregistrement en cours..." : "Confirmer et enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}