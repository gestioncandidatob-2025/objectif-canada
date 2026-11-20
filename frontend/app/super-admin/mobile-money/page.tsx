"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  CarteChiffre,
  EnTetePage,
  ICONES,
  Notification,
  Section,
  boutonSecondaire,
  champClass,
  dateCourte,
  labelClass,
  messageErreur,
  montant,
} from "../../components/SuperAdminUI";

/**
 * Espace super admin — Mobile Money (en français uniquement).
 * L'argent payé par les candidats des centres avec CamPay arrive sur le
 * compte CamPay de HREFF. Ici : ce qui est dû à chaque centre, le solde réel
 * du compte CamPay, les demandes de retrait à valider et les réglages
 * (frais CamPay, commission HREFF, retrait minimum).
 */

type StatutRetrait = "demande" | "en_cours" | "envoye" | "refuse" | "echoue";

type Retrait = {
  id: string;
  centre: string;
  montant: number;
  telephone: string;
  statut: StatutRetrait;
  demandeParNom: string | null;
  traiteParNom: string | null;
  raison: string | null;
  date: string | null;
};

type Vue = {
  totaux: { brut: number; frais: number; commission: number; net: number; retire: number; soldeDu: number };
  soldeCampay: { total: number; mtn: number; orange: number } | null;
  centres: {
    centreId: string;
    centre: string;
    brut: number;
    frais: number;
    net: number;
    nombre: number;
    retire: number;
    solde: number;
  }[];
  reglages: { tauxFraisCampay: number; tauxCommission: number; retraitMinimum: number };
};

const STATUTS: Record<StatutRetrait, { texte: string; classe: string }> = {
  demande: { texte: "À valider", classe: "bg-seal/15 text-ink" },
  en_cours: { texte: "Envoi en cours", classe: "bg-seal/15 text-ink" },
  envoye: { texte: "Envoyé", classe: "bg-accent/10 text-accent" },
  refuse: { texte: "Refusé", classe: "bg-error/10 text-error" },
  echoue: { texte: "Échoué", classe: "bg-error/10 text-error" },
};

export default function MobileMoneySuperAdminPage() {
  const [vue, setVue] = useState<Vue | null>(null);
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [filtre, setFiltre] = useState<StatutRetrait | "">("demande");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);

  // Réglages
  const [frais, setFrais] = useState("");
  const [commission, setCommission] = useState("");
  const [minimum, setMinimum] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  const chargerVue = useCallback(async () => {
    const res = await apiFetch("/mobile-payments/platform/overview");
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const data: Vue = await res.json();
    setVue(data);
    setFrais(String(data.reglages.tauxFraisCampay ?? 0));
    setCommission(String(data.reglages.tauxCommission ?? 0));
    setMinimum(String(data.reglages.retraitMinimum ?? 1000));
  }, []);

  const chargerRetraits = useCallback(async () => {
    const res = await apiFetch(`/mobile-payments/platform/withdrawals${filtre ? `?status=${filtre}` : ""}`);
    if (res.ok) setRetraits(await res.json());
  }, [filtre]);

  useEffect(() => {
    chargerVue();
  }, [chargerVue]);

  useEffect(() => {
    chargerRetraits();
  }, [chargerRetraits]);

  async function valider(r: Retrait) {
    if (!window.confirm(`Envoyer ${montant(r.montant)} à ${r.centre} (${r.telephone.replace(/^237/, "")}) ?`)) return;
    setEnCours(r.id);
    const res = await apiFetch(`/mobile-payments/platform/withdrawals/${r.id}/approve`, { method: "PATCH" });
    setEnCours(null);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    const resultat: Retrait = await res.json();
    if (resultat.statut === "echoue") {
      setErreur(`L'envoi a échoué : ${resultat.raison ?? "CamPay a refusé"}`);
    } else {
      setSucces(resultat.statut === "envoye" ? "Argent envoyé." : "Envoi lancé : CamPay est en train d'envoyer.");
    }
    chargerRetraits();
    chargerVue();
  }

  async function refuser(r: Retrait) {
    const raison = window.prompt(`Refuser le retrait de ${r.centre} ? Raison (facultatif) :`, "");
    if (raison === null) return;
    setEnCours(r.id);
    const res = await apiFetch(`/mobile-payments/platform/withdrawals/${r.id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ raison }),
    });
    setEnCours(null);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces("Retrait refusé : le montant revient dans le solde du centre.");
    chargerRetraits();
    chargerVue();
  }

  async function enregistrerReglages() {
    setEnregistrement(true);
    const res = await apiFetch("/mobile-payments/platform/settings", {
      method: "PATCH",
      body: JSON.stringify({
        tauxFraisCampay: Number(frais.replace(",", ".")) || 0,
        tauxCommission: Number(commission.replace(",", ".")) || 0,
        retraitMinimum: Number(minimum.replace(/\D/g, "")) || 1000,
      }),
    });
    setEnregistrement(false);
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces("Réglages enregistrés. Ils s'appliquent aux prochains paiements.");
    chargerVue();
  }

  const soldeInsuffisant = vue?.soldeCampay && vue.soldeCampay.total < vue.totaux.soldeDu;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:py-10">
      <EnTetePage
        titre="Mobile Money"
        description="L'argent payé par les candidats des centres avec CamPay, ce que HREFF leur doit, et les retraits à valider."
      />

      <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />
      <Notification message={succes} type="succes" onFermer={() => setSucces("")} />
      {!vue && !erreur && <p className="text-ink-soft">Chargement…</p>}

      {vue && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CarteChiffre
              titre="Dû aux centres"
              valeur={montant(vue.totaux.soldeDu)}
              detail="reçu net, moins les retraits"
              icone={ICONES.centres}
              couleur="ink"
            />
            <CarteChiffre
              titre="Solde du compte CamPay"
              valeur={vue.soldeCampay ? montant(vue.soldeCampay.total) : "—"}
              detail={
                vue.soldeCampay
                  ? `MTN ${montant(vue.soldeCampay.mtn)} · Orange ${montant(vue.soldeCampay.orange)}`
                  : "illisible pour l'instant"
              }
              icone={ICONES.argent}
              couleur={soldeInsuffisant ? "error" : "accent"}
            />
            <CarteChiffre
              titre="Payé par les candidats"
              valeur={montant(vue.totaux.brut)}
              detail={`frais CamPay ${montant(vue.totaux.frais)}`}
              icone={ICONES.factures}
            />
            <CarteChiffre
              titre="Commission HREFF"
              valeur={montant(vue.totaux.commission)}
              detail={`déjà retiré par les centres : ${montant(vue.totaux.retire)}`}
              icone={ICONES.cadeau}
              couleur="seal"
            />
          </div>

          {soldeInsuffisant && (
            <p className="rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
              ⚠ Le solde du compte CamPay est plus petit que ce qui est dû aux centres. Vérifie les frais et les
              retraits avant de valider d&apos;autres envois.
            </p>
          )}

          {/* Demandes de retrait */}
          <Section
            titre="Retraits"
            description="Valider envoie l'argent tout de suite avec CamPay vers le numéro du centre."
            action={
              <select
                value={filtre}
                onChange={(e) => setFiltre(e.target.value as StatutRetrait | "")}
                className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm text-ink"
              >
                <option value="demande">À valider</option>
                <option value="en_cours">Envoi en cours</option>
                <option value="envoye">Envoyés</option>
                <option value="refuse">Refusés</option>
                <option value="echoue">Échoués</option>
                <option value="">Tous</option>
              </select>
            }
          >
            {retraits.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Aucun retrait ici.</p>
            ) : (
              <ul className="divide-y divide-ink/5">
                {retraits.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {r.centre} : {montant(r.montant)}
                      </p>
                      <p className="text-xs text-ink-soft">
                        vers le {r.telephone.replace(/^237/, "")} · demandé le {dateCourte(r.date)}
                        {r.demandeParNom ? ` par ${r.demandeParNom}` : ""}
                        {r.traiteParNom ? ` · traité par ${r.traiteParNom}` : ""}
                      </p>
                      {r.raison && <p className="text-xs text-ink-soft">{r.raison}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUTS[r.statut].classe}`}>
                        {STATUTS[r.statut].texte}
                      </span>
                      {r.statut === "demande" && (
                        <>
                          <button
                            onClick={() => refuser(r)}
                            disabled={enCours === r.id}
                            className={boutonSecondaire}
                          >
                            Refuser
                          </button>
                          <button
                            onClick={() => valider(r)}
                            disabled={enCours === r.id}
                            className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                          >
                            {enCours === r.id ? "Envoi…" : "Valider et envoyer"}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Par centre */}
          <Section titre="Par centre" description="Ce que chaque centre a reçu et ce qui lui reste à retirer">
            {vue.centres.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">Aucun paiement CamPay pour l&apos;instant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-ink/10 text-ink-soft">
                    <tr>
                      <th className="px-5 py-3 font-medium">Centre</th>
                      <th className="px-5 py-3 text-right font-medium">Paiements</th>
                      <th className="px-5 py-3 text-right font-medium">Payé</th>
                      <th className="px-5 py-3 text-right font-medium">Net</th>
                      <th className="px-5 py-3 text-right font-medium">Retiré</th>
                      <th className="px-5 py-3 text-right font-medium">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vue.centres.map((c) => (
                      <tr key={c.centreId} className="border-b border-ink/5 last:border-0">
                        <td className="px-5 py-3 font-semibold text-ink">{c.centre}</td>
                        <td className="px-5 py-3 text-right text-ink-soft">{c.nombre}</td>
                        <td className="px-5 py-3 text-right text-ink-soft">{montant(c.brut)}</td>
                        <td className="px-5 py-3 text-right text-ink">{montant(c.net)}</td>
                        <td className="px-5 py-3 text-right text-ink-soft">{montant(c.retire)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-ink">{montant(c.solde)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Réglages */}
          <Section
            titre="Réglages"
            description="Les frais et la commission sont retirés de chaque paiement reçu. Les paiements déjà reçus ne changent pas."
          >
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <label className={labelClass}>
                Frais CamPay (%)
                <input
                  inputMode="decimal"
                  value={frais}
                  onChange={(e) => setFrais(e.target.value)}
                  className={champClass}
                />
              </label>
              <label className={labelClass}>
                Commission HREFF (%)
                <input
                  inputMode="decimal"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className={champClass}
                />
              </label>
              <label className={labelClass}>
                Retrait minimum (FCFA)
                <input
                  inputMode="numeric"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                  className={champClass}
                />
              </label>
            </div>
            <div className="flex justify-end px-5 pb-5">
              <button
                onClick={enregistrerReglages}
                disabled={enregistrement}
                className="inline-flex h-10 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {enregistrement ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </Section>
        </>
      )}
    </main>
  );
}