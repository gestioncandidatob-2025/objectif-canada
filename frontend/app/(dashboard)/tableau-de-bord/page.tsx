"use client";

import { useEffect, useState, ReactNode } from "react";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

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
type StatsAnnuelles = Record<string, { inscriptions: number; montant: number }>;

type SousGraphique = "mensuel" | "hebdomadaire" | "annuel" | null;

function debutSemaineCourante() {
  const d = new Date();
  const jour = d.getDay();
  const decalage = jour === 0 ? 6 : jour - 1;
  d.setDate(d.getDate() - decalage);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Numéro de la semaine dans le mois ("1" à "5") ; le texte « Semaine 1 » /
// « Week 1 » est ajouté à l'affichage, dans la langue choisie
function semaineDuMois(dateStr: string) {
  const jourDuMois = Number(dateStr.slice(8, 10));
  return String(Math.ceil(jourDuMois / 7));
}

// "03" → "mars" ou "Mar", selon la langue
function nomCourtDuMois(numeroMois: string, locale: string) {
  const mois = Number(numeroMois);
  if (!mois) return numeroMois;
  return new Date(2000, mois - 1, 1).toLocaleDateString(locale, { month: "short" });
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
  const [jour, setJour] = useState<StatsJour | null>(null);
  const [semaine, setSemaine] = useState<StatsSemaine | null>(null);
  const [mois, setMois] = useState<StatsMois | null>(null);
  const [graphique, setGraphique] = useState<StatsJournalieres>({});
  const [annuel, setAnnuel] = useState<StatsAnnuelles>({});
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const [graphiqueOuvert, setGraphiqueOuvert] = useState(false);
  const [sousGraphique, setSousGraphique] = useState<SousGraphique>(null);
  const { t, locale } = useLangue();

  useEffect(() => {
    async function charger() {
      setChargement(true);
      setErreur("");
      const [rJour, rSemaine, rMois, rGraph, rAnnuel] = await Promise.all([
        apiFetch("/stats/daily"),
        apiFetch("/stats/weekly"),
        apiFetch("/stats/monthly"),
        apiFetch("/stats/charts"),
        apiFetch("/stats/annual"),
      ]);

      if (!rJour.ok || !rSemaine.ok || !rMois.ok || !rGraph.ok || !rAnnuel.ok) {
        setErreur(t("tableau.erreurChargement"));
        setChargement(false);
        return;
      }

      setJour(await rJour.json());
      setSemaine(await rSemaine.json());
      setMois(await rMois.json());
      setGraphique(await rGraph.json());
      setAnnuel(await rAnnuel.json());
      setChargement(false);
    }

    charger();
  }, []);

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

  const donneesAnnuelles = Object.entries(annuel).sort(([a], [b]) => a.localeCompare(b));

  const donneesGraphActif =
    sousGraphique === "hebdomadaire"
      ? donneesHebdomadaires
      : sousGraphique === "annuel"
        ? donneesAnnuelles
        : donneesMensuellesParSemaine;
  const maxInscriptions = Math.max(1, ...donneesGraphActif.map((entree) => entree[1].inscriptions));
  const totalEncaisseGraphique = donneesGraphActif.reduce(
    (somme, entree) => somme + entree[1].montant,
    0,
  );

  function sousBoutonClass(actif: boolean) {
    return (
      "rounded-xl px-6 py-3 text-base font-semibold transition " +
      (actif ? "bg-accent text-white" : "border-2 border-ink/15 text-ink hover:bg-white")
    );
  }

  return (
    <div className="px-4 py-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h1
          className="mb-6 text-3xl text-ink sm:mb-10 sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("menu.tableauDeBord")}
        </h1>

        {erreur && (
          <p className="mb-6 rounded-xl bg-error/10 px-4 py-3 text-base text-error">
            {erreur}
          </p>
        )}
        {chargement && <p className="mb-6 text-base text-ink-soft">{t("commun.chargement")}</p>}

        {/* Section Aujourd'hui */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3 text-ink">
            {ICONES.jour}
            <h2 className="text-xl font-semibold">{t("tableau.aujourdhui")}</h2>
          </div>
          {jour && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-base text-ink-soft">{t("tableau.inscriptionsAujourdhui")}</p>
                <p className="mt-3 text-5xl font-semibold text-ink">
                  {jour.nombreInscriptionsJour}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-base text-ink-soft">{t("tableau.encaisseAujourdhui")}</p>
                <p className="mt-3 text-4xl font-semibold text-accent">
                  {jour.montantEncaisseJour.toLocaleString(locale)}{" "}
                  <span className="text-xl">FCFA</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section Cette semaine */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3 text-ink">
            {ICONES.semaine}
            <h2 className="text-xl font-semibold">{t("tableau.cetteSemaine")}</h2>
          </div>
          {semaine && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-base text-ink-soft">{t("tableau.inscriptionsSemaine")}</p>
                <p className="mt-3 text-5xl font-semibold text-ink">
                  {semaine.nombreInscriptionsSemaine}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-base text-ink-soft">{t("tableau.encaisseSemaine")}</p>
                <p className="mt-3 text-4xl font-semibold text-accent">
                  {semaine.montantEncaisseSemaine.toLocaleString(locale)}{" "}
                  <span className="text-xl">FCFA</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section Ce mois */}
        <div className="mb-10">
          <div className="mb-4 flex items-center gap-3 text-ink">
            {ICONES.mois}
            <h2 className="text-xl font-semibold">{t("tableau.ceMois")}</h2>
          </div>
          {mois && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-base text-ink-soft">{t("tableau.inscriptionsMois")}</p>
                <p className="mt-3 text-5xl font-semibold text-ink">
                  {mois.nombreInscriptionsMois}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                <p className="text-base text-ink-soft">{t("tableau.encaisseMois")}</p>
                <p className="mt-3 text-4xl font-semibold text-accent">
                  {mois.montantEncaisseMois.toLocaleString(locale)}{" "}
                  <span className="text-xl">FCFA</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section Graphique — reste cliquable comme avant */}
        <div>
          <button
            onClick={() => {
              setGraphiqueOuvert(!graphiqueOuvert);
              setSousGraphique(null);
            }}
            className="mb-4 flex items-center gap-3 text-ink"
          >
            {ICONES.graphique}
            <h2 className="text-xl font-semibold">{t("tableau.graphique")}</h2>
          </button>

          {graphiqueOuvert && (
            <div>
              <div className="mb-5 flex flex-wrap gap-3">
                <button
                  onClick={() => setSousGraphique("mensuel")}
                  className={sousBoutonClass(sousGraphique === "mensuel")}
                >
                  {t("tableau.graphiqueMensuel")}
                </button>
                <button
                  onClick={() => setSousGraphique("hebdomadaire")}
                  className={sousBoutonClass(sousGraphique === "hebdomadaire")}
                >
                  {t("tableau.graphiqueHebdo")}
                </button>
                <button
                  onClick={() => setSousGraphique("annuel")}
                  className={sousBoutonClass(sousGraphique === "annuel")}
                >
                  {t("tableau.graphiqueAnnuel")}
                </button>
              </div>

              {sousGraphique && (
                <div className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-8">
                  <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-ink">
                      {sousGraphique === "mensuel"
                        ? t("tableau.parSemaine")
                        : sousGraphique === "annuel"
                          ? t("tableau.parMois")
                          : t("tableau.parJour")}
                    </p>
                    <p className="rounded-full bg-seal/10 px-4 py-2 text-base font-semibold text-seal">
                      {t("tableau.total", { montant: totalEncaisseGraphique.toLocaleString(locale) })}
                    </p>
                  </div>

                  {donneesGraphActif.length === 0 ? (
                    <p className="text-base text-ink-soft">{t("tableau.aucuneDonnee")}</p>
                  ) : (
                                        <div className="flex items-end gap-3">
                      {donneesGraphActif.map((entree) => {
                        const label = entree[0];
                        const valeurs = entree[1];
                        const HAUTEUR_PISTE_PX = 180;
                        const hauteurBarrePx =
                          valeurs.inscriptions > 0
                            ? Math.max(
                                Math.round((valeurs.inscriptions / maxInscriptions) * HAUTEUR_PISTE_PX),
                                6,
                              )
                            : 0;
                        const labelAffiche =
                          sousGraphique === "mensuel"
                            ? t("tableau.semaineN", { n: label })
                            : sousGraphique === "annuel"
                              ? nomCourtDuMois(label, locale)
                              : label.slice(8, 10) + "/" + label.slice(5, 7);

                        return (
                          <div key={label} className="flex flex-1 flex-col items-center gap-2">
                            <span className="text-sm font-semibold text-ink">
                              {valeurs.inscriptions}
                            </span>
                            <div
                              className="flex w-full items-end"
                              style={{ height: HAUTEUR_PISTE_PX }}
                            >
                              <div
                                className="w-full rounded-t-lg bg-accent transition-[height]"
                                style={{ height: hauteurBarrePx }}
                              />
                            </div>
                            <span className="text-sm text-ink-soft">{labelAffiche}</span>
                            <span className="text-sm font-semibold text-seal">
                              {valeurs.montant.toLocaleString(locale)} F
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
        </div>
      </div>
    </div>
  );
}