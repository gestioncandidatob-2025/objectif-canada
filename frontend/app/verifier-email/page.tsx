"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import { useLangue } from "../lib/langue";
import BoutonLangue from "../components/BoutonLangue";

function VerifierEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLangue();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnvoiEnCours(true);

    const res = await apiFetch("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();
    setEnvoiEnCours(false);

    if (!res.ok) {
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      return;
    }

    setMessage(t("verifierEmail.succes"));
    setTimeout(() => router.push("/bienvenue"), 1200);
  }

  async function renvoyerCode() {
    setErreur("");
    setMessage("");
    if (!email) {
      setErreur(t("verifierEmail.emailDabord"));
      return;
    }
    setRenvoiEnCours(true);
    const res = await apiFetch("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setRenvoiEnCours(false);

    if (!res.ok) {
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      return;
    }
    setMessage(t("verifierEmail.codeRenvoye"));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <BoutonLangue />
        </div>
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">
            {t("app.titre")}
          </p>
          <h1
            className="mt-2 text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("verifierEmail.titre")}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">{t("verifierEmail.consigne")}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8"
        >
          {message && (
            <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">
              {message}
            </p>
          )}
          {erreur && (
            <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              {erreur}
            </p>
          )}

          <label className={labelClass}>{t("connexion.email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={champClass}
          />

          <label className={labelClass}>{t("verifierEmail.code")}</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            className={champClass}
          />

          <button
            type="submit"
            disabled={envoiEnCours}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {envoiEnCours ? t("verifierEmail.enCours") : t("verifierEmail.verifier")}
          </button>

          <button
            type="button"
            onClick={renvoyerCode}
            disabled={renvoiEnCours}
            className="w-full rounded-lg border border-ink/15 py-2.5 font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            {renvoiEnCours ? t("motDePasseOublie.envoi") : t("verifierEmail.renvoyer")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VerifierEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifierEmailForm />
    </Suspense>
  );
}