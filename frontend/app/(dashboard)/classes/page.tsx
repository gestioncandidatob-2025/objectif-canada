"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import {
  CodeClasse,
  NOM_CLASSE,
  DESCRIPTION_CLASSE,
  classeDe,
  raisonNonClasse,
} from "../../lib/classes";

type Inscription = {
  _id: string;
  regime?: string;
  dateDebutTest?: string;
  service?: string;
  candidatId?: { _id: string; nom: string; prenom: string } | string;
};

export default function ClassesPage() {
  const router = useRouter();
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function charger() {
      setChargement(true);
      setErreur("");
      const res = await apiFetch("/registrations?statut=en_cours");
      if (res.ok) {
        setInscriptions(await res.json());
      } else {
        setErreur("Impossible de charger les classes");
      }
      setChargement(false);
    }
    charger();
  }, []);

  const compteurs: Record<CodeClasse, number> = {
    jour1: 0,
    jour2: 0,
    soir1: 0,
    soir2: 0,
  };
  for (const insc of inscriptions) {
    const c = classeDe(insc);
    if (c) compteurs[c] += 1;
  }

  // Candidats inscrits en régime jour/soir mais qui, à cause d'une donnée
  // incohérente (régime mal saisi, date de test manquante...), ne tombent
  // dans aucune des 4 classes. Affichés explicitement pour ne plus jamais
  // les perdre silencieusement.
  const nonClasses = inscriptions
    .map((insc) => ({ insc, raison: raisonNonClasse(insc) }))
    .filter((x): x is { insc: Inscription; raison: string } => x.raison !== null);

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1
          className="mb-6 text-3xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Classes en cours
        </h1>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        {chargement && <p className="text-sm text-ink-soft">Chargement...</p>}

        {!chargement && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(NOM_CLASSE) as CodeClasse[]).map((c) => (
              <button
                key={c}
                onClick={() => router.push(`/candidats?classe=${c}`)}
                className="rounded-2xl border border-ink/10 bg-white p-6 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
              >
                <p className="text-lg font-semibold text-ink">{NOM_CLASSE[c]}</p>
                <p className="mt-1 text-sm text-ink-soft">{DESCRIPTION_CLASSE[c]}</p>
                <p className="mt-4 text-3xl font-bold text-accent">{compteurs[c]}</p>
                <p className="text-xs text-ink-soft">candidat(s)</p>
              </button>
            ))}
          </div>
        )}

        {!chargement && nonClasses.length > 0 && (
          <div className="mt-6 rounded-2xl border border-error/30 bg-error/5 p-6">
            <p className="text-lg font-semibold text-error">
              ⚠ {nonClasses.length} candidat(s) non classé(s)
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Ces candidats sont inscrits en régime jour/soir mais
              n&apos;apparaissent dans aucune classe ci-dessus à cause d&apos;une
              donnée incohérente. Corrige l&apos;inscription pour qu&apos;ils
              soient pris en compte.
            </p>
            <ul className="mt-4 divide-y divide-ink/10">
              {nonClasses.map(({ insc, raison }) => {
                const candidat =
                  typeof insc.candidatId === "object" ? insc.candidatId : null;
                return (
                  <li
                    key={insc._id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <span className="font-medium text-ink">
                        {candidat ? `${candidat.prenom} ${candidat.nom}` : "Candidat"}
                      </span>
                      {insc.service && (
                        <span className="ml-2 text-xs text-ink-soft">
                          {insc.service}
                        </span>
                      )}
                      <p className="text-xs text-error">{raison}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/candidats/${candidat?._id ?? ""}`)}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-white"
                    >
                      Corriger
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}