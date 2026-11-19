"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { useLangue } from "../../../lib/langue";
import ChampTelephone, { chiffresSansIndicatif } from "../../../components/ChampTelephone";

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

// Modes possibles pour encaisser un reste (un seul mode à la fois, pas de mixte)
const MODES_RESTE = ["especes", "orange_money", "mobile_money"];

const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

export default function DossierCandidatPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLangue();

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

  // Encaisser le reste d'une facture depuis la fiche
  const [modesAcceptes, setModesAcceptes] = useState<string[]>(MODES_RESTE);
  const [aEncaisser, setAEncaisser] = useState<Inscription | null>(null);
  const [montantRecu, setMontantRecu] = useState("");
  // Vide au départ : la personne doit choisir le mode (on n'oublie plus Mobile Money)
  const [modeRecu, setModeRecu] = useState("");
  const [encaissementEnCours, setEncaissementEnCours] = useState(false);
  const [erreurEncaissement, setErreurEncaissement] = useState("");
  // Dernier encaissement fait ici : message + lien vers le reçu
  const [dernierEncaissement, setDernierEncaissement] = useState<{
    id: string;
    montant: number;
    reste: number;
  } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setRole(JSON.parse(userStr).role);
    }
  }, []);

  // Modes de paiement acceptés par le centre (Paramètres → Paiements)
  useEffect(() => {
    async function chargerModes() {
      const res = await apiFetch("/center/settings");
      if (!res.ok) return;
      const data = await res.json();
      const modes = Array.isArray(data.modesPaiement)
        ? MODES_RESTE.filter((m) => data.modesPaiement.includes(m))
        : [];
      if (modes.length > 0) setModesAcceptes(modes);
    }
    chargerModes();
  }, []);

  async function charger() {
    const [rCandidat, rInscriptions] = await Promise.all([
      apiFetch(`/candidates/${id}`),
      apiFetch(`/registrations?candidatId=${id}`),
    ]);

    if (!rCandidat.ok || !rInscriptions.ok) {
      setErreur(t("dossier.erreurChargement"));
      setChargement(false);
      return;
    }

    const c = await rCandidat.json();
    setCandidat(c);
    setEditNom(c.nom);
    setEditPrenom(c.prenom);
    setEditTelephone(chiffresSansIndicatif(c.telephone));
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
      setErreur(t("candidats.erreurRaison"));
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

    setMessage(t("dossier.misAJour"));
    setModeEdition(false);
    setEditRaison("");
    setEnvoiEnCours(false);
    charger();
  }

  function ouvrirEncaissement(insc: Inscription) {
    setAEncaisser(insc);
    setMontantRecu(String(insc.resteAPayer));
    setModeRecu("");
    setErreurEncaissement("");
  }

  async function encaisser() {
    if (!aEncaisser) return;
    setErreurEncaissement("");

    const montant = Number(montantRecu.replace(/\D/g, ""));
    if (!montant || montant <= 0) {
      setErreurEncaissement(t("facture.erreurMontantPositif"));
      return;
    }
    if (montant > aEncaisser.resteAPayer) {
      setErreurEncaissement(t("facture.erreurMontantDepasse"));
      return;
    }
    if (!modeRecu) {
      setErreurEncaissement(t("facture.erreurModePaiement"));
      return;
    }

    setEncaissementEnCours(true);
    try {
      const res = await apiFetch(`/registrations/${aEncaisser._id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ montant, modePaiement: modeRecu }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreurEncaissement(
          Array.isArray(data.message) ? data.message.join(", ") : data.message ?? t("dossier.erreurEncaissement"),
        );
        return;
      }
      setDernierEncaissement({
        id: aEncaisser._id,
        montant,
        reste: typeof data.resteAPayer === "number" ? data.resteAPayer : aEncaisser.resteAPayer - montant,
      });
      setAEncaisser(null);
      setMessage("");
      charger();
    } catch {
      setErreurEncaissement(t("dossier.erreurEncaissement"));
    } finally {
      setEncaissementEnCours(false);
    }
  }

  const libellesModes: Record<string, string> = {
    especes: t("paiement.especes"),
    orange_money: t("paiement.orangeMoney"),
    mobile_money: t("paiement.mobileMoney"),
  };

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
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1
                className="text-2xl text-ink"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {candidat.nom} {candidat.prenom}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {t("facture.telephone")} : {candidat.telephone}
              </p>
            </div>
            <button
              onClick={() => setModeEdition(!modeEdition)}
              className="whitespace-nowrap rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper"
            >
              {modeEdition ? t("commun.annuler") : t("candidats.modifier")}
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

          {dernierEncaissement && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
              <span>
                {t("dossier.paiementEnregistre", {
                  montant: dernierEncaissement.montant.toLocaleString(locale),
                  reste: dernierEncaissement.reste.toLocaleString(locale),
                })}
              </span>
              <a
                href={`/recu/${dernierEncaissement.id}`}
                target="_blank"
                className="font-semibold underline underline-offset-2"
              >
                {t("dossier.voirRecu")}
              </a>
            </div>
          )}

          {modeEdition && (
            <form
              onSubmit={enregistrerModificationCandidat}
              className="mt-4 space-y-3 rounded-xl border border-ink/10 bg-paper p-5"
            >
              <div>
                <label className={labelClass}>{t("facture.nom")}</label>
                <input
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className={`${champClass} bg-white`}
                />
              </div>
              <div>
                <label className={labelClass}>{t("facture.prenom")}</label>
                <input
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  className={`${champClass} bg-white`}
                />
              </div>
              <div>
                <label className={labelClass}>{t("facture.telephone")}</label>
                <ChampTelephone value={editTelephone} onChange={setEditTelephone} />
              </div>
              <div>
                <label className={labelClass}>
                  {t("dossier.raisonObligatoire")}
                </label>
                <input
                  value={editRaison}
                  onChange={(e) => setEditRaison(e.target.value)}
                  placeholder={t("dossier.raisonExemple")}
                  className={`${champClass} bg-white`}
                />
              </div>
              <button
                type="submit"
                disabled={envoiEnCours}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent-hover"
              >
                {envoiEnCours ? t("facture.enregistrementCourt") : t("commun.enregistrer")}
              </button>
            </form>
          )}

          <p className="mt-6 mb-3 text-sm font-semibold text-ink-soft">
            {t("dossier.nombreInscriptions", { n: inscriptions.length })}
          </p>

          {inscriptions.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("dossier.aucuneInscription")}</p>
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
                      {t("candidats.numero")} {insc.numeroRecu}
                    </a>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-ink-soft sm:grid-cols-2">
                    <p>{t("dossier.inscritLe")} : {insc.dateInscription?.slice(0, 10)}</p>
                    <p>{t("candidats.debutTest")} : {insc.dateDebutTest?.slice(0, 10) ?? "—"}</p>
                    <p>{t("facture.montantTotal")} : {insc.montantTotal.toLocaleString(locale)} FCFA</p>
                    <p>{t("facture.resteAPayer")} : {insc.resteAPayer.toLocaleString(locale)} FCFA</p>
                  </div>
                  {insc.resteAPayer > 0 && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => ouvrirEncaissement(insc)}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
                      >
                        {t("dossier.encaisserReste")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {role === "admin" && candidat.historique && candidat.historique.length > 0 && (
            <div className="mt-8 border-t border-ink/10 pt-5">
              <p className="mb-3 text-sm font-semibold text-ink-soft">
                {t("dossier.historique")}
              </p>
              <div className="space-y-2">
                {[...candidat.historique].reverse().map((h, i) => (
                  <div key={i} className="rounded-lg border border-ink/10 p-3 text-xs">
                    <p className="font-medium text-ink">{h.raison}</p>
                    <p className="mt-1 text-ink-soft">
                      {t("dossier.modifiePar", {
                        nom: h.modifiePar,
                        date: new Date(h.date).toLocaleString(locale),
                      })}
                    </p>
                    <p className="text-ink-soft">
                      {t("dossier.champsModifies")} : {h.champsModifies}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fenêtre « Encaisser le reste » */}
      {aEncaisser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t("dossier.encaisserReste")}>
          <button
            type="button"
            aria-label={t("commun.annuler")}
            onClick={() => !encaissementEnCours && setAEncaisser(null)}
            className="absolute inset-0 h-full w-full bg-ink/40"
          />
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-3xl">
            <h2 className="text-xl font-semibold text-ink">
              {t("dossier.encaisserTitre", { recu: aEncaisser.numeroRecu })}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {LABEL_SERVICE[aEncaisser.service] ?? aEncaisser.service} · {candidat.nom} {candidat.prenom}
            </p>
            <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-base text-ink">
              {t("facture.resteAPayer")} :{" "}
              <strong>{aEncaisser.resteAPayer.toLocaleString(locale)} FCFA</strong>
            </p>

            <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t("facture.montantRecuAujourdhui")}
              <input
                inputMode="numeric"
                value={montantRecu}
                onChange={(e) => setMontantRecu(e.target.value.replace(/[^\d\s]/g, ""))}
                className="h-12 rounded-xl border border-ink/15 px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t("facture.modeComplement")}
              <select
                value={modeRecu}
                onChange={(e) => setModeRecu(e.target.value)}
                className="h-12 rounded-xl border border-ink/15 bg-white px-3 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="" disabled>
                  {t("facture.choisirMode")}
                </option>
                {modesAcceptes.map((mode) => (
                  <option key={mode} value={mode}>
                    {libellesModes[mode] ?? mode}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs text-ink-soft">{t("dossier.compteDansMaCaisse")}</p>

            {erreurEncaissement && (
              <p className="mt-4 rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{erreurEncaissement}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setAEncaisser(null)}
                disabled={encaissementEnCours}
                className="h-12 flex-1 rounded-xl border border-ink/15 bg-white text-sm font-semibold text-ink hover:bg-paper disabled:opacity-50"
              >
                {t("commun.annuler")}
              </button>
              <button
                type="button"
                onClick={encaisser}
                disabled={encaissementEnCours || !montantRecu.trim()}
                className="h-12 flex-1 rounded-xl bg-accent text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {encaissementEnCours ? t("dossier.encaissementEnCours") : t("dossier.encaisser")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}