"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  BadgePlan,
  CarteChiffre,
  EnTetePage,
  ICONES,
  Notification,
  champClass,
  labelClass,
  messageErreur,
  montant,
} from "../../components/SuperAdminUI";

/**
 * Espace super admin — Historique des transactions (en français uniquement).
 * Toutes les tentatives de paiement d'abonnement des centres : réussies,
 * échouées ou en attente, avec filtres par statut, centre et période.
 */

type Transaction = {
  id: string;
  centreId: string;
  centre: string;
  plan: string;
  planNom: string;
  periodicite: string;
  montant: number;
  moyen: string;
  statut: "reussi" | "echoue" | "en_attente";
  operateur: string | null;
  raisonEchec: string | null;
  payeParNom: string;
  date: string | null;
  dateConfirmation: string | null;
  finPeriode: string | null;
  factures: number | null;
  comptes: number | null;
  telephone: string | null;
  referenceCampay: string | null;
};

type Reponse = {
  transactions: Transaction[];
  total: number;
  page: number;
  limite: number;
  resume: { reussis: number; echoues: number; enAttente: number; montantReussi: number };
};

type CentreListe = { _id: string; nom: string };

const STATUTS = {
  reussi: { texte: "Réussi", classe: "bg-accent/10 text-accent", point: "bg-accent" },
  echoue: { texte: "Échoué", classe: "bg-error/10 text-error", point: "bg-error" },
  en_attente: { texte: "En attente", classe: "bg-seal/15 text-ink", point: "bg-seal" },
};

const FILTRES_STATUT = [
  { valeur: "", texte: "Toutes" },
  { valeur: "reussi", texte: "Réussies" },
  { valeur: "echoue", texte: "Échouées" },
  { valeur: "en_attente", texte: "En attente" },
];

/** Date et heure : "12 nov. 2026, 14:05" */
function dateHeure(valeur: string | null) {
  if (!valeur) return "—";
  return new Date(valeur).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "237690000000" → "+237 690 00 00 00" */
function telephoneLisible(numero: string | null) {
  if (!numero) return null;
  const m = /^237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(numero);
  return m ? `+237 ${m[1]}${m[2]} ${m[3]} ${m[4]} ${m[5]}` : numero;
}

function moyenLisible(t: Transaction) {
  if (t.moyen === "carte") return "Carte bancaire";
  const operateur = t.operateur?.toUpperCase();
  if (operateur === "MTN") return "MTN Mobile Money";
  if (operateur === "ORANGE") return "Orange Money";
  return "Mobile Money";
}

export default function TransactionsPage() {
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [centres, setCentres] = useState<CentreListe[]>([]);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);

  const [statut, setStatut] = useState("");
  const [centre, setCentre] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function chargerCentres() {
      const res = await apiFetch("/centers");
      if (res.ok) setCentres(await res.json());
    }
    chargerCentres();
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    const parametres = new URLSearchParams();
    if (statut) parametres.set("statut", statut);
    if (centre) parametres.set("centre", centre);
    if (debut) parametres.set("debut", debut);
    if (fin) parametres.set("fin", fin);
    parametres.set("page", String(page));
    const res = await apiFetch(`/subscriptions/transactions?${parametres.toString()}`);
    setChargement(false);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setDonnees(await res.json());
  }, [statut, centre, debut, fin, page]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Un filtre changé : on revient à la première page
  function changerFiltre(action: () => void) {
    action();
    setPage(1);
    setLigneOuverte(null);
  }

  const totalPages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.limite)) : 1;
  const filtreActif = Boolean(statut || centre || debut || fin);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <EnTetePage
        titre="Historique des transactions"
        description="Toutes les tentatives de paiement d'abonnement des centres : réussies, échouées ou en attente de confirmation par CamPay."
      />

      <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />

      {/* Résumé (suit les filtres centre et période) */}
      {donnees && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CarteChiffre titre="Argent reçu" valeur={montant(donnees.resume.montantReussi)} detail="transactions réussies" icone={ICONES.argent} />
          <CarteChiffre titre="Réussies" valeur={String(donnees.resume.reussis)} detail="paiement confirmé" icone={ICONES.factures} />
          <CarteChiffre titre="Échouées" valeur={String(donnees.resume.echoues)} detail="refusées ou annulées" icone={ICONES.cadenas} couleur="error" />
          <CarteChiffre titre="En attente" valeur={String(donnees.resume.enAttente)} detail="pas encore confirmées" icone={ICONES.horloge} couleur="seal" />
        </div>
      )}

      {/* Filtres */}
      <section className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {FILTRES_STATUT.map((f) => (
            <button
              key={f.valeur}
              onClick={() => changerFiltre(() => setStatut(f.valeur))}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                statut === f.valeur ? "bg-ink text-white shadow-sm" : "border border-ink/15 bg-white text-ink hover:bg-ink/5"
              }`}
            >
              {f.texte}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Centre
            <select value={centre} onChange={(e) => changerFiltre(() => setCentre(e.target.value))} className={champClass}>
              <option value="">Tous les centres</option>
              {centres.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Du
            <input type="date" value={debut} onChange={(e) => changerFiltre(() => setDebut(e.target.value))} className={champClass} />
          </label>
          <label className={labelClass}>
            Au
            <input type="date" value={fin} onChange={(e) => changerFiltre(() => setFin(e.target.value))} className={champClass} />
          </label>
        </div>
        {filtreActif && (
          <button
            onClick={() =>
              changerFiltre(() => {
                setStatut("");
                setCentre("");
                setDebut("");
                setFin("");
              })
            }
            className="self-start text-sm font-semibold text-accent hover:underline"
          >
            Effacer les filtres
          </button>
        )}
      </section>

      {/* La liste */}
      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Transactions</h2>
          <p className="text-sm text-ink-soft">{donnees ? `${donnees.total} transaction(s)` : ""}</p>
        </div>

        {chargement && !donnees && <p className="px-5 py-10 text-center text-ink-soft">Chargement…</p>}
        {donnees && donnees.transactions.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">Aucune transaction pour ces filtres.</p>
        )}

        {donnees && donnees.transactions.length > 0 && (
          <ul className={`divide-y divide-ink/5 ${chargement ? "opacity-60" : ""}`}>
            {donnees.transactions.map((t) => {
              const s = STATUTS[t.statut] ?? STATUTS.en_attente;
              const ouverte = ligneOuverte === t.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setLigneOuverte(ouverte ? null : t.id)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left text-sm transition hover:bg-paper/70"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.point}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{t.centre}</p>
                      <p className="text-xs text-ink-soft">
                        {dateHeure(t.date)} · {moyenLisible(t)} · {t.periodicite === "annuel" ? "1 an" : "1 mois"}
                      </p>
                    </div>
                    <BadgePlan code={t.plan} nom={t.planNom} />
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.classe}`}>{s.texte}</span>
                    <span
                      className={`w-28 text-right font-semibold ${
                        t.statut === "reussi" ? "text-accent" : "text-ink-soft line-through decoration-ink/30"
                      }`}
                    >
                      {montant(t.montant)}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${ouverte ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {ouverte && (
                    <div className="grid grid-cols-1 gap-x-8 gap-y-2 bg-paper/60 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <p><span className="text-ink-soft">Lancée par :</span> <span className="text-ink">{t.payeParNom || "—"}</span></p>
                      <p><span className="text-ink-soft">Numéro qui paie :</span> <span className="text-ink">{telephoneLisible(t.telephone) ?? "—"}</span></p>
                      <p><span className="text-ink-soft">Référence CamPay :</span> <span className="break-all text-ink">{t.referenceCampay ?? "—"}</span></p>
                      <p><span className="text-ink-soft">Confirmée le :</span> <span className="text-ink">{dateHeure(t.dateConfirmation)}</span></p>
                      <p><span className="text-ink-soft">Abonnement jusqu&apos;au :</span> <span className="text-ink">{dateHeure(t.finPeriode)}</span></p>
                      {t.plan === "sur_mesure" && (
                        <p><span className="text-ink-soft">Sur mesure :</span> <span className="text-ink">{t.factures ?? "—"} factures, {t.comptes ?? "—"} comptes</span></p>
                      )}
                      {t.raisonEchec && (
                        <p className="sm:col-span-2 lg:col-span-3">
                          <span className="text-ink-soft">Raison de l&apos;échec :</span> <span className="text-error">{t.raisonEchec}</span>
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {donnees && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-5 py-4 text-sm">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1 || chargement}
              className="rounded-lg border border-ink/15 px-4 py-2 font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Précédent
            </button>
            <span className="text-ink-soft">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || chargement}
              className="rounded-lg border border-ink/15 px-4 py-2 font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}