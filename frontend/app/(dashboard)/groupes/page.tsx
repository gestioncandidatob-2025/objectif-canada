"use client";

import { Suspense, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useLangue } from "../../lib/langue";
import ListeCandidats from "../../components/ListeCandidats";

type Tarif = {
  _id: string;
  service: string;
  actif: boolean;
};

// Mêmes libellés que la page Tarifs
const LABEL_SERVICE: Record<string, string> = {
  tcf: "TCF",
  tcf_2mois: "TCF 2 mois",
  examen_blanc: "Examen blanc",
  tcf_special: "TCF SPECIAL",
};

function formaterNomService(service: string): string {
  if (LABEL_SERVICE[service]) return LABEL_SERVICE[service];
  return service
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

// Un groupe = un service créé dans Paramètres → Services.
// Cliquer sur un groupe affiche la liste des candidats inscrits à ce service.
export default function GroupesPage() {
  const { t } = useLangue();

  const [services, setServices] = useState<{ service: string; actif: boolean }[]>([]);
  const [serviceChoisi, setServiceChoisi] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    async function chargerServices() {
      const res = await apiFetch("/tarifs");
      if (!res.ok) {
        setErreur(t("groupes.erreurChargement"));
        setChargement(false);
        return;
      }
      const tarifs: Tarif[] = await res.json();
      // Un seul bouton par service (actif si au moins une de ses offres est active)
      const parService = new Map<string, boolean>();
      for (const tarif of tarifs) {
        parService.set(tarif.service, (parService.get(tarif.service) ?? false) || tarif.actif);
      }
      const liste = Array.from(parService, ([service, actif]) => ({ service, actif })).sort(
        (a, b) => Number(b.actif) - Number(a.actif),
      );
      setServices(liste);
      setChargement(false);
    }
    chargerServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="px-4 pt-6 sm:pt-10">
        <div className="mx-auto max-w-7xl">
          <h1
            className="mb-2 text-2xl text-ink sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("groupes.titre")}
          </h1>
          <p className="mb-5 text-sm text-ink-soft">{t("groupes.consigne")}</p>

          {erreur && (
            <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{erreur}</p>
          )}

          {chargement ? (
            <p className="text-sm text-ink-soft">{t("commun.chargement")}</p>
          ) : services.length === 0 ? (
            <p className="rounded-xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-ink-soft">
              {t("groupes.aucunService")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ service, actif }) => {
                const choisi = service === serviceChoisi;
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => setServiceChoisi(choisi ? null : service)}
                    className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 px-5 py-6 text-center text-lg font-semibold shadow-sm transition active:scale-[0.97] sm:text-xl ${
                      choisi
                        ? "border-accent bg-accent text-white"
                        : "border-ink/15 bg-white text-ink hover:border-accent hover:text-accent"
                    }`}
                  >
                    {t("groupes.groupe", { service: formaterNomService(service) })}
                    {!actif && (
                      <span className={`mt-1 text-sm font-normal ${choisi ? "text-white/80" : "text-ink-soft"}`}>
                        ({t("candidats.offreInactive")})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {serviceChoisi && (
        // key : la liste repart de zéro quand on change de groupe
        <Suspense key={serviceChoisi}>
          <ListeCandidats
            key={serviceChoisi}
            serviceImpose={serviceChoisi}
            titre={t("groupes.groupe", { service: formaterNomService(serviceChoisi) })}
          />
        </Suspense>
      )}
    </div>
  );
}