"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";

// Une personne dont on peut voir la caisse (un onglet)
type Personne = {
  id: string;
  nom: string;
  role: string;
};

// Les totaux d'une période (le jour, la semaine ou le mois)
type Bloc = {
  total: number;
  especes: number;
  mobile: number;
  inscriptions: { nombre: number; montant: number };
  restes: { nombre: number; montant: number };
  corrections: number;
};

type Resume = {
  aujourdhui: Bloc;
  semaine: Bloc;
  mois: Bloc;
};

type LignePaiement = {
  id: string;
  date: string;
  numeroRecu?: string;
  candidatNom?: string;
  type: "inscription" | "reste" | "correction";
  modePaiement?: string;
  especes: number;
  mobile: number;
  montant: number;
};

/** La date du jour sur cet appareil, au format AAAA-MM-JJ */
function dateDuJour() {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/**
 * Point de caisse : ce que chaque personne a encaissé, séparé entre espèces
 * et paiement mobile. L'administrateur a un onglet par personne (lui
 * compris) ; la secrétaire ne voit que sa caisse. Les totaux de tout le
 * centre et les graphiques sont dans le tableau de bord.
 */
export default function PointDeCaissePage() {
  const { t, locale } = useLangue();

  const [estAdmin, setEstAdmin] = useState(false);
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [personneActive, setPersonneActive] = useState<string | null>(null);

  const [resume, setResume] = useState<Resume | null>(null);
  const [detail, setDetail] = useState<LignePaiement[]>([]);

  // Jour affiché : aujourd'hui par défaut, ou un jour passé choisi
  const aujourdhui = dateDuJour();
  const [dateChoisie, setDateChoisie] = useState(aujourdhui);
  const estAujourdhui = dateChoisie === aujourdhui;

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  // 1. Qui est connecté, et quelles caisses il peut voir
  useEffect(() => {
    try {
      const utilisateur = JSON.parse(localStorage.getItem("user") ?? "{}");
      setEstAdmin(utilisateur.role === "admin");
    } catch {
      setEstAdmin(false);
    }

    async function chargerPersonnes() {
      const res = await apiFetch("/cash-register/staff");
      if (!res.ok) {
        setErreur(t("caisse.erreurChargement"));
        setChargement(false);
        return;
      }
      const liste: Personne[] = await res.json();
      setPersonnes(liste);
      // On ouvre le premier onglet (ou sa propre caisse pour une secrétaire)
      setPersonneActive(liste[0]?.id ?? "");
      if (liste.length === 0) setChargement(false);
    }
    chargerPersonnes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Les totaux et le détail de la personne et du jour choisis
  useEffect(() => {
    if (!personneActive) return;

    async function chargerCaisse() {
      setChargement(true);
      setErreur("");
      const parametres =
        `person=${encodeURIComponent(personneActive ?? "")}` +
        (estAujourdhui ? "" : `&date=${dateChoisie}`);
      const [rResume, rDetail] = await Promise.all([
        apiFetch(`/cash-register/summary?${parametres}`),
        apiFetch(`/cash-register/today?${parametres}`),
      ]);
      if (!rResume.ok || !rDetail.ok) {
        setErreur(t("caisse.erreurChargement"));
        setChargement(false);
        return;
      }
      setResume(await rResume.json());
      setDetail(await rDetail.json());
      setChargement(false);
    }
    chargerCaisse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personneActive, dateChoisie]);

  function formaterMontant(montant: number) {
    return montant.toLocaleString(locale);
  }

  // "dim. 8 nov." / "Sun 8 Nov"
  const dateLisible = new Date(`${dateChoisie}T12:00:00`).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  function libelleOnglet(personne: Personne) {
    if (personne.role === "ancien") return `${personne.nom} (${t("caisse.ancienNom")})`;
    return personne.nom;
  }

  function libelleType(type: LignePaiement["type"]) {
    if (type === "inscription") return t("caisse.typeInscription");
    if (type === "reste") return t("caisse.typeReste");
    return t("caisse.typeCorrection");
  }

  function libelleMode(mode?: string) {
    if (mode === "especes") return t("paiement.especes");
    if (mode === "orange_money") return t("paiement.orangeMoney");
    if (mode === "mobile_money") return t("paiement.mobileMoney");
    if (mode === "mobile_especes") return t("paiement.mixte");
    return mode ?? "";
  }

  /**
   * Une ligne « nombre + montant » lisible :
   *   Nouvelles inscriptions
   *   2 factures                 50 000 FCFA
   */
  function ligneNombreMontant(titre: string, nombre: string, montant: number) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{titre}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-sm text-ink">{nombre}</span>
          <span className="text-base font-semibold text-ink">
            {formaterMontant(montant)} <span className="text-xs font-medium">FCFA</span>
          </span>
        </div>
      </div>
    );
  }

  // Une carte par période : le jour, la semaine, le mois
  function cartePeriode(titre: string, bloc: Bloc) {
    return (
      <div key={titre} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink">{titre}</p>

        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t("caisse.totalEncaisse")}
        </p>
        <p className="mt-1 text-3xl font-semibold text-accent">
          {formaterMontant(bloc.total)} <span className="text-base">FCFA</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-accent/10 p-3">
            <p className="text-xs font-medium text-ink-soft">{t("caisse.especes")}</p>
            <p className="mt-1 text-lg font-semibold text-ink">{formaterMontant(bloc.especes)}</p>
          </div>
          <div className="rounded-xl bg-seal/10 p-3">
            <p className="text-xs font-medium text-ink-soft">{t("caisse.mobile")}</p>
            <p className="mt-1 text-lg font-semibold text-ink">{formaterMontant(bloc.mobile)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
          {ligneNombreMontant(
            t("caisse.avances"),
            t("caisse.nbFactures", { nombre: bloc.inscriptions.nombre }),
            bloc.inscriptions.montant,
          )}
          {ligneNombreMontant(
            t("caisse.restes"),
            t("caisse.nbPaiements", { nombre: bloc.restes.nombre }),
            bloc.restes.montant,
          )}
          {bloc.corrections !== 0 && (
            <p className="text-xs text-ink-soft">
              {t("caisse.corrections", { montant: formaterMontant(bloc.corrections) })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <h1
          className="text-3xl text-ink sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {estAdmin ? t("caisse.titre") : t("caisse.maCaisse")}
        </h1>
        <p className="mb-6 mt-2 text-base text-ink-soft">
          {estAdmin ? t("caisse.consigne") : t("caisse.consigneSecretaire")}
        </p>

        {/* Onglets : une personne par onglet (administrateur seulement) */}
        {estAdmin && personnes.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
            {personnes.map((personne) => {
              const actif = personne.id === personneActive;
              return (
                <button
                  key={personne.id}
                  role="tab"
                  aria-selected={actif}
                  onClick={() => setPersonneActive(personne.id)}
                  className={
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition " +
                    (actif
                      ? "bg-accent text-white"
                      : "border border-ink/15 bg-white text-ink hover:bg-paper")
                  }
                >
                  {libelleOnglet(personne)}
                </button>
              );
            })}
          </div>
        )}

        {/* Choix du jour : aujourd'hui par défaut, ou un jour passé */}
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
            {t("caisse.jour")}
            <input
              type="date"
              value={dateChoisie}
              max={aujourdhui}
              onChange={(e) => setDateChoisie(e.target.value || aujourdhui)}
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          {!estAujourdhui && (
            <button
              onClick={() => setDateChoisie(aujourdhui)}
              className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper"
            >
              {t("caisse.allerAujourdhui")}
            </button>
          )}
        </div>

        {erreur && (
          <p className="mb-6 rounded-xl bg-error/10 px-4 py-3 text-base text-error">{erreur}</p>
        )}
        {!erreur && personneActive === "" && (
          <p className="text-base text-ink-soft">{t("caisse.aucunePersonne")}</p>
        )}
        {chargement && <p className="mb-6 text-base text-ink-soft">{t("commun.chargement")}</p>}

        {resume && !chargement && (
          <>
            {/* Le jour, la semaine, le mois */}
            <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
              {cartePeriode(estAujourdhui ? t("caisse.aujourdhui") : dateLisible, resume.aujourdhui)}
              {cartePeriode(
                estAujourdhui ? t("caisse.semaine") : t("caisse.semaineJusquau", { date: dateLisible }),
                resume.semaine,
              )}
              {cartePeriode(
                estAujourdhui ? t("caisse.mois") : t("caisse.moisJusquau", { date: dateLisible }),
                resume.mois,
              )}
            </div>

            {/* Détail des paiements du jour choisi */}
            <h2 className="mb-3 text-xl font-semibold text-ink">
              {estAujourdhui ? t("caisse.detailJour") : t("caisse.detailDu", { date: dateLisible })}
            </h2>
            {detail.length === 0 ? (
              <p className="text-base text-ink-soft">
                {estAujourdhui ? t("caisse.aucunPaiement") : t("caisse.aucunPaiementJour")}
              </p>
            ) : (
              <>
                {/* Ordinateur : tableau */}
                <div className="hidden overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-ink/10 text-ink-soft">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t("caisse.heure")}</th>
                        <th className="px-4 py-3 font-medium">{t("caisse.recu")}</th>
                        <th className="px-4 py-3 font-medium">{t("caisse.candidat")}</th>
                        <th className="px-4 py-3 font-medium">{t("caisse.type")}</th>
                        <th className="px-4 py-3 font-medium">{t("caisse.mode")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("caisse.montant")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.map((ligne) => (
                        <tr key={ligne.id} className="border-b border-ink/5 last:border-0">
                          <td className="px-4 py-3 text-ink-soft">
                            {new Date(ligne.date).toLocaleTimeString(locale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3 text-ink">{ligne.numeroRecu ?? "—"}</td>
                          <td className="px-4 py-3 text-ink">{ligne.candidatNom ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-soft">{libelleType(ligne.type)}</td>
                          <td className="px-4 py-3 text-ink-soft">{libelleMode(ligne.modePaiement)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-ink">
                            {formaterMontant(ligne.montant)} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Téléphone : cartes */}
                <div className="space-y-3 md:hidden">
                  {detail.map((ligne) => (
                    <div key={ligne.id} className="rounded-xl border border-ink/10 bg-white p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-semibold text-ink">{ligne.candidatNom ?? "—"}</p>
                        <p className="font-semibold text-ink">{formaterMontant(ligne.montant)} F</p>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">
                        {new Date(ligne.date).toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {libelleType(ligne.type)} · {libelleMode(ligne.modePaiement)}
                        {ligne.numeroRecu ? ` · ${ligne.numeroRecu}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}