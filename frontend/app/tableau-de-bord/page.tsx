"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

type StatsJour = {
  nombreCandidatsTotal: number;
  nombreInscriptionsJour: number;
  montantEncaisseJour: number;
};

type StatsSemaine = {
  nombreInscriptionsSemaine: number;
  montantEncaisseSemaine: number;
};

type StatsMois = {
  nombreInscriptionsMois: number;
  montantEncaisseMois: number;
};

type StatsJournalieres = Record<string, { inscriptions: number; montant: number }>;

type Onglet = "jour" | "semaine" | "mois" | "graphique" | null;
type SousGraphique = "mensuel" | "hebdomadaire" | null;

function debutSemaineCourante() {
  const d = new Date();
  const jour = d.getDay();
  const decalage = jour === 0 ? 6 : jour - 1;
  d.setDate(d.getDate() - decalage);
  d.setHours(0, 0, 0, 0);
  return d;
}

function semaineDuMois(dateStr: string) {
  const jourDuMois = Number(dateStr.slice(8, 10));
  const numeroSemaine = Math.ceil(jourDuMois / 7);
  return `Semaine ${numeroSemaine}`;
}

const ICONES: Record<string, ReactNode> = {
      jour: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  semaine: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  mois: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 9.5h17M8 3v3M16 3v3M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  graphique: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M5 19V9M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M3.5 19.5h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

export default function TableauDeBordPage() {
  const [pret, setPret] = useState(false);
  const [accesRefuse, setAccesRefuse] = useState(false);
  const router = useRouter();

  const [jour, setJour] = useState<StatsJour | null>(null);
  const [semaine, setSemaine] = useState<StatsSemaine | null>(null);
  const [mois, setMois] = useState<StatsMois | null>(null);
  const [graphique, setGraphique] = useState<StatsJournalieres>({});
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const [onglet, setOnglet] = useState<Onglet>(null);
  const [sousGraphique, setSousGraphique] = useState<SousGraphique>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.push("/login");
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== "admin") {
      setAccesRefuse(true);
      setPret(true);
      return;
    }
    setPret(true);
  }, [router]);

  useEffect(() => {
    if (!pret || accesRefuse) return;

    async function charger() {
      setChargement(true);
      setErreur("");
      const [rJour, rSemaine, rMois, rGraph] = await Promise.all([
        apiFetch("/stats/daily"),
        apiFetch("/stats/weekly"),
        apiFetch("/stats/monthly"),
        apiFetch("/stats/charts"),
      ]);

      if (!rJour.ok || !rSemaine.ok || !rMois.ok || !rGraph.ok) {
        setErreur("Impossible de charger les statistiques");
        setChargement(false);
        return;
      }

      setJour(await rJour.json());
      setSemaine(await rSemaine.json());
      setMois(await rMois.json());
      setGraphique(await rGraph.json());
      setChargement(false);
    }

    charger();
  }, [pret, accesRefuse]);

  if (!pret) {
    return null;
  }

  if (accesRefuse) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="max-w-sm rounded-2xl border border-ink/10 bg-white p-10 text-center shadow-sm">
          <p className="text-lg text-ink-soft">
            Le tableau de bord est réservé à l'administrateur.
          </p>
          <a
            href="/bienvenue"
            className="mt-6 inline-block text-lg font-semibold text-accent hover:underline"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    );
  }

  const toutesLesDates = Object.entries(graphique).sort(([a], [b]) => a.localeCompare(b));

  const parSemaine: Record<string, { inscriptions: number; montant: number }> = {};
  for (const entree of toutesLesDates) {
    const date = entree[0];
    const valeurs = entree[1];
    const label = semaineDuMois(date);
    if (!parSemaine[label]) {
      parSemaine[label] = { inscriptions: 0, montant: 0 };
    }
    parSemaine[label].inscriptions += valeurs.inscriptions;
    parSemaine[label].montant += valeurs.montant;
  }
  const donneesMensuellesParSemaine = Object.entries(parSemaine).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const debutSemaine = debutSemaineCourante();
  const donneesHebdomadaires = toutesLesDates.filter(
    (entree) => new Date(entree[0]) >= debutSemaine,
  );

  const donneesGraphActif =
    sousGraphique === "hebdomadaire" ? donneesHebdomadaires : donneesMensuellesParSemaine;
  const maxInscriptions = Math.max(1, ...donneesGraphActif.map((entree) => entree[1].inscriptions));
  const totalEncaisseGraphique = donneesGraphActif.reduce(
    (somme, entree) => somme + entree[1].montant,
    0,
  );

  function boutonPrincipalClass(actif: boolean) {
    return (
      "flex flex-1 min-w-[160px] flex-col items-center gap-2 rounded-2xl border-2 px-6 py-6 text-base font-semibold transition " +
      (actif
        ? "border-accent bg-accent text-white shadow-md"
        : "border-ink/10 bg-white text-ink hover:border-accent/40 hover:bg-accent/5")
    );
  }

  function sousBoutonClass(actif: boolean) {
    return (
      "rounded-xl px-6 py-3 text-base font-semibold transition " +
      (actif ? "bg-accent text-white" : "border-2 border-ink/15 text-ink hover:bg-white")
    );
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          ← Retour
        </button>
        <a href="/bienvenue">
          <img
            src="/logo.jpeg"
            alt="Logo"
            className="mx-auto h-20 w-auto object-contain"
          />
        </a>
        <h1
          className="mb-10 mt-2 text-4xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Tableau de bord
        </h1>

        {erreur && (
          <p className="mb-6 rounded-xl bg-error/10 px-4 py-3 text-base text-error">
            {erreur}
          </p>
        )}
        {chargement && <p className="mb-6 text-base text-ink-soft">Chargement...</p>}

        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => setOnglet(onglet === "jour" ? null : "jour")}
            className={boutonPrincipalClass(onglet === "jour")}
          >
            {ICONES.jour}
            Aujourd'hui
          </button>
          <button
            onClick={() => setOnglet(onglet === "semaine" ? null : "semaine")}
            className={boutonPrincipalClass(onglet === "semaine")}
          >
            {ICONES.semaine}
            Cette semaine
          </button>
          <button
            onClick={() => setOnglet(onglet === "mois" ? null : "mois")}
            className={boutonPrincipalClass(onglet === "mois")}
          >
            {ICONES.mois}
            Ce mois
          </button>
          <button
            onClick={() => {
              setOnglet(onglet === "graphique" ? null : "graphique");
              setSousGraphique(null);
            }}
            className={boutonPrincipalClass(onglet === "graphique")}
          >
            {ICONES.graphique}
            Graphique
          </button>
        </div>

        {onglet === "jour" && jour && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
              <p className="text-base text-ink-soft">Inscriptions aujourd'hui</p>
              <p className="mt-3 text-5xl font-semibold text-ink">
                {jour.nombreInscriptionsJour}
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
              <p className="text-base text-ink-soft">Montant encaissé aujourd'hui</p>
              <p className="mt-3 text-4xl font-semibold text-accent">
                {jour.montantEncaisseJour.toLocaleString("fr-FR")}{" "}
                <span className="text-xl">FCFA</span>
              </p>
            </div>
          </div>
        )}

        {onglet === "semaine" && semaine && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
              <p className="text-base text-ink-soft">Inscriptions cette semaine</p>
              <p className="mt-3 text-5xl font-semibold text-ink">
                {semaine.nombreInscriptionsSemaine}
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
              <p className="text-base text-ink-soft">Montant encaissé cette semaine</p>
              <p className="mt-3 text-4xl font-semibold text-accent">
                {semaine.montantEncaisseSemaine.toLocaleString("fr-FR")}{" "}
                <span className="text-xl">FCFA</span>
              </p>
            </div>
          </div>
        )}

        {onglet === "mois" && mois && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
              <p className="text-base text-ink-soft">Inscriptions ce mois</p>
              <p className="mt-3 text-5xl font-semibold text-ink">
                {mois.nombreInscriptionsMois}
              </p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
              <p className="text-base text-ink-soft">Montant encaissé ce mois</p>
              <p className="mt-3 text-4xl font-semibold text-accent">
                {mois.montantEncaisseMois.toLocaleString("fr-FR")}{" "}
                <span className="text-xl">FCFA</span>
              </p>
            </div>
          </div>
        )}

        {onglet === "graphique" && (
          <div>
            <div className="mb-5 flex flex-wrap gap-3">
              <button
                onClick={() => setSousGraphique("mensuel")}
                className={sousBoutonClass(sousGraphique === "mensuel")}
              >
                Graphique mensuel
              </button>
              <button
                onClick={() => setSousGraphique("hebdomadaire")}
                className={sousBoutonClass(sousGraphique === "hebdomadaire")}
              >
                Graphique hebdomadaire
              </button>
            </div>

            {sousGraphique && (
              <div className="rounded-2xl border border-ink/10 bg-white p-8 shadow-sm">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-ink">
                    {sousGraphique === "mensuel"
                      ? "Inscriptions par semaine — ce mois"
                      : "Inscriptions par jour — cette semaine"}
                  </p>
                  <p className="rounded-full bg-seal/10 px-4 py-2 text-base font-semibold text-seal">
                    Total : {totalEncaisseGraphique.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>

                {donneesGraphActif.length === 0 ? (
                  <p className="text-base text-ink-soft">Aucune donnée pour le moment.</p>
                ) : (
                  <div className="flex h-64 items-end gap-3">
                    {donneesGraphActif.map((entree) => {
                      const label = entree[0];
                      const valeurs = entree[1];
                      const hauteur = (valeurs.inscriptions / maxInscriptions) * 100;
                      const labelAffiche =
                        sousGraphique === "mensuel"
                          ? label
                          : label.slice(8, 10) + "/" + label.slice(5, 7);

                      return (
                        <div key={label} className="flex flex-1 flex-col items-center gap-2">
                          <span className="text-sm font-semibold text-ink">
                            {valeurs.inscriptions}
                          </span>
                          <div
                            className="w-full rounded-t-lg bg-accent"
                            style={{
                              height: hauteur + "%",
                              minHeight: valeurs.inscriptions > 0 ? "6px" : "0",
                            }}
                          />
                          <span className="text-sm text-ink-soft">{labelAffiche}</span>
                          <span className="text-sm font-semibold text-seal">
                            {valeurs.montant.toLocaleString("fr-FR")} F
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!onglet && (
          <p className="text-lg text-ink-soft">
            Choisis une période ci-dessus pour voir le détail.
          </p>
        )}
      </div>
    </div>
  );
}