"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import {
  CarteChiffre,
  EnTetePage,
  ICONES,
  Notification,
  VueEnsemble,
  boutonSecondaire,
  dateCourte,
  messageErreur,
} from "../../components/SuperAdminUI";

/**
 * Espace super admin — Abonnements à suivre (en français uniquement).
 * Les centres à plan payant dont l'abonnement se termine bientôt, est en
 * période de grâce, ou est passé en lecture seule.
 */

type Statut = "echeance_proche" | "grace" | "lecture_seule";

const STATUTS: Record<Statut, { titre: string; pastille: string; classe: string; explication: string }> = {
  echeance_proche: {
    titre: "Échéance proche",
    pastille: "bg-accent/10 text-accent",
    classe: "border-accent/30",
    explication: "Encore payé, mais l'abonnement se termine dans moins de 7 jours. Pense à prévenir le centre.",
  },
  grace: {
    titre: "Période de grâce",
    pastille: "bg-seal/15 text-ink",
    classe: "border-seal/40",
    explication: "La date de fin est passée. Le centre travaille encore normalement et a 7 jours pour payer.",
  },
  lecture_seule: {
    titre: "Lecture seule",
    pastille: "bg-error/10 text-error",
    classe: "border-error/30",
    explication: "La grâce est terminée sans paiement : plus de nouvelle facture ni de nouveau compte. Rien n'est supprimé.",
  },
};

const ORDRE: Statut[] = ["lecture_seule", "grace", "echeance_proche"];

/** Nombre de jours entre aujourd'hui et une date (négatif si elle est passée) */
function joursRestants(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function SuiviPage() {
  const [vue, setVue] = useState<VueEnsemble | null>(null);
  const [erreur, setErreur] = useState("");
  const [filtre, setFiltre] = useState<Statut | "tous">("tous");

  const charger = useCallback(async () => {
    const res = await apiFetch("/subscriptions/overview");
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setVue(await res.json());
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const lignes = vue?.aSuivre ?? [];
  const nombre = (statut: Statut) => lignes.filter((l) => l.statut === statut).length;
  const affichees = lignes
    .filter((l) => filtre === "tous" || l.statut === filtre)
    .sort((a, b) => ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <EnTetePage
        titre="Abonnements à suivre"
        description="Les centres à plan payant dont l'abonnement se termine bientôt, est en retard ou est bloqué. Les centres au plan Gratuit et les plans offerts n'y sont pas."
      />

      <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />
      {!vue && !erreur && <p className="text-ink-soft">Chargement…</p>}

      {vue && (
        <>
          {/* Les trois situations */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CarteChiffre
              titre="Échéance proche"
              valeur={String(nombre("echeance_proche"))}
              detail="se termine dans moins de 7 jours"
              icone={ICONES.horloge}
            />
            <CarteChiffre
              titre="Période de grâce"
              valeur={String(nombre("grace"))}
              detail="7 jours pour payer"
              icone={ICONES.horloge}
              couleur="seal"
            />
            <CarteChiffre
              titre="Lecture seule"
              valeur={String(nombre("lecture_seule"))}
              detail="plus de nouvelle facture"
              icone={ICONES.cadenas}
              couleur="error"
            />
          </div>

          {/* Filtre */}
          <div className="flex flex-wrap gap-2">
            {(["tous", ...ORDRE] as const).map((cle) => {
              const actif = filtre === cle;
              const libelle = cle === "tous" ? `Tous (${lignes.length})` : `${STATUTS[cle].titre} (${nombre(cle)})`;
              return (
                <button
                  key={cle}
                  onClick={() => setFiltre(cle)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    actif ? "bg-ink text-white shadow-sm" : "border border-ink/15 bg-white text-ink hover:bg-ink/5"
                  }`}
                >
                  {libelle}
                </button>
              );
            })}
          </div>

          {/* La liste */}
          {affichees.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 bg-white px-5 py-12 text-center shadow-sm">
              <p className="text-base font-semibold text-ink">Rien à suivre pour l&apos;instant</p>
              <p className="mt-1 text-sm text-ink-soft">Aucun abonnement en fin de période, en retard ou bloqué.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {affichees.map((ligne) => {
                const statut = STATUTS[ligne.statut];
                const dateCle = ligne.statut === "echeance_proche" ? ligne.finAbonnement : ligne.finGrace;
                const jours = joursRestants(dateCle);
                return (
                  <div key={ligne.centreId} className={`rounded-2xl border-2 bg-white p-5 shadow-sm ${statut.classe}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-ink">{ligne.centre}</p>
                        <p className="text-sm text-ink-soft">Plan {ligne.plan}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statut.pastille}`}>
                        {statut.titre}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-paper p-3">
                        <p className="text-xs text-ink-soft">Fin de l&apos;abonnement</p>
                        <p className="mt-1 font-semibold text-ink">{dateCourte(ligne.finAbonnement)}</p>
                      </div>
                      <div className="rounded-xl bg-paper p-3">
                        <p className="text-xs text-ink-soft">
                          {ligne.statut === "lecture_seule" ? "Bloqué depuis le" : ligne.statut === "grace" ? "Payer avant le" : "Jours restants"}
                        </p>
                        <p className="mt-1 font-semibold text-ink">
                          {ligne.statut === "echeance_proche"
                            ? jours !== null
                              ? `${Math.max(jours, 0)} jour(s)`
                              : "—"
                            : dateCourte(ligne.finGrace)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-ink-soft">{statut.explication}</p>

                    <div className="mt-4 flex justify-end">
                      <Link href={`/super-admin/reglage?centre=${ligne.centreId}`} className={boutonSecondaire}>
                        Régler l&apos;abonnement
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}