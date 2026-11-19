"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";

/**
 * Accueil de l'administrateur : les journées de caisse pas encore confirmées.
 * Un clic sur « Je confirme » et la journée disparaît. L'administrateur peut
 * aussi demander une explication à la personne qui a encaissé.
 * Rien ne s'affiche quand tout est confirmé.
 */

type Statut = "en_attente" | "a_verifier" | "signalee" | "confirmee";
type Action = "confirmer" | "verifier" | "signaler";

type Message = {
  auteur: "admin" | "caissier";
  auteurNom: string;
  texte: string;
  date: string;
};

type Verification = {
  id: string;
  jour: string;
  personne: string;
  total: number;
  statut: Statut;
  totalActuel: number;
  modifie: boolean;
  messages: Message[];
  reponseAttendue: boolean;
};

const ACTION_DU_STATUT: Record<Statut, Action | null> = {
  confirmee: "confirmer",
  a_verifier: "verifier",
  signalee: "signaler",
  en_attente: null,
};

const PASTILLE: Record<Statut, string> = {
  en_attente: "bg-ink/5 text-ink-soft",
  a_verifier: "bg-seal/15 text-ink",
  signalee: "bg-error/10 text-error",
  confirmee: "bg-accent/10 text-accent",
};

const BOUTON: Record<Action, string> = {
  confirmer: "bg-accent text-white hover:bg-accent-hover",
  verifier: "border border-seal/40 text-ink hover:bg-seal/10",
  signaler: "border border-error/30 text-error hover:bg-error/5",
};

// Au-delà, on replie la liste (« Voir les 4 autres »)
const NOMBRE_VISIBLE = 4;

export default function CaissesAVerifier() {
  const { t, locale } = useLangue();
  const [liste, setListe] = useState<Verification[]>([]);
  const [toutVoir, setToutVoir] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  // Journée dont on écrit la question, et le texte de la question
  const [questionPour, setQuestionPour] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const charger = useCallback(async () => {
    const res = await apiFetch("/cash-checks");
    if (res.ok) setListe(await res.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function messageErreur(res: Response) {
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.message) ? data.message.join(", ") : data.message ?? t("verifCaisse.erreur");
  }

  async function choisir(v: Verification, action: Action) {
    setEnCours(v.id);
    setErreur("");
    const res = await apiFetch(`/cash-checks/${v.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    setEnCours(null);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    if (action === "confirmer") {
      setListe((avant) => avant.filter((x) => x.id !== v.id));
    } else {
      const statut: Statut = action === "verifier" ? "a_verifier" : "signalee";
      setListe((avant) => avant.map((x) => (x.id === v.id ? { ...x, statut } : x)));
    }
  }

  async function envoyerQuestion(v: Verification) {
    if (!question.trim()) return;
    setEnCours(v.id);
    setErreur("");
    const res = await apiFetch(`/cash-checks/${v.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ texte: question }),
    });
    setEnCours(null);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const data = await res.json();
    setListe((avant) =>
      avant.map((x) => (x.id === v.id ? { ...x, messages: data.messages, reponseAttendue: true } : x)),
    );
    setQuestionPour(null);
    setQuestion("");
  }

  if (liste.length === 0) return null;

  const montant = (valeur: number) => `${valeur.toLocaleString(locale)} F`;
  const jourLisible = (jour: string) =>
    new Date(`${jour}T12:00:00.000Z`).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const affichees = toutVoir ? liste : liste.slice(0, NOMBRE_VISIBLE);

  return (
    <section className="rounded-2xl border border-ink/10 bg-white px-4 py-1 sm:px-6">
      <div className="py-3">
        <h2 className="text-base font-semibold text-ink sm:text-[17px]">
          {t("verifCaisse.titreAccueil")} ({liste.length})
        </h2>
        <p className="text-[13px] text-ink-soft">{t("verifCaisse.aideAccueil")}</p>
      </div>

      {erreur && <p className="mb-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{erreur}</p>}

      <ul>
        {affichees.map((v) => {
          const actionActuelle = ACTION_DU_STATUT[v.statut];
          return (
            <li key={v.id} className="border-t border-ink/5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {v.personne} : {montant(v.total)}
                  </p>
                  <p className="text-[13px] capitalize text-ink-soft">{jourLisible(v.jour)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${PASTILLE[v.statut]}`}>
                  {t(`verifCaisse.statut.${v.statut}`)}
                </span>
              </div>

              {v.modifie && (
                <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-sm font-medium text-error">
                  ⚠ {t("verifCaisse.modifiee", { avant: montant(v.total), apres: montant(v.totalActuel) })}
                </p>
              )}

              {/* Questions et réponses */}
              {v.messages.length > 0 && (
                <div className="mt-3 space-y-2">
                  {v.messages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        "rounded-lg px-3 py-2 text-sm " +
                        (m.auteur === "admin" ? "bg-paper text-ink" : "border border-accent/20 bg-accent/5 text-ink")
                      }
                    >
                      <p className="text-xs font-semibold text-ink-soft">{m.auteurNom}</p>
                      <p className="whitespace-pre-line">{m.texte}</p>
                    </div>
                  ))}
                  {v.reponseAttendue && (
                    <p className="text-xs italic text-ink-soft">
                      {t("verifCaisse.reponseAttendue", { nom: v.personne })}
                    </p>
                  )}
                </div>
              )}

              {/* Écrire une question */}
              {questionPour === v.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    autoFocus
                    placeholder={t("verifCaisse.placeholderQuestion", { nom: v.personne })}
                    className="w-full rounded-lg border border-ink/15 px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => envoyerQuestion(v)}
                      disabled={enCours === v.id || !question.trim()}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                    >
                      {enCours === v.id ? t("verifCaisse.envoi") : t("verifCaisse.envoyer")}
                    </button>
                    <button
                      onClick={() => {
                        setQuestionPour(null);
                        setQuestion("");
                      }}
                      className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper"
                    >
                      {t("verifCaisse.annuler")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["confirmer", "verifier", "signaler"] as Action[])
                    .filter((a) => a !== actionActuelle)
                    .map((a) => (
                      <button
                        key={a}
                        onClick={() => choisir(v, a)}
                        disabled={enCours === v.id}
                        className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-60 ${BOUTON[a]}`}
                      >
                        {t(`verifCaisse.${a}`)}
                      </button>
                    ))}
                  <button
                    onClick={() => {
                      setQuestionPour(v.id);
                      setQuestion("");
                    }}
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-accent hover:underline"
                  >
                    {t("verifCaisse.demanderExplication")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {liste.length > NOMBRE_VISIBLE && (
        <button
          onClick={() => setToutVoir((v) => !v)}
          className="w-full border-t border-ink/5 py-3 text-sm font-medium text-accent hover:underline"
        >
          {toutVoir ? t("verifCaisse.voirMoins") : t("verifCaisse.voirAutres", { n: liste.length - NOMBRE_VISIBLE })}
        </button>
      )}
    </section>
  );
}