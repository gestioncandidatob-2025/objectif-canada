"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ChampMotDePasse from "../components/ChampMotDePasse";
import BoutonLangue from "../components/BoutonLangue";
import { useLangue } from "../lib/langue";

// Icône « maison » de l'Espace de gestion (nom neutre : on ne sait pas
// encore de quel centre il s'agit avant la connexion)
function IconeEspace({ taille }: { taille: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [connexionEnCours, setConnexionEnCours] = useState(false);
  const router = useRouter();
  const { t } = useLangue();

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
        setErreur(t("connexion.erreurIdentifiants"));
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
      setErreur(t("connexion.erreurServeur"));
      setConnexionEnCours(false);
    }
  }

  const champClass =
    "h-12 w-full rounded-xl border border-ink/20 bg-white px-3.5 text-base text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:flex-row">
      {/* ---------- Ordinateur : panneau de gauche ---------- */}
      <aside className="hidden flex-col justify-between gap-10 bg-accent p-14 text-white lg:flex lg:w-[42%] lg:max-w-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <IconeEspace taille={24} />
          </span>
          <span className="text-lg font-semibold">{t("app.titre")}</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            {t("connexion.accroche")}
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-white/90">
            {t("connexion.sousAccroche")}
          </p>
        </div>
        <p className="text-sm text-white/80">© {new Date().getFullYear()}</p>
      </aside>

      {/* ---------- Formulaire (téléphone et ordinateur) ---------- */}
      <main className="flex flex-1 flex-col px-5 py-8 sm:px-12">
        <div className="flex justify-end">
          <BoutonLangue />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-7">
            {/* En-tête : sur téléphone seulement (sur ordinateur, il est à gauche) */}
            <div className="flex flex-col items-center gap-3.5 text-center lg:hidden">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
                <IconeEspace taille={28} />
              </span>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                {t("app.titre")}
              </p>
            </div>

            <div className="text-center lg:text-left">
              <h1 className="text-[28px] font-bold tracking-tight text-ink lg:text-3xl">
                {t("connexion.titre")}
              </h1>
              <p className="mt-2 hidden text-[15px] text-ink-soft lg:block">
                {t("connexion.consigne")}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
            >
              {erreur && (
                <p className="rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{erreur}</p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-ink-soft">
                  {t("connexion.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("connexion.exempleEmail")}
                  className={champClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="mot-de-passe" className="text-sm font-medium text-ink-soft">
                    {t("connexion.motDePasse")}
                  </label>
                  <Link
                    href={`/mot-de-passe-oublie${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                    className="py-1 text-sm font-medium text-accent hover:underline"
                  >
                    {t("connexion.motDePasseOublie")}
                  </Link>
                </div>
                <ChampMotDePasse
                  id="mot-de-passe"
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className={champClass}
                />
              </div>

              <button
                type="submit"
                disabled={connexionEnCours}
                className="mt-1 h-[52px] w-full rounded-xl bg-accent text-base font-semibold text-white transition active:scale-[0.98] hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connexionEnCours ? t("connexion.connexionEnCours") : t("connexion.seConnecter")}
              </button>
            </form>

            <p className="text-center text-[15px] text-ink-soft lg:text-left">
              {t("connexion.nouveauCentre")}{" "}
              <Link href="/inscrire-centre" className="font-semibold text-accent hover:underline">
                {t("connexion.inscrireMonCentre")}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}