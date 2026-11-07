"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type Groupe = {
  _id: string;
  nom: string;
  horaire?: string;
  capacite?: number;
  actif: boolean;
  regimeEntree?: string;
  groupeSuivantId?: string;
  joursAvantPassage?: number;
  effectif: number;
  plein: boolean;
};

type CandidatDuGroupe = {
  inscriptionId: string;
  candidatId?: string;
  nom: string;
  prenom: string;
  telephone: string;
  numeroRecu: string;
  service: string;
  dateEntreeGroupe?: string;
  dateFin?: string;
  montantTotal: number;
  montantPaye: number;
  resteAPayer: number;
};

type DetailGroupe = {
  effectif: number;
  totalResteAPayer: number;
  candidats: CandidatDuGroupe[];
};

type Tarif = {
  regimeActif: boolean;
  regimes?: string[];
};

type Formulaire = {
  nom: string;
  horaire: string;
  capacite: string;
  regimeEntree: string;
  groupeSuivantId: string;
  joursAvantPassage: string;
};

const formulaireVide: Formulaire = {
  nom: "",
  horaire: "",
  capacite: "",
  regimeEntree: "",
  groupeSuivantId: "",
  joursAvantPassage: "",
};

// Le serveur renvoie soit un message, soit une liste de messages
function messageErreur(data: { message?: string | string[] } | null, parDefaut: string): string {
  if (!data?.message) return parDefaut;
  return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}

function formaterMontant(montant: number): string {
  return `${(montant ?? 0).toLocaleString("fr-FR")} FCFA`;
}

function formaterDate(date?: string): string {
  return date ? new Date(date).toLocaleDateString("fr-FR") : "—";
}

export default function GroupesPage() {
  const [estAdmin, setEstAdmin] = useState(false);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [regimesConnus, setRegimesConnus] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  // Formulaire de création / modification (administrateur)
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [groupeEnEdition, setGroupeEnEdition] = useState<Groupe | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(formulaireVide);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [passageEnCours, setPassageEnCours] = useState(false);

  // Groupe ouvert : ses candidats et ce qu'ils doivent
  const [groupeOuvert, setGroupeOuvert] = useState<Groupe | null>(null);
  const [detail, setDetail] = useState<DetailGroupe | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const admin = user?.role === "admin";
    setEstAdmin(admin);
    chargerGroupes();
    if (admin) chargerRegimes();
  }, []);

  async function chargerGroupes() {
    setChargement(true);
    try {
      const res = await apiFetch("/groups");
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, "Impossible de charger les groupes"));
        return;
      }
      setGroupes(data);
    } catch {
      setErreur("Impossible de contacter le serveur");
    } finally {
      setChargement(false);
    }
  }

  // Régimes saisis dans les services (Paramètres → Services), pour la liste
  // « premier groupe du régime »
  async function chargerRegimes() {
    try {
      const res = await apiFetch("/tarifs");
      if (!res.ok) return;
      const tarifs: Tarif[] = await res.json();
      const regimes = new Set<string>();
      for (const tarif of tarifs) {
        if (!tarif.regimeActif) continue;
        for (const regime of tarif.regimes ?? []) {
          const propre = regime.trim().toLowerCase();
          if (propre) regimes.add(propre);
        }
      }
      setRegimesConnus(Array.from(regimes).sort());
    } catch {
      // pas grave : la liste des régimes sera vide
    }
  }

  async function ouvrirGroupe(groupe: Groupe) {
    setGroupeOuvert(groupe);
    setDetail(null);
    setChargementDetail(true);
    try {
      const res = await apiFetch(`/groups/${groupe._id}/candidates`);
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, "Impossible de charger les candidats du groupe"));
        return;
      }
      setDetail(data);
    } catch {
      setErreur("Impossible de contacter le serveur");
    } finally {
      setChargementDetail(false);
    }
  }

  function nomDuGroupe(id?: string): string {
    if (!id) return "";
    return groupes.find((g) => g._id === id)?.nom ?? "groupe supprimé";
  }

  // ---- Formulaire (administrateur) ----

  function ouvrirCreation() {
    setGroupeEnEdition(null);
    setFormulaire(formulaireVide);
    setFormulaireOuvert(true);
    setMessage("");
    setErreur("");
  }

  function ouvrirModification(groupe: Groupe) {
    setGroupeEnEdition(groupe);
    setFormulaire({
      nom: groupe.nom,
      horaire: groupe.horaire ?? "",
      capacite: groupe.capacite ? String(groupe.capacite) : "",
      regimeEntree: groupe.regimeEntree ?? "",
      groupeSuivantId: groupe.groupeSuivantId ?? "",
      joursAvantPassage: groupe.joursAvantPassage ? String(groupe.joursAvantPassage) : "",
    });
    setFormulaireOuvert(true);
    setMessage("");
    setErreur("");
  }

  function fermerFormulaire() {
    setFormulaireOuvert(false);
    setGroupeEnEdition(null);
    setFormulaire(formulaireVide);
  }

  async function enregistrerGroupe(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setErreur("");

    if (!formulaire.nom.trim()) {
      setErreur("Le nom du groupe est obligatoire");
      return;
    }
    const avecSuivant = !!formulaire.groupeSuivantId;
    const avecJours = !!formulaire.joursAvantPassage;
    if (avecSuivant !== avecJours) {
      setErreur(
        "Pour le passage automatique, choisis à la fois le groupe suivant et le nombre de jours",
      );
      return;
    }

    // null = effacer la valeur côté serveur
    const corps = {
      nom: formulaire.nom.trim(),
      horaire: formulaire.horaire.trim(),
      capacite: formulaire.capacite ? Number(formulaire.capacite) : null,
      regimeEntree: formulaire.regimeEntree || null,
      groupeSuivantId: formulaire.groupeSuivantId || null,
      joursAvantPassage: formulaire.joursAvantPassage ? Number(formulaire.joursAvantPassage) : null,
    };

    setEnregistrementEnCours(true);
    try {
      const res = await apiFetch(groupeEnEdition ? `/groups/${groupeEnEdition._id}` : "/groups", {
        method: groupeEnEdition ? "PATCH" : "POST",
        body: JSON.stringify(corps),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, "Enregistrement impossible"));
        return;
      }
      setMessage(groupeEnEdition ? "Groupe modifié" : "Groupe créé");
      fermerFormulaire();
      await chargerGroupes();
    } catch {
      setErreur("Impossible de contacter le serveur");
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  async function basculerActif(groupe: Groupe) {
    setMessage("");
    setErreur("");
    if (groupe.actif) {
      const confirme = window.confirm(
        `Désactiver le groupe « ${groupe.nom} » ?\n\nIl ne recevra plus de nouveaux candidats. Les candidats déjà dedans y restent.`,
      );
      if (!confirme) return;
    }
    try {
      const res = await apiFetch(`/groups/${groupe._id}`, {
        method: "PATCH",
        body: JSON.stringify({ actif: !groupe.actif }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, "Modification impossible"));
        return;
      }
      setMessage(groupe.actif ? "Groupe désactivé" : "Groupe réactivé");
      await chargerGroupes();
    } catch {
      setErreur("Impossible de contacter le serveur");
    }
  }

  async function appliquerPassages() {
    setMessage("");
    setErreur("");
    setPassageEnCours(true);
    try {
      const res = await apiFetch("/groups/apply-transfers", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErreur(messageErreur(data, "Impossible d'appliquer les passages"));
        return;
      }
      setMessage(
        data.deplaces > 0
          ? `${data.deplaces} candidat(s) passé(s) au groupe suivant`
          : "Aucun candidat à faire passer pour le moment",
      );
      await chargerGroupes();
      if (groupeOuvert) await ouvrirGroupe(groupeOuvert);
    } catch {
      setErreur("Impossible de contacter le serveur");
    } finally {
      setPassageEnCours(false);
    }
  }

  // Régimes proposés : ceux des services, plus celui déjà réglé sur le groupe
  const regimesProposes = Array.from(
    new Set([...regimesConnus, ...(formulaire.regimeEntree ? [formulaire.regimeEntree] : [])]),
  ).sort();

  // Groupes suivants possibles : tous sauf celui qu'on modifie
  const groupesSuivantsPossibles = groupes.filter((g) => g._id !== groupeEnEdition?._id);

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1
            className="text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Groupes
          </h1>
          {estAdmin && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={appliquerPassages}
                disabled={passageEnCours}
                className="rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passageEnCours ? "Passages en cours..." : "Appliquer les passages maintenant"}
              </button>
              <button
                type="button"
                onClick={formulaireOuvert ? fermerFormulaire : ouvrirCreation}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                {formulaireOuvert ? "Annuler" : "+ Nouveau groupe"}
              </button>
            </div>
          )}
        </div>

        {estAdmin && (
          <p className="mb-6 text-sm text-ink-soft">
            Les nouveaux inscrits entrent automatiquement dans le premier groupe de leur régime,
            puis passent au groupe suivant après le nombre de jours réglé. Les passages se font
            aussi tout seuls chaque nuit.
          </p>
        )}

        {message && (
          <p className="mb-4 rounded-lg bg-accent/10 px-3 py-2.5 text-sm text-accent">{message}</p>
        )}
        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">{erreur}</p>
        )}

        {/* ---------- Formulaire (administrateur) ---------- */}
        {estAdmin && formulaireOuvert && (
          <form
            onSubmit={enregistrerGroupe}
            className="mb-8 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-ink">
              {groupeEnEdition ? `Modifier « ${groupeEnEdition.nom} »` : "Nouveau groupe"}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  Nom du groupe <span className="text-error">*</span>
                </label>
                <input
                  value={formulaire.nom}
                  onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
                  placeholder="Ex : Soir 1"
                  maxLength={50}
                  className={champClass}
                />
              </div>
              <div>
                <label className={labelClass}>Horaire</label>
                <input
                  value={formulaire.horaire}
                  onChange={(e) => setFormulaire({ ...formulaire, horaire: e.target.value })}
                  placeholder="Ex : Lundi au vendredi, 17h - 19h"
                  maxLength={100}
                  className={champClass}
                />
              </div>
              <div>
                <label className={labelClass}>Capacité (places)</label>
                <input
                  type="number"
                  min={1}
                  value={formulaire.capacite}
                  onChange={(e) => setFormulaire({ ...formulaire, capacite: e.target.value })}
                  placeholder="Vide = pas de limite"
                  className={champClass}
                />
              </div>
              <div>
                <label className={labelClass}>Premier groupe du régime</label>
                <select
                  value={formulaire.regimeEntree}
                  onChange={(e) => setFormulaire({ ...formulaire, regimeEntree: e.target.value })}
                  className={champClass}
                >
                  <option value="">Aucun (les nouveaux inscrits n&apos;y entrent pas directement)</option>
                  {regimesProposes.map((regime) => (
                    <option key={regime} value={regime}>
                      {regime}
                    </option>
                  ))}
                </select>
                {regimesProposes.length === 0 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    Aucun régime trouvé : ajoute des régimes à un service dans Paramètres → Services.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-paper p-4">
              <p className="mb-3 text-sm font-medium text-ink">
                Passage automatique (facultatif)
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Passer dans le groupe</label>
                  <select
                    value={formulaire.groupeSuivantId}
                    onChange={(e) =>
                      setFormulaire({ ...formulaire, groupeSuivantId: e.target.value })
                    }
                    className={champClass}
                  >
                    <option value="">Aucun passage</option>
                    {groupesSuivantsPossibles.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.nom}
                        {!g.actif ? " (désactivé)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Après combien de jours</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={formulaire.joursAvantPassage}
                    onChange={(e) =>
                      setFormulaire({ ...formulaire, joursAvantPassage: e.target.value })
                    }
                    placeholder="Ex : 14"
                    className={champClass}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={fermerFormulaire}
                className="rounded-lg border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-paper"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enregistrementEnCours}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enregistrementEnCours ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>
        )}

        {/* ---------- Liste des groupes ---------- */}
        {chargement && <p className="text-sm text-ink-soft">Chargement...</p>}

        {!chargement && groupes.length === 0 && (
          <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink-soft shadow-sm">
            {estAdmin
              ? "Aucun groupe pour le moment. Clique sur « + Nouveau groupe » pour créer le premier."
              : "Aucun groupe pour le moment."}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupes.map((groupe) => {
            const ouvert = groupeOuvert?._id === groupe._id;
            return (
              <div
                key={groupe._id}
                role="button"
                tabIndex={0}
                onClick={() => ouvrirGroupe(groupe)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ouvrirGroupe(groupe);
                }}
                className={
                  "cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition hover:border-accent " +
                  (ouvert ? "border-accent ring-2 ring-accent/20" : "border-ink/10") +
                  (groupe.actif ? "" : " opacity-60")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-ink">{groupe.nom}</h2>
                  <div className="flex shrink-0 gap-1">
                    {!groupe.actif && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink-soft">
                        Désactivé
                      </span>
                    )}
                    {groupe.plein && (
                      <span className="rounded-full bg-seal/15 px-2 py-0.5 text-xs font-medium text-seal">
                        Plein
                      </span>
                    )}
                  </div>
                </div>

                {groupe.horaire && <p className="mt-1 text-sm text-ink-soft">{groupe.horaire}</p>}

                <p className="mt-3 text-2xl font-semibold text-ink">
                  {groupe.effectif}
                  <span className="text-sm font-normal text-ink-soft">
                    {groupe.capacite ? ` / ${groupe.capacite} places` : " candidat(s)"}
                  </span>
                </p>

                <div className="mt-3 space-y-1 text-xs text-ink-soft">
                  {groupe.regimeEntree && (
                    <p>Premier groupe du régime « {groupe.regimeEntree} »</p>
                  )}
                  {groupe.groupeSuivantId && groupe.joursAvantPassage && (
                    <p>
                      → Passe dans « {nomDuGroupe(groupe.groupeSuivantId)} » après{" "}
                      {groupe.joursAvantPassage} jours
                    </p>
                  )}
                </div>

                {estAdmin && (
                  <div className="mt-4 flex gap-4 border-t border-ink/10 pt-3 text-sm">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        ouvrirModification(groupe);
                      }}
                      className="font-medium text-seal hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        basculerActif(groupe);
                      }}
                      className={
                        "font-medium hover:underline " +
                        (groupe.actif ? "text-error" : "text-accent")
                      }
                    >
                      {groupe.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ---------- Candidats du groupe ouvert ---------- */}
        {groupeOuvert && (
          <div className="mt-8 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">
                Candidats de « {groupeOuvert.nom} »
              </h2>
              <button
                type="button"
                onClick={() => {
                  setGroupeOuvert(null);
                  setDetail(null);
                }}
                className="text-sm font-medium text-ink-soft hover:text-ink"
              >
                Fermer
              </button>
            </div>

            {chargementDetail && <p className="text-sm text-ink-soft">Chargement...</p>}

            {detail && detail.candidats.length === 0 && (
              <p className="text-sm text-ink-soft">Aucun candidat en cours dans ce groupe.</p>
            )}

            {detail && detail.candidats.length > 0 && (
              <>
                <p className="mb-4 text-sm text-ink-soft">
                  {detail.effectif} candidat(s) — reste à payer au total :{" "}
                  <span className="font-semibold text-ink">
                    {formaterMontant(detail.totalResteAPayer)}
                  </span>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink/10 text-xs uppercase text-ink-soft">
                        <th className="px-3 py-2 font-medium">Candidat</th>
                        <th className="px-3 py-2 font-medium">Téléphone</th>
                        <th className="px-3 py-2 font-medium">N° reçu</th>
                        <th className="px-3 py-2 font-medium">Dans le groupe depuis</th>
                        <th className="px-3 py-2 font-medium">Fin de formation</th>
                        <th className="px-3 py-2 text-right font-medium">Reste à payer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.candidats.map((c) => (
                        <tr key={c.inscriptionId} className="border-b border-ink/5">
                          <td className="px-3 py-2.5 font-medium text-ink">
                            {c.candidatId ? (
                              <Link href={`/candidats/${c.candidatId}`} className="hover:underline">
                                {c.prenom} {c.nom}
                              </Link>
                            ) : (
                              `${c.prenom} ${c.nom}`
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-ink-soft">{c.telephone}</td>
                          <td className="px-3 py-2.5 text-ink-soft">{c.numeroRecu}</td>
                          <td className="px-3 py-2.5 text-ink-soft">
                            {formaterDate(c.dateEntreeGroupe)}
                          </td>
                          <td className="px-3 py-2.5 text-ink-soft">{formaterDate(c.dateFin)}</td>
                          <td
                            className={
                              "px-3 py-2.5 text-right font-medium " +
                              (c.resteAPayer > 0 ? "text-error" : "text-accent")
                            }
                          >
                            {c.resteAPayer > 0 ? formaterMontant(c.resteAPayer) : "Soldé"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}