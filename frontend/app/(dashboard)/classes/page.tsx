"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { CodeClasse, NOM_CLASSE, DESCRIPTION_CLASSE, classeDe } from "../../lib/classes";

type Inscription = {
  _id: string;
  regime?: string;
  dateDebutTest?: string;
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
      </div>
    </div>
  );
}