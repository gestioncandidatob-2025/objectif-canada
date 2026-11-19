"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";

/**
 * Accueil de la personne qui a encaissé : les questions de l'administrateur
 * sur sa caisse, qui attendent sa réponse. Elle ne voit pas le statut choisi
 * par l'administrateur. Rien ne s'affiche s'il n'y a pas de question.
 */

type Message = {
  auteur: "admin" | "caissier";
  auteurNom: string;
  texte: string;
  date: string;
};

type Question = {
  id: string;
  jour: string;
  total: number;
  messages: Message[];
};

export default function QuestionsCaisse() {
  const { t, locale } = useLangue();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const charger = useCallback(async () => {
    const res = await apiFetch("/cash-checks/my-questions");
    if (res.ok) setQuestions(await res.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function repondre(q: Question) {
    const texte = (reponses[q.id] ?? "").trim();
    if (!texte) return;
    setEnCours(q.id);
    setErreur("");
    setSucces("");
    const res = await apiFetch(`/cash-checks/${q.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ texte }),
    });
    setEnCours(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message ?? t("verifCaisse.erreur"));
      return;
    }
    setQuestions((avant) => avant.filter((x) => x.id !== q.id));
    setSucces(t("verifCaisse.reponseEnvoyee"));
  }

  if (questions.length === 0 && !succes) return null;

  const jourLisible = (jour: string) =>
    new Date(`${jour}T12:00:00.000Z`).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  return (
    <section className="rounded-2xl border border-seal/40 bg-white px-4 py-1 sm:px-6">
      <div className="py-3">
        <h2 className="text-base font-semibold text-ink sm:text-[17px]">{t("verifCaisse.questionsTitre")}</h2>
        <p className="text-[13px] text-ink-soft">{t("verifCaisse.questionsAide")}</p>
      </div>

      {succes && <p className="mb-3 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">{succes}</p>}
      {erreur && <p className="mb-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{erreur}</p>}

      <ul>
        {questions.map((q) => (
          <li key={q.id} className="border-t border-ink/5 py-4">
            <p className="text-sm font-semibold text-ink">
              {t("verifCaisse.questionSur", {
                jour: jourLisible(q.jour),
                total: `${q.total.toLocaleString(locale)} F`,
              })}
            </p>

            <div className="mt-2 space-y-2">
              {q.messages.map((m, i) => (
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
            </div>

            <textarea
              value={reponses[q.id] ?? ""}
              onChange={(e) => setReponses((avant) => ({ ...avant, [q.id]: e.target.value }))}
              rows={3}
              maxLength={1000}
              placeholder={t("verifCaisse.placeholderReponse")}
              className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={() => repondre(q)}
              disabled={enCours === q.id || !(reponses[q.id] ?? "").trim()}
              className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {enCours === q.id ? t("verifCaisse.envoi") : t("verifCaisse.repondre")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}