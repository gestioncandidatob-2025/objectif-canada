"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ChampMotDePasse from "../components/ChampMotDePasse";

// Mêmes règles que le backend (8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial)
const REGEX_MOT_DE_PASSE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function InscrireCentrePage() {
  const router = useRouter();

  const [nomCentre, setNomCentre] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const champClass =
    "mb-4 w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");

    // Vérifications rapides avant d'appeler le serveur
    if (!nomCentre.trim() || !nom.trim() || !email.trim() || !telephone.trim()) {
      setErreur("Remplis tous les champs");
      return;
    }
    if (!REGEX_MOT_DE_PASSE.test(motDePasse)) {
      setErreur(
        "Le mot de passe doit contenir au moins 8 caractères, avec 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial",
      );
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques");
      return;
    }

    setEnvoiEnCours(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register-center`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomCentre, nom, email, telephone, motDePasse }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Le serveur renvoie soit un message, soit une liste de messages
        setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
        setEnvoiEnCours(false);
        return;
      }

      // Le centre est créé et la personne est connectée (même réponse que la connexion)
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Étape suivante : saisir le code reçu par email
      router.push(`/verifier-email?email=${encodeURIComponent(data.user.email)}`);
    } catch {
      setErreur("Impossible de contacter le serveur");
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">
            Nouveau centre
          </p>
          <h1
            className="mt-2 text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Inscrire mon centre
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Crée ton espace en une minute. Tu commences au plan Gratuit.
          </p>
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

          <label className={labelClass}>Nom du centre</label>
          <input
            value={nomCentre}
            onChange={(e) => setNomCentre(e.target.value)}
            placeholder="Ex : Centre Excellence Langues"
            className={champClass}
          />

          <label className={labelClass}>Ton nom</label>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Ex : Paul Mbarga"
            className={champClass}
          />

          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ex : paul@moncentre.cm"
            className={champClass}
          />

          <label className={labelClass}>Téléphone du centre</label>
          <input
            type="tel"
            inputMode="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder="Ex : +237 699 00 00 00"
            className={champClass}
          />

          <label className={labelClass}>Mot de passe</label>
          <ChampMotDePasse
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            wrapperClassName="mb-1"
            className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <p className="mb-4 text-xs text-ink-soft">
            8 caractères minimum, avec 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.
          </p>

          <label className={labelClass}>Confirmer le mot de passe</label>
          <ChampMotDePasse
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            wrapperClassName="mb-6"
            className="w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />

          <button
            type="submit"
            disabled={envoiEnCours}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.97] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {envoiEnCours ? "Création en cours..." : "Créer mon centre"}
          </button>

          <p className="mt-6 text-center text-sm text-ink-soft">
            Tu as déjà un compte ?{" "}
            <Link href="/login" className="text-seal hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}