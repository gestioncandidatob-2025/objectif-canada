"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../lib/api";

export default function MotDePasseOubliePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnvoiEnCours(true);

    const res = await apiFetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setEnvoiEnCours(false);

    if (!res.ok) {
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      return;
    }

    setMessage(data.message);
    setTimeout(() => {
      router.push(`/reinitialiser-mot-de-passe?email=${encodeURIComponent(email)}`);
    }, 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">
            Objectif Canada
          </p>
          <h1
            className="mt-2 text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Mot de passe oublié
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Reçois un code de réinitialisation par email.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-ink/10 bg-white p-8 shadow-sm"
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

          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={champClass}
          />

          <button
            type="submit"
            disabled={envoiEnCours}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {envoiEnCours ? "Envoi..." : "Recevoir le code"}
          </button>

          <p className="text-center text-sm text-ink-soft">
            <Link href="/login" className="text-seal hover:underline">
              Retour à la connexion
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}