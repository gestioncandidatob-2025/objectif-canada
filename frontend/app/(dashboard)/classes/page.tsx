"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";
import {
  CodeClasse,
  NOM_CLASSE,
  classeDe,
  raisonNonClasse,
  type RaisonNonClasse,
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
  const { t } = useLangue();

  useEffect(() => {
    async function charger() {
      setChargement(true);
      setErreur("");
      const res = await apiFetch("/registrations?statut=en_cours");
      if (res.ok) {
        setInscriptions(await res.json());
      } else {
        setErreur(t("classes.erreurChargement"));
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
    .filter(
      (x): x is { insc: Inscription; raison: RaisonNonClasse } => x.raison !== null,
    );

  return (
    <div className="px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <h1
          className="mb-6 text-2xl text-ink sm:text-3xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("classes.titre")}
        </h1>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        {chargement && <p className="text-sm text-ink-soft">{t("commun.chargement")}</p>}

        {!chargement && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(NOM_CLASSE) as CodeClasse[]).map((c) => (
              <button
                key={c}
                onClick={() => router.push(`/candidats?classe=${c}`)}
                className="rounded-2xl border border-ink/10 bg-white p-6 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
              >
                <p className="text-lg font-semibold text-ink">{t(`classes.noms.${c}`)}</p>
                <p className="mt-1 text-sm text-ink-soft">{t(`classes.descriptions.${c}`)}</p>
                <p className="mt-4 text-3xl font-bold text-accent">{compteurs[c]}</p>
                <p className="text-xs text-ink-soft">{t("classes.candidats")}</p>
              </button>
            ))}
          </div>
        )}

        {!chargement && nonClasses.length > 0 && (
          <div className="mt-6 rounded-2xl border border-error/30 bg-error/5 p-6">
            <p className="text-lg font-semibold text-error">
              ⚠ {t("classes.nonClasses", { n: nonClasses.length })}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {t("classes.nonClassesAide")}
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
                        {candidat ? `${candidat.prenom} ${candidat.nom}` : t("facture.candidat")}
                      </span>
                      {insc.service && (
                        <span className="ml-2 text-xs text-ink-soft">
                          {insc.service}
                        </span>
                      )}
                      <p className="text-xs text-error">{t(raison.cle, raison.valeurs)}</p>
                    </div>
                    <button
                      onClick={() => router.push(`/candidats/${candidat?._id ?? ""}`)}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-white"
                    >
                      {t("classes.corriger")}
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