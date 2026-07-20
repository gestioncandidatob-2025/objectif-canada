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
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg border p-6 shadow-md">
        <h1 className="mb-4 text-xl font-bold">Connexion</h1>

        {erreur && <p className="mb-3 text-sm text-red-600">{erreur}</p>}

        <label className="mb-1 block text-sm">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border px-3 py-2"
        />

        <label className="mb-1 block text-sm">Mot de passe</label>
        <input
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          className="mb-4 w-full rounded border px-3 py-2"
        />

        <button
          type="submit"
          className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700"
        >
          Se connecter
        </button>
      </form>
    </div>
  );
}