"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [connexionEnCours, setConnexionEnCours] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setConnexionEnCours(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, motDePasse }),
      });

      if (!res.ok) {
        setErreur("Email ou mot de passe incorrect");
        setConnexionEnCours(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Si l'email n'est pas encore vérifié, on redirige vers la page de vérification
      if (!data.user.emailVerifie) {
        router.push(`/verifier-email?email=${encodeURIComponent(data.user.email)}`);
        return;
      }

      router.push("/bienvenue");
    } catch {
      setErreur("Impossible de contacter le serveur");
      setConnexionEnCours(false);
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
            className="mb-2 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />

          <div className="mb-6 text-right">
            <Link
              href={`/mot-de-passe-oublie${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className="text-sm text-seal hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
          type="submit"
          disabled={connexionEnCours}
          className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {connexionEnCours ? "Connexion en cours..." : "Se connecter"}
        </button>
        </form>
      </div>
    </div>
  );
}