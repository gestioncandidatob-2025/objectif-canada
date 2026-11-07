"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

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

type Tarif = {
  _id: string;
  service: string;
  regimes?: string[];
  prix?: number;
  dureeJours?: number;
  actif: boolean;
  dateFinNecessaire: boolean;
  remiseActive: boolean;
  regimeActif: boolean;
  montantNegociable: boolean;
};

const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  tcf_2mois: "TCF 2 mois",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

function formaterNomService(service: string): string {
  if (!service) return "";
  if (LABEL_SERVICE[service]) return LABEL_SERVICE[service];
  return service
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

// Tous les modes de paiement possibles (mêmes valeurs que dans le backend),
// dans l'ordre où ils s'affichent dans la liste
const ORDRE_MODES_PAIEMENT = ["especes", "orange_money", "mobile_money", "mobile_especes"];

export default function EnregistrementPage() {
  const { t, locale } = useLangue();
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

  const [service, setService] = useState("");
  const [regime, setRegime] = useState("");
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
  // Nom du centre, pour l'aperçu du reçu (jamais un nom écrit en dur)
  const [nomCentre, setNomCentre] = useState("");

  const [tarifsActifs, setTarifsActifs] = useState<Tarif[]>([]);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const utilisateur = JSON.parse(userStr);
      setFacturePar(utilisateur.nom);
      setNomCentre(utilisateur.nomCentre ?? "");
    }
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

  // Modes de paiement acceptés par le centre (Paramètres → Paiements).
  // Par défaut tous, le temps que les paramètres se chargent.
  const [modesAcceptes, setModesAcceptes] = useState<string[]>(ORDRE_MODES_PAIEMENT);

  useEffect(() => {
    async function chargerModesPaiement() {
      const res = await apiFetch("/center/settings");
      if (!res.ok) return;
      const data = await res.json();
      const modes: string[] = Array.isArray(data.modesPaiement) ? data.modesPaiement : [];
      if (modes.length === 0) return;
      setModesAcceptes(modes);
      // Le mode sélectionné doit faire partie des modes acceptés
      setModePaiement((actuel) => (modes.includes(actuel) ? actuel : modes[0]));
    }
    chargerModesPaiement();
  }, []);

  // Modes affichés dans la liste, toujours dans le même ordre
  const modesAffiches = ORDRE_MODES_PAIEMENT.filter((m) => modesAcceptes.includes(m));

  // Il n'y a qu'une seule offre active par service (elle porte elle-même
  // sa liste de régimes le cas échéant).
  function configDuService(svc: string): Tarif | undefined {
    return tarifsActifs.find((t) => t.service === svc);
  }

  const configActuelle = configDuService(service);

  const servicesDisponibles = Array.from(new Set(tarifsActifs.map((t) => t.service)));
  const regimesDisponibles = configActuelle?.regimes ?? [];

  // Dès que les offres actives sont chargées, on sélectionne automatiquement
  // le premier service disponible si aucun n'est encore choisi.
  useEffect(() => {
    if (!service && servicesDisponibles.length > 0) {
      setService(servicesDisponibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarifsActifs]);

  // Dès que le service change, on sélectionne automatiquement le premier
  // régime disponible pour ce service.
  useEffect(() => {
    if (regimesDisponibles.length > 0 && !regimesDisponibles.includes(regime)) {
      setRegime(regimesDisponibles[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, tarifsActifs]);

  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [modalConfirmationOuvert, setModalConfirmationOuvert] = useState(false);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  const modePaiementLabels: Record<string, string> = {
    especes: t("paiement.especes"),
    orange_money: t("paiement.orangeMoney"),
    mobile_money: t("paiement.mobileMoney"),
    mobile_especes: t("paiement.mixte"),
  };
  // Le reçu reste en français (document officiel du centre) : l'aperçu aussi
  const modePaiementLabelsRecu: Record<string, string> = {
    especes: "Espèces",
    orange_money: "Orange Money",
    mobile_money: "MTN Mobile Money",
    mobile_especes: "Mixte (Mobile + Espèces)",
  };

  function calculerMontantTotal(): number {
    const config = configActuelle;
    if (config?.montantNegociable) {
      return Number(montantNegocie) || 0;
    }
    const base = config?.prix ?? 0;
    if (config?.remiseActive) {
      return base - (Number(remise) || 0);
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
    const config = configActuelle;
    if (config?.dateFinNecessaire) {
      return dateFin ? new Date(dateFin).toLocaleDateString("fr-FR") : "-";
    }
    const jours = config?.dureeJours ?? 0;
    const debut = dateDebutTest ? new Date(dateDebutTest) : new Date();
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
      setErreurTelephone(t("facture.erreurTelephone"));
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
      setErreur(t("facture.erreurMontantPositif"));
      return;
    }
    if (montant > detteInfo.inscription.resteAPayer) {
      setErreur(t("facture.erreurMontantDepasse"));
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
    setRechercheEnCours(true);
    const res = await apiFetch(`/candidates?nom=${encodeURIComponent(recherche)}`);
    if (res.ok) {
      setResultats(await res.json());
    }
    setRechercheEnCours(false);
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
      setErreur(t("facture.erreurCreationCandidat"));
      return null;
    }
    return res.json();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");

    if (detteInfo?.aUneDette) {
      setErreur(t("facture.erreurDette"));
      return;
    }

    if (!candidatSelectionne) {
      if (!nouveauNom || !nouveauPrenom || !nouveauTelephone) {
        setErreur(t("facture.erreurCandidat"));
        return;
      }
      if (nouveauTelephone.length !== 9) {
        setErreurTelephone(t("facture.erreurTelephone"));
        return;
      }
    }

    const config = configActuelle;
    if (!config) {
      setErreur(t("facture.erreurAucuneOffre"));
      return;
    }

    if (config.regimeActif && !regime) {
      setErreur(t("facture.erreurRegime"));
      return;
    }

    if (config.regimeActif && !dateDebutTest) {
      setErreur(t("facture.erreurDateDebut"));
      return;
    }

    if (config.dateFinNecessaire && !dateFin) {
      setErreur(t("facture.erreurDateFin"));
      return;
    }

    if (config.montantNegociable && !montantNegocie) {
      setErreur(t("facture.erreurMontantNegocie"));
      return;
    }

    const MONTANT_MINIMUM_INSCRIPTION = 25000;
    const montantTotal = calculerMontantTotal();
    const montantPayeCalcule = calculerMontantPaye();

    if (montantTotal > MONTANT_MINIMUM_INSCRIPTION && montantPayeCalcule <= MONTANT_MINIMUM_INSCRIPTION) {
      setErreur(
        t("facture.erreurMinimum", { minimum: MONTANT_MINIMUM_INSCRIPTION.toLocaleString(locale) }),
      );
      return;
    }
    if (montantTotal <= MONTANT_MINIMUM_INSCRIPTION && montantPayeCalcule < montantTotal) {
      setErreur(
        t("facture.erreurPayerTout", {
          total: montantTotal.toLocaleString(locale),
          minimum: MONTANT_MINIMUM_INSCRIPTION.toLocaleString(locale),
        }),
      );
      return;
    }

    // Toutes les validations sont bonnes : on ouvre le modal de récapitulatif
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

    const config = configActuelle;

    const body: Record<string, unknown> = {
      candidatId: candidat._id,
      service,
      modePaiement,
      facturePar,
      reference: reference || undefined,
    };

    if (config?.regimeActif) {
      body.regime = regime;
      body.dateDebutTest = dateDebutTest;
    }

    if (config?.dateFinNecessaire) {
      body.dateFin = dateFin;
    }

    if (config?.montantNegociable) {
      body.montantNegocie = Number(montantNegocie);
    }

    if (config?.remiseActive && remise) {
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

  // text-base (16 px) : sur téléphone, le navigateur ne zoome pas quand on touche un champ
  const champClass =
    "w-full min-w-0 rounded-lg border border-ink/15 px-3 py-2.5 text-base text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <h1
          className="mb-6 text-2xl text-ink sm:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("facture.titre")}
        </h1>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:gap-8">
          {!detteInfo?.aUneDette && (
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-8">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  {t("facture.apercuRecu")}
                </p>
                <div className="text-center text-sm leading-relaxed text-ink">
                  <p className="mt-1 font-semibold">{nomCentre}</p>
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
                  {configActuelle?.regimeActif && (
                    <p>
                      <span className="font-bold">Régime :</span> {regime || "—"}
                    </p>
                  )}
                  <p>
                    <span className="font-bold">Test :</span> {formaterNomService(service)}
                  </p>
                  <p>
                    <span className="font-bold">📅 Fin du test :</span> {calculerDateFin()}
                  </p>

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
                    {modePaiementLabelsRecu[modePaiement]}
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
          className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8"
        >
          <label className={labelClass}>{t("facture.rechercher")}</label>
          <div className="flex gap-2">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={t("facture.rechercherExemple")}
              className={champClass}
            />
            <button
              type="button"
              onClick={rechercherCandidats}
              disabled={rechercheEnCours}
              className="whitespace-nowrap rounded-lg border border-ink/15 px-4 py-2.5 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rechercheEnCours ? t("facture.rechercheEnCours") : t("facture.chercher")}
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
              {t("facture.candidatSelectionne", {
                nom: `${candidatSelectionne.nom} ${candidatSelectionne.prenom}`,
              })}
            </p>
          )}

          {verificationDetteEnCours && (
            <p className="text-sm text-ink-soft">{t("facture.verificationClient")}</p>
          )}

          {detteInfo?.aUneDette && detteInfo.inscription && candidatSelectionne && (
            <div className="space-y-3 rounded-lg border border-error/30 bg-error/10 p-4">
              <p className="text-sm font-medium text-error">
                {t("facture.detteExplication", {
                  nom: `${candidatSelectionne.nom} ${candidatSelectionne.prenom}`,
                  recu: detteInfo.inscription.numeroRecu,
                  reste: detteInfo.inscription.resteAPayer.toLocaleString(locale),
                })}
              </p>
              <div>
                <label className={labelClass}>{t("facture.montantRecuAujourdhui")}</label>
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
                {paiementEnCours ? t("facture.miseAJourEnCours") : t("facture.mettreAJourPaiement")}
              </button>
            </div>
          )}

          {!candidatSelectionne && (
            <>
              <label className={labelClass}>{t("facture.nom")}</label>
              <input
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value)}
                className={champClass}
              />
              <label className={labelClass}>{t("facture.prenom")}</label>
              <input
                value={nouveauPrenom}
                onChange={(e) => setNouveauPrenom(e.target.value)}
                className={champClass}
              />
              <label className={labelClass}>{t("facture.telephone9")}</label>
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
                <label className={labelClass}>{t("facture.service")}</label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className={champClass}
                >
                  {servicesDisponibles.length === 0 && (
                    <option value="">{t("facture.aucuneOffreOption")}</option>
                  )}
                  {servicesDisponibles.map((s) => (
                    <option key={s} value={s}>
                      {formaterNomService(s)}
                    </option>
                  ))}
                </select>
              </div>

              {configActuelle?.regimeActif && (
                <>
                  <label className={labelClass}>{t("facture.regime")}</label>
                  <select
                    value={regime}
                    onChange={(e) => setRegime(e.target.value)}
                    className={champClass}
                  >
                    {regimesDisponibles.length === 0 && (
                      <option value="">{t("facture.aucunRegime")}</option>
                    )}
                    {regimesDisponibles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <label className={labelClass}>{t("facture.dateDebut")}</label>
                  <input
                    type="date"
                    value={dateDebutTest}
                    onChange={(e) => setDateDebutTest(e.target.value)}
                    className={champClass}
                  />
                </>
              )}

              {configActuelle?.dateFinNecessaire && (
                <>
                  <label className={labelClass}>{t("facture.dateFin")}</label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className={champClass}
                  />
                </>
              )}

              {configActuelle?.montantNegociable && (
                <>
                  <label className={labelClass}>{t("facture.montantNegocie")}</label>
                  <input
                    type="number"
                    value={montantNegocie}
                    onChange={(e) => setMontantNegocie(e.target.value)}
                    className={champClass}
                  />
                </>
              )}

              {configActuelle?.remiseActive && (
                <>
                  <label className={labelClass}>{t("facture.remise")}</label>
                  <input
                    type="number"
                    value={remise}
                    onChange={(e) => setRemise(e.target.value)}
                    className={champClass}
                  />
                </>
              )}

              <label className={labelClass}>{t("facture.modePaiement")}</label>
              <select
                value={modePaiement}
                onChange={(e) => setModePaiement(e.target.value)}
                className={champClass}
              >
                {modesAffiches.map((mode) => (
                  <option key={mode} value={mode}>
                    {modePaiementLabels[mode] ?? mode}
                  </option>
                ))}
              </select>

              {modePaiement === "mobile_especes" ? (
                <>
                  <label className={labelClass}>{t("facture.montantMobile")}</label>
                  <input
                    type="number"
                    value={montantMobile}
                    onChange={(e) => setMontantMobile(e.target.value)}
                    className={champClass}
                  />
                  <label className={labelClass}>{t("facture.montantEspeces")}</label>
                  <input
                    type="number"
                    value={montantEspeces}
                    onChange={(e) => setMontantEspeces(e.target.value)}
                    className={champClass}
                  />
                </>
              ) : (
                <>
                  <label className={labelClass}>{t("facture.montantPaye")}</label>
                  <input
                    type="number"
                    value={montantPaye}
                    onChange={(e) => setMontantPaye(e.target.value)}
                    className={champClass}
                  />
                </>
              )}

              <label className={labelClass}>{t("facture.facturePar")}</label>
              <input
                value={facturePar}
                disabled
                className={`${champClass} cursor-not-allowed bg-paper text-ink-soft`}
              />

              <label className={labelClass}>{t("facture.reference")}</label>
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
                {envoiEnCours ? t("facture.enregistrementCourt") : t("facture.enregistrer")}
              </button>
            </>
          )}
        </form>
          </div>
        </div>
      </div>

      {modalConfirmationOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
            <h2
              className="mb-4 text-xl text-ink"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("facture.confirmerTitre")}
            </h2>
            <div className="space-y-2 text-sm text-ink">
              <p>
                <span className="text-ink-soft">{t("facture.candidat")} : </span>
                {candidatSelectionne
                  ? `${candidatSelectionne.nom} ${candidatSelectionne.prenom}`
                  : `${nouveauNom} ${nouveauPrenom}`}
              </p>
              <p>
                <span className="text-ink-soft">{t("facture.telephone")} : </span>
                {candidatSelectionne ? candidatSelectionne.telephone : nouveauTelephone}
              </p>
              <p>
                <span className="text-ink-soft">{t("facture.service")} : </span>
                {formaterNomService(service)}
              </p>
              {configActuelle?.regimeActif && (
                <p>
                  <span className="text-ink-soft">{t("facture.regime")} : </span>
                  {regime}
                </p>
              )}
              <p>
                <span className="text-ink-soft">{t("facture.dateFinFormation")} : </span>
                {calculerDateFin()}
              </p>
              <p>
                <span className="text-ink-soft">{t("facture.montantTotal")} : </span>
                {calculerMontantTotal().toLocaleString(locale)} FCFA
              </p>
              {configActuelle?.remiseActive && Number(remise) > 0 && (
                <p>
                  <span className="text-ink-soft">{t("facture.remiseAppliquee")} : </span>
                  {Number(remise).toLocaleString(locale)} FCFA
                </p>
              )}
              <p>
                <span className="text-ink-soft">{t("facture.montantPaye")} : </span>
                {calculerMontantPaye().toLocaleString(locale)} FCFA
              </p>
              <p>
                <span className="text-ink-soft">{t("facture.resteAPayer")} : </span>
                {(calculerMontantTotal() - calculerMontantPaye()).toLocaleString(locale)} FCFA
              </p>
              <p>
                <span className="text-ink-soft">{t("facture.modePaiement")} : </span>
                {modePaiementLabels[modePaiement]}
              </p>
              <p>
                <span className="text-ink-soft">{t("facture.facturePar")} : </span>
                {facturePar}
              </p>
              {reference && (
                <p>
                  <span className="text-ink-soft">{t("facture.referenceCourt")} : </span>
                  {reference}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setModalConfirmationOuvert(false)}
                disabled={envoiEnCours}
                className="flex-1 rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("commun.annuler")}
              </button>
              <button
                type="button"
                onClick={confirmerEtEnregistrer}
                disabled={envoiEnCours}
                className="flex-1 rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.98] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {envoiEnCours ? t("facture.enregistrementEnCours") : t("facture.confirmerEtEnregistrer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}