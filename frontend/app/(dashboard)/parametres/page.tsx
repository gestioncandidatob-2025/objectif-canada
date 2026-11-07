"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "../../lib/api";
import { signalerCentreModifie } from "../../lib/centre";
import { useLangue } from "../../lib/langue";
import TarifsPage from "../tarifs/page";

type Parametres = {
  nom: string;
  ville: string;
  telephone: string;
  adresse: string;
  niu: string;
  rccm: string;
  piedDePageRecu: string;
  modesPaiement: string[];
  logoUrl: string | null;
  plan: string;
};

type ChampTexte = "nom" | "ville" | "telephone" | "adresse" | "niu" | "rccm" | "piedDePageRecu";

type Onglet = "centre" | "recu" | "services" | "paiements";

// label et description : clés de traduction (lib/traductions.ts)
const ONGLETS: { cle: Onglet; label: string }[] = [
  { cle: "centre", label: "parametres.ongletCentre" },
  { cle: "recu", label: "parametres.ongletRecu" },
  { cle: "services", label: "parametres.ongletServices" },
  { cle: "paiements", label: "parametres.ongletPaiements" },
];

// Mêmes valeurs que dans le backend (ModePaiement)
const MODES_PAIEMENT: { cle: string; label: string; description: string }[] = [
  { cle: "especes", label: "paiement.especes", description: "parametres.especesDetail" },
  { cle: "orange_money", label: "paiement.orangeMoney", description: "parametres.orangeDetail" },
  { cle: "mobile_money", label: "paiement.mobileMoney", description: "parametres.mtnDetail" },
  { cle: "mobile_especes", label: "parametres.mixte", description: "parametres.mixteDetail" },
];

const TAILLE_MAX_LOGO = 1024 * 1024; // 1 Mo
const LONGUEUR_MAX_PIED_DE_PAGE = 300;

// Le serveur renvoie soit un message, soit une liste de messages
function messageErreur(data: { message?: string | string[] } | null, parDefaut: string): string {
  if (!data?.message) return parDefaut;
  return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

export default function ParametresPage() {
  const [estAdmin, setEstAdmin] = useState<boolean | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("centre");
  const [formulaire, setFormulaire] = useState<Parametres | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [envoiLogoEnCours, setEnvoiLogoEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const { t } = useLangue();

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";
  const boutonClass =
    "rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    // Onglet demandé dans l'adresse (ex : /parametres?onglet=paiements)
    const demande = new URLSearchParams(window.location.search).get("onglet");
    if (demande && ONGLETS.some((o) => o.cle === demande)) {
      setOnglet(demande as Onglet);
    }

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const admin = user?.role === "admin";
    setEstAdmin(admin);
    if (admin) {
      charger();
    }
  }, []);

  async function charger() {
    setChargement(true);
    try {
      const res = await apiFetch("/center/settings");
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, t("parametres.erreurChargement")));
        return;
      }
      setFormulaire(data);
    } catch {
      setErreur(t("connexion.erreurServeur"));
    } finally {
      setChargement(false);
    }
  }

  function changerOnglet(nouvelOnglet: Onglet) {
    setOnglet(nouvelOnglet);
    setMessage("");
    setErreur("");
  }

  function modifierChamp(champ: ChampTexte, valeur: string) {
    setFormulaire((f) => (f ? { ...f, [champ]: valeur } : f));
  }

  // Le nom du centre est aussi gardé dans le navigateur (affiché ailleurs)
  function mettreAJourNomCentreLocal(nom: string) {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;
      const user = JSON.parse(userStr);
      user.nomCentre = nom;
      localStorage.setItem("user", JSON.stringify(user));
    } catch {
      // pas grave : le nom sera à jour à la prochaine connexion
    }
  }

  /** Envoie au serveur uniquement les champs de l'onglet en cours */
  async function enregistrer(champs: (keyof Parametres)[]) {
    if (!formulaire) return;
    setMessage("");
    setErreur("");

    if (champs.includes("nom") && !formulaire.nom.trim()) {
      setErreur(t("parametres.erreurNom"));
      return;
    }

    const corps: Record<string, unknown> = {};
    for (const champ of champs) {
      corps[champ] = formulaire[champ];
    }

    setEnregistrementEnCours(true);
    try {
      const res = await apiFetch("/center/settings", {
        method: "PATCH",
        body: JSON.stringify(corps),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, t("parametres.erreurEnregistrement")));
        return;
      }
      setFormulaire(data);
      mettreAJourNomCentreLocal(data.nom);
      // Le menu se met à jour tout de suite (nom du centre)
      signalerCentreModifie();
      setMessage(t("parametres.modificationsEnregistrees"));
    } catch {
      setErreur(t("connexion.erreurServeur"));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function envoyerLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    // Vider le champ permet de renvoyer le même fichier si besoin
    e.target.value = "";
    if (!fichier) return;

    setMessage("");
    setErreur("");

    if (!["image/png", "image/jpeg"].includes(fichier.type)) {
      setErreur(t("parametres.erreurLogoType"));
      return;
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      setErreur(t("parametres.erreurLogoTaille"));
      return;
    }

    const donnees = new FormData();
    donnees.append("logo", fichier);

    setEnvoiLogoEnCours(true);
    try {
      // Pas de "Content-Type" ici : le navigateur le remplit seul pour un fichier
      const token = getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/center/logo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: donnees,
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, t("parametres.erreurLogoEnvoi")));
        return;
      }
      setFormulaire((f) => (f ? { ...f, logoUrl: data.logoUrl } : data));
      // Le menu affiche tout de suite le nouveau logo
      signalerCentreModifie();
      setMessage(t("parametres.logoEnregistre"));
    } catch {
      setErreur(t("connexion.erreurServeur"));
    } finally {
      setEnvoiLogoEnCours(false);
    }
  }

  function basculerModePaiement(cle: string) {
    if (!formulaire) return;
    setMessage("");
    setErreur("");
    const dejaCoche = formulaire.modesPaiement.includes(cle);
    if (dejaCoche && formulaire.modesPaiement.length === 1) {
      setErreur(t("parametres.erreurAuMoinsUnMode"));
      return;
    }
    const nouveauxModes = dejaCoche
      ? formulaire.modesPaiement.filter((m) => m !== cle)
      : [...formulaire.modesPaiement, cle];
    setFormulaire({ ...formulaire, modesPaiement: nouveauxModes });
  }

  // Encore en train de lire l'utilisateur connecté
  if (estAdmin === null) {
    return null;
  }

  if (!estAdmin) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-ink/10 bg-white p-8 text-center text-ink-soft shadow-sm">
          {t("parametres.reserveAdmin")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pt-10">
        <div className="mx-auto max-w-3xl">
          <h1
            className="mb-6 text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("menu.parametres")}
          </h1>

          {/* Onglets */}
          <div className="mb-6 flex gap-1 overflow-x-auto border-b border-ink/10">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                type="button"
                onClick={() => changerOnglet(o.cle)}
                className={
                  "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition " +
                  (onglet === o.cle
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-soft hover:text-ink")
                }
              >
                {t(o.label)}
              </button>
            ))}
          </div>

          {onglet !== "services" && message && (
            <p className="mb-4 rounded-lg bg-accent/10 px-3 py-2.5 text-sm text-accent">{message}</p>
          )}
          {onglet !== "services" && erreur && (
            <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{erreur}</p>
          )}

          {onglet !== "services" && chargement && (
            <p className="text-sm text-ink-soft">{t("commun.chargement")}</p>
          )}
        </div>
      </div>

      {/* ---------- Onglet Centre ---------- */}
      {onglet === "centre" && formulaire && (
        <div className="px-4 pb-10">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-ink">{t("parametres.logo")}</h2>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-ink/20 bg-paper">
                  {formulaire.logoUrl ? (
                    <img
                      src={formulaire.logoUrl}
                      alt={t("menu.logoDuCentre")}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-ink-soft">{t("parametres.aucunLogo")}</span>
                  )}
                </div>
                <div>
                  <label
                    className={
                      "inline-block cursor-pointer rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-paper " +
                      (envoiLogoEnCours ? "pointer-events-none opacity-60" : "")
                    }
                  >
                    {envoiLogoEnCours
                      ? t("parametres.envoiEnCours")
                      : formulaire.logoUrl
                        ? t("parametres.changerLogo")
                        : t("parametres.choisirLogo")}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={envoyerLogo}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-2 text-xs text-ink-soft">{t("parametres.formatLogo")}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-ink">{t("parametres.infosCentre")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    {t("parametres.nomCentre")} <span className="text-error">*</span>
                  </label>
                  <input
                    value={formulaire.nom}
                    onChange={(e) => modifierChamp("nom", e.target.value)}
                    maxLength={100}
                    className={champClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("parametres.ville")}</label>
                  <input
                    value={formulaire.ville}
                    onChange={(e) => modifierChamp("ville", e.target.value)}
                    placeholder={t("parametres.villeExemple")}
                    maxLength={100}
                    className={champClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("facture.telephone")}</label>
                  <input
                    type="tel"
                    value={formulaire.telephone}
                    onChange={(e) => modifierChamp("telephone", e.target.value)}
                    placeholder="Ex : +237 699 00 00 00"
                    maxLength={30}
                    className={champClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t("parametres.adresse")}</label>
                  <input
                    value={formulaire.adresse}
                    onChange={(e) => modifierChamp("adresse", e.target.value)}
                    placeholder={t("parametres.adresseExemple")}
                    maxLength={200}
                    className={champClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>NIU</label>
                  <input
                    value={formulaire.niu}
                    onChange={(e) => modifierChamp("niu", e.target.value)}
                    placeholder={t("parametres.niuDetail")}
                    maxLength={50}
                    className={champClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>RCCM</label>
                  <input
                    value={formulaire.rccm}
                    onChange={(e) => modifierChamp("rccm", e.target.value)}
                    placeholder={t("parametres.rccmDetail")}
                    maxLength={50}
                    className={champClass}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => enregistrer(["nom", "ville", "telephone", "adresse", "niu", "rccm"])}
                  disabled={enregistrementEnCours}
                  className={boutonClass}
                >
                  {enregistrementEnCours ? t("facture.enregistrementCourt") : t("commun.enregistrer")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Onglet Reçu ---------- */}
      {onglet === "recu" && formulaire && (
        <div className="px-4 pb-10">
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-ink">{t("parametres.texteBasRecu")}</h2>
              <textarea
                value={formulaire.piedDePageRecu}
                onChange={(e) => modifierChamp("piedDePageRecu", e.target.value)}
                maxLength={LONGUEUR_MAX_PIED_DE_PAGE}
                rows={4}
                placeholder={t("parametres.texteBasExemple")}
                className={champClass}
              />
              <p className="mt-1 text-right text-xs text-ink-soft">
                {formulaire.piedDePageRecu.length} / {LONGUEUR_MAX_PIED_DE_PAGE}
              </p>
              <p className="mt-3 text-xs text-ink-soft">
                {t("parametres.recuAide")}
              </p>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => enregistrer(["piedDePageRecu"])}
                  disabled={enregistrementEnCours}
                  className={boutonClass}
                >
                  {enregistrementEnCours ? t("facture.enregistrementCourt") : t("commun.enregistrer")}
                </button>
              </div>
            </div>

            {/* Aperçu simplifié de l'en-tête et du bas du reçu */}
            <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-ink">{t("parametres.apercu")}</h2>
              <div className="mx-auto w-full max-w-[240px] rounded-lg border border-ink/15 bg-white p-4 text-center font-mono text-[11px] leading-relaxed text-ink">
                {formulaire.logoUrl && (
                  <img
                    src={formulaire.logoUrl}
                    alt="Logo"
                    className="mx-auto mb-2 h-12 w-auto object-contain"
                  />
                )}
                <p className="font-bold">{formulaire.nom}</p>
                {formulaire.niu && <p>NIU : {formulaire.niu}</p>}
                {formulaire.rccm && <p>RCCM : {formulaire.rccm}</p>}
                {formulaire.telephone && <p>Contact : {formulaire.telephone}</p>}
                {(formulaire.adresse || formulaire.ville) && (
                  <p>{[formulaire.adresse, formulaire.ville].filter(Boolean).join(", ")}</p>
                )}
                <p className="my-2">------------------------</p>
                <p className="font-bold">REÇU DE PAIEMENT</p>
                <p className="my-2">------------------------</p>
                <p className="text-ink-soft">{t("parametres.detailFacture")}</p>
                <p className="my-2">------------------------</p>
                <p className="whitespace-pre-line">
                  {formulaire.piedDePageRecu || (
                    <span className="text-ink-soft">{t("parametres.pasDeTexte")}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Onglet Services : l'actuelle page Tarifs ---------- */}
      {onglet === "services" && <TarifsPage />}

      {/* ---------- Onglet Paiements ---------- */}
      {onglet === "paiements" && formulaire && (
        <div className="px-4 pb-10">
          <div className="mx-auto max-w-3xl rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-ink">{t("parametres.modesAcceptes")}</h2>
            <p className="mb-5 text-sm text-ink-soft">{t("parametres.modesAide")}</p>

            <div className="space-y-3">
              {MODES_PAIEMENT.map((mode) => {
                const coche = formulaire.modesPaiement.includes(mode.cle);
                return (
                  <label
                    key={mode.cle}
                    className={
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition " +
                      (coche ? "border-accent bg-accent/5" : "border-ink/15 hover:bg-paper")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() => basculerModePaiement(mode.cle)}
                      className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{t(mode.label)}</span>
                      <span className="block text-xs text-ink-soft">{t(mode.description)}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => enregistrer(["modesPaiement"])}
                disabled={enregistrementEnCours}
                className={boutonClass}
              >
                {enregistrementEnCours ? t("facture.enregistrementCourt") : t("commun.enregistrer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}