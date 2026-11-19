"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Statut = {
  configure: boolean;
  limite: number;
  restantes: number;
};

// Nombre de messages envoyés au serveur à chaque question (les plus récents)
const MESSAGES_ENVOYES = 10;

/** Le modèle écrit parfois en gras (**texte**) : on retire ces étoiles */
function nettoyer(texte: string) {
  return texte.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");
}

/** Étincelles : le symbole habituel de l'intelligence artificielle */
function IconeEtincelle({ taille = 20 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 3l1.6 4.7L16 9.5l-4.4 1.8L10 16l-1.6-4.7L4 9.5l4.4-1.8z" />
      <path d="M18 13l.9 2.4 2.1.9-2.1.9L18 19.6l-.9-2.4-2.1-.9 2.1-.9z" opacity=".75" />
    </svg>
  );
}

function IconeFermer() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * Assistant IA (administrateur seulement) : un bouton rond en bas à droite
 * de chaque page. Un clic ouvre une fenêtre de discussion ; la discussion
 * est gardée quand on la ferme ou qu'on change de page.
 */
export default function AssistantFlottant() {
  const { t, langue } = useLangue();

  const [ouvert, setOuvert] = useState(false);
  const [statut, setStatut] = useState<Statut | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const finRef = useRef<HTMLDivElement | null>(null);
  const champRef = useRef<HTMLTextAreaElement | null>(null);

  // À l'ouverture : état de l'assistant, et curseur dans la zone de texte
  useEffect(() => {
    if (!ouvert) return;
    champRef.current?.focus();
    async function chargerStatut() {
      try {
        const res = await apiFetch("/assistant/status");
        if (res.ok) setStatut(await res.json());
      } catch {
        // serveur injoignable : l'erreur s'affichera à la première question
      }
    }
    chargerStatut();
  }, [ouvert]);

  // Touche Échap : ferme la fenêtre
  useEffect(() => {
    if (!ouvert) return;
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  // On descend en bas de la discussion à chaque nouveau message
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, enCours, ouvert]);

  async function envoyer(texte: string) {
    const contenu = texte.trim();
    if (!contenu || enCours) return;

    const discussion: Message[] = [...messages, { role: "user", content: contenu }];
    setMessages(discussion);
    setQuestion("");
    setErreur("");
    setEnCours(true);

    try {
      const res = await apiFetch("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ messages: discussion.slice(-MESSAGES_ENVOYES), langue }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = typeof data.message === "string" ? data.message : "";
        if (res.status === 503) setErreur(t("assistant.nonConfigure"));
        else if (res.status === 429) {
          setErreur(message.includes("Limite") ? t("assistant.limiteAtteinte") : t("assistant.tropDemande"));
        } else setErreur(message || t("assistant.erreur"));
        // Pas de réponse : on remet la question dans la zone de texte
        setMessages(messages);
        setQuestion(contenu);
        return;
      }

      const data: { reponse: string } = await res.json();
      setMessages([
        ...discussion,
        { role: "assistant", content: nettoyer(data.reponse) || t("assistant.reponseVide") },
      ]);
      setStatut((s) => (s ? { ...s, restantes: Math.max(0, s.restantes - 1) } : s));
    } catch {
      setErreur(t("assistant.erreur"));
      setMessages(messages);
      setQuestion(contenu);
    } finally {
      setEnCours(false);
    }
  }

  const exemples = [
    t("assistant.exemple1"),
    t("assistant.exemple2"),
    t("assistant.exemple3"),
    t("assistant.exemple4"),
  ];
  const nonConfigure = statut !== null && !statut.configure;

  return (
    <>
      {/* Le bouton « Assistant IA » (au-dessus de la barre du bas sur téléphone) */}
      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={t("assistant.ouvrir")}
          title={t("assistant.ouvrir")}
          className="fixed bottom-24 right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-sm font-semibold text-white shadow-lg shadow-ink/30 transition hover:-translate-y-0.5 hover:shadow-xl lg:bottom-6 lg:right-6 lg:h-14 lg:text-[15px]"
        >
          <IconeEtincelle />
          {t("assistant.bouton")}
        </button>
      )}

      {/* La fenêtre de discussion : plein écran sur téléphone, petite fenêtre sur ordinateur */}
      {ouvert && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={t("assistant.titre")}
          className="fixed inset-0 z-50 flex flex-col bg-paper lg:inset-auto lg:bottom-6 lg:right-6 lg:h-[600px] lg:max-h-[calc(100vh-48px)] lg:w-[400px] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-ink/10 lg:shadow-2xl"
        >
          {/* En-tête */}
          <div className="flex items-center gap-3 border-b border-ink/10 bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <IconeEtincelle taille={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-ink">{t("assistant.bouton")}</p>
              {statut?.configure && (
                <p className="text-xs text-ink-soft">
                  {t("assistant.questionsRestantes", { restantes: statut.restantes, limite: statut.limite })}
                </p>
              )}
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setErreur("");
                }}
                disabled={enCours}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-accent hover:bg-paper disabled:opacity-50"
              >
                {t("assistant.nouvelleDiscussion")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label={t("assistant.fermer")}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft hover:bg-paper"
            >
              <IconeFermer />
            </button>
          </div>

          {/* La discussion */}
          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="flex flex-col gap-3">
              {nonConfigure && (
                <p className="rounded-xl bg-seal/10 px-4 py-3 text-sm text-ink">{t("assistant.nonConfigure")}</p>
              )}

              {messages.length === 0 && !nonConfigure && (
                <div>
                  <p className="text-sm text-ink">{t("assistant.consigne")}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    {t("assistant.exemplesTitre")}
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {exemples.map((exemple) => (
                      <button
                        key={exemple}
                        type="button"
                        onClick={() => envoyer(exemple)}
                        disabled={enCours}
                        className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-left text-sm text-ink transition hover:border-accent hover:text-accent"
                      >
                        {exemple}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-ink-soft">{t("assistant.lectureSeule")}</p>
                </div>
              )}

              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div key={index} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-white">
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div key={index} className="flex justify-start">
                    <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-ink/10 bg-white px-3.5 py-2.5 text-sm text-ink">
                      {message.content}
                    </p>
                  </div>
                ),
              )}

              {enCours && (
                <div className="flex justify-start">
                  <p className="rounded-2xl rounded-bl-md border border-ink/10 bg-white px-3.5 py-2.5 text-sm text-ink-soft">
                    {t("assistant.reflechit")}
                  </p>
                </div>
              )}

              {erreur && <p className="rounded-xl bg-error/10 px-3.5 py-2.5 text-sm text-error">{erreur}</p>}
              <div ref={finRef} />
            </div>
          </div>

          {/* Zone de saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              envoyer(question);
            }}
            className="flex items-end gap-2 border-t border-ink/10 bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            <label htmlFor="question-assistant" className="sr-only">
              {t("assistant.placeholder")}
            </label>
            <textarea
              id="question-assistant"
              ref={champRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                // Entrée envoie la question ; Maj + Entrée passe à la ligne
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  envoyer(question);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={t("assistant.placeholder")}
              disabled={nonConfigure}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink-soft/70 focus:border-accent focus:ring-2 focus:ring-accent/20 lg:text-sm"
            />
            <button
              type="submit"
              disabled={enCours || !question.trim() || nonConfigure}
              className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {t("assistant.envoyer")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}