"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, motDePasse }),
      });

      if (!res.ok) {
        setErreur("Email ou mot de passe incorrect");
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/bienvenue");
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
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
            Espace de gestion
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm"
        >
          {erreur && (
            <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
              {erreur}
            </p>
          )}

          <label className="mb-1 block text-sm font-medium text-ink-soft">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1 block text-sm font-medium text-ink-soft">
            Mot de passe
          </label>
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="mb-6 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />

          <button
          type="submit"
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover"
        >
          Se connecter
        </button>
        </form>
      </div>
    </div>
  );
}
