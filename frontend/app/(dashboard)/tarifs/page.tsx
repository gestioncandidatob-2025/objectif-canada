"use client";

import { useEffect, useState, Fragment } from "react";
import { apiFetch } from "../../lib/api";

type Tarif = {
  _id: string;
  service: string;
  regimes?: string[];
  prix?: number;
  dureeJours?: number;
  actif: boolean;
  dateFinNecessaire: boolean;
  remiseActive: boolean;
  regimeActif: boolean;
  montantNegociable: boolean;
};

// Libellés connus pour les services historiques ; tout nouveau service tapé
// par l'utilisateur est affiché tel quel (mis en forme automatiquement).
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

type FormulaireTarif = {
  service: string;
  regimes: string[];
  prix: string;
  dureeJours: string;
  dateFinNecessaire: boolean;
  remiseActive: boolean;
  regimeActif: boolean;
  montantNegociable: boolean;
};

const formulaireVide: FormulaireTarif = {
  service: "",
  regimes: [""],
  prix: "",
  dureeJours: "",
  dateFinNecessaire: false,
  remiseActive: false,
  regimeActif: false,
  montantNegociable: false,
};

type OptionTarif =
  | "dateFinNecessaire"
  | "remiseActive"
  | "regimeActif"
  | "montantNegociable";

type BlocOptionsProps = {
  valeurs: Pick<FormulaireTarif, OptionTarif>;
  onChange: (champ: OptionTarif, valeur: boolean) => void;
  idPrefix: string;
};

type ListeRegimesProps = {
  regimes: string[];
  onChange: (regimes: string[]) => void;
};

export default function TarifsPage() {
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [form, setForm] = useState<FormulaireTarif>(formulaireVide);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [ligneEnEdition, setLigneEnEdition] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormulaireTarif & { actif: boolean }>({
    ...formulaireVide,
    actif: true,
  });
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null);

  async function chargerTarifs() {
    setChargement(true);
    setErreur("");
    const res = await apiFetch("/tarifs");
    if (res.ok) {
      setTarifs(await res.json());
    } else {
      setErreur("Impossible de charger les offres");
    }
    setChargement(false);
  }

  useEffect(() => {
    chargerTarifs();
  }, []);

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnvoiEnCours(true);

    const regimesNettoyes = form.regimes.map((r) => r.trim()).filter(Boolean);

    const res = await apiFetch("/tarifs", {
      method: "POST",
      body: JSON.stringify({
        service: form.service,
        regimes: form.regimeActif ? regimesNettoyes : undefined,
        prix: form.montantNegociable ? undefined : Number(form.prix),
        dureeJours: form.dateFinNecessaire ? undefined : Number(form.dureeJours),
        dateFinNecessaire: form.dateFinNecessaire,
        remiseActive: form.remiseActive,
        regimeActif: form.regimeActif,
        montantNegociable: form.montantNegociable,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnvoiEnCours(false);
      return;
    }

    setMessage("Offre créée avec succès");
    setForm(formulaireVide);
    setAfficherFormulaire(false);
    setEnvoiEnCours(false);
    chargerTarifs();
  }

  function ouvrirEdition(t: Tarif) {
    setLigneEnEdition(t._id);
    setEditForm({
      service: t.service,
      regimes: t.regimes && t.regimes.length > 0 ? t.regimes : [""],
      prix: t.prix !== undefined ? String(t.prix) : "",
      dureeJours: t.dureeJours !== undefined ? String(t.dureeJours) : "",
      dateFinNecessaire: t.dateFinNecessaire,
      remiseActive: t.remiseActive,
      regimeActif: t.regimeActif,
      montantNegociable: t.montantNegociable,
      actif: t.actif,
    });
  }

  async function enregistrerModification(id: string) {
    setEnregistrementEnCours(true);
    setErreur("");
    const regimesNettoyes = editForm.regimes.map((r) => r.trim()).filter(Boolean);

    const res = await apiFetch(`/tarifs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        service: editForm.service,
        regimes: editForm.regimeActif ? regimesNettoyes : undefined,
        prix: editForm.montantNegociable ? undefined : Number(editForm.prix),
        dureeJours: editForm.dateFinNecessaire ? undefined : Number(editForm.dureeJours),
        actif: editForm.actif,
        dateFinNecessaire: editForm.dateFinNecessaire,
        remiseActive: editForm.remiseActive,
        regimeActif: editForm.regimeActif,
        montantNegociable: editForm.montantNegociable,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnregistrementEnCours(false);
      return;
    }
    setLigneEnEdition(null);
    setEnregistrementEnCours(false);
    chargerTarifs();
  }

  async function supprimerTarif(t: Tarif) {
    const confirme = window.confirm(
      `Supprimer définitivement l'offre "${formaterNomService(t.service)}" ? Cette action est irréversible.`,
    );
    if (!confirme) return;

    setSuppressionEnCours(t._id);
    setErreur("");
    const res = await apiFetch(`/tarifs/${t._id}`, { method: "DELETE" });
    setSuppressionEnCours(null);

    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      return;
    }

    setMessage("Offre supprimée");
    chargerTarifs();
  }

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";
  const checkboxLigne = "flex items-center gap-2 text-sm text-ink";

  const servicesExistants = Array.from(new Set(tarifs.map((t) => t.service)));

  function BlocOptions({ valeurs, onChange, idPrefix }: BlocOptionsProps) {
    return (
      <div className="space-y-2 rounded-lg border border-ink/10 bg-paper p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Configuration du formulaire d&apos;inscription pour ce service
        </p>
        <label className={checkboxLigne}>
          <input
            id={`${idPrefix}-regimeActif`}
            type="checkbox"
            checked={valeurs.regimeActif}
            onChange={(e) => onChange("regimeActif", e.target.checked)}
          />
          Régime nécessaire (avec date de début du test)
        </label>
        <label className={checkboxLigne}>
          <input
            id={`${idPrefix}-dateFinNecessaire`}
            type="checkbox"
            checked={valeurs.dateFinNecessaire}
            onChange={(e) => onChange("dateFinNecessaire", e.target.checked)}
          />
          Date de fin saisie manuellement (sinon calculée depuis la durée)
        </label>
        <label className={checkboxLigne}>
          <input
            id={`${idPrefix}-remiseActive`}
            type="checkbox"
            checked={valeurs.remiseActive}
            onChange={(e) => onChange("remiseActive", e.target.checked)}
          />
          Remise possible
        </label>
        <label className={checkboxLigne}>
          <input
            id={`${idPrefix}-montantNegociable`}
            type="checkbox"
            checked={valeurs.montantNegociable}
            onChange={(e) => onChange("montantNegociable", e.target.checked)}
          />
          Montant négocié librement (au lieu d&apos;un prix fixe)
        </label>
      </div>
    );
  }

  function ListeRegimes({ regimes, onChange }: ListeRegimesProps) {
    return (
      <div>
        <label className={labelClass}>Régimes proposés</label>
        <div className="space-y-2">
          {regimes.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={r}
                onChange={(e) => {
                  const copie = [...regimes];
                  copie[i] = e.target.value;
                  onChange(copie);
                }}
                placeholder="Ex : jour, soir, weekend..."
                className={champClass}
              />
              {regimes.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(regimes.filter((_, idx) => idx !== i))}
                  className="rounded-lg border border-ink/15 px-3 text-ink transition hover:bg-paper"
                  title="Retirer ce régime"
                >
                  −
                </button>
              )}
              {i === regimes.length - 1 && (
                <button
                  type="button"
                  onClick={() => onChange([...regimes, ""])}
                  className="rounded-lg border border-accent px-3 text-accent transition hover:bg-accent/10"
                  title="Ajouter un autre régime"
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1
            className="text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Offres de formation
          </h1>
          <button
            onClick={() => setAfficherFormulaire(!afficherFormulaire)}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            {afficherFormulaire ? "Annuler" : "+ Nouvelle offre"}
          </button>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-accent/10 px-3 py-2.5 text-sm text-accent">
            {message}
          </p>
        )}
        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error">
            {erreur}
          </p>
        )}

        {afficherFormulaire && (
          <form
            onSubmit={handleCreer}
            className="mb-6 space-y-3 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm"
          >
            <label className={labelClass}>Service</label>
            <input
              value={form.service}
              onChange={(e) => setForm({ ...form, service: e.target.value })}
              placeholder="Ex : tcf, ou un nouveau nom de service"
              list="liste-services"
              className={champClass}
            />
            <datalist id="liste-services">
              {servicesExistants.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="text-xs text-ink-soft">
              Tape un service existant (suggestions automatiques) ou un nouveau nom pour créer un nouveau service.
            </p>

            {form.regimeActif && (
              <ListeRegimes
                regimes={form.regimes}
                onChange={(regimes) => setForm({ ...form, regimes })}
              />
            )}

            {!form.montantNegociable && (
              <>
                <label className={labelClass}>Prix (FCFA)</label>
                <input
                  type="number"
                  value={form.prix}
                  onChange={(e) => setForm({ ...form, prix: e.target.value })}
                  className={champClass}
                />
              </>
            )}

            {!form.dateFinNecessaire && (
              <>
                <label className={labelClass}>Durée de la formation (jours)</label>
                <input
                  type="number"
                  value={form.dureeJours}
                  onChange={(e) => setForm({ ...form, dureeJours: e.target.value })}
                  className={champClass}
                />
              </>
            )}

            <BlocOptions
              valeurs={form}
              idPrefix="creation"
              onChange={(champ, valeur) => setForm({ ...form, [champ]: valeur })}
            />

            <button
              type="submit"
              disabled={envoiEnCours}
              className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent-hover"
            >
              {envoiEnCours ? "Création..." : "Créer l'offre"}
            </button>
          </form>
        )}

        {chargement && <p className="text-sm text-ink-soft">Chargement...</p>}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Régimes</th>
                <th className="px-4 py-3 font-medium">Prix</th>
                <th className="px-4 py-3 font-medium">Durée</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
             {tarifs.map((t) => (
                <Fragment key={t._id}>
                  <tr className="border-b border-ink/5">
                    <td className="px-4 py-3 font-medium text-ink">{formaterNomService(t.service)}</td>
                    <td className="px-4 py-3">{t.regimes && t.regimes.length > 0 ? t.regimes.join(", ") : "—"}</td>
                    <td className="px-4 py-3">
                      {t.montantNegociable
                        ? "Négocié"
                        : `${(t.prix ?? 0).toLocaleString("fr-FR")} FCFA`}
                    </td>
                    <td className="px-4 py-3">
                      {t.dateFinNecessaire ? "Manuelle" : `${t.dureeJours ?? 0} jours`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          t.actif
                            ? "rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                            : "rounded-full bg-error/10 px-3 py-1 text-xs font-medium text-error"
                        }
                      >
                        {t.actif ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => ouvrirEdition(t)}
                          className="font-medium text-seal hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => supprimerTarif(t)}
                          disabled={suppressionEnCours === t._id}
                          className="font-medium text-error hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {suppressionEnCours === t._id ? "Suppression..." : "Supprimer"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {ligneEnEdition === t._id && (
                    <tr className="border-b border-ink/5 bg-accent/5">
                      <td colSpan={6} className="space-y-3 px-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Service
                            </label>
                            <input
                              value={editForm.service}
                              onChange={(e) =>
                                setEditForm({ ...editForm, service: e.target.value })
                              }
                              list="liste-services"
                              className={`${champClass} bg-white`}
                            />
                          </div>
                          {!editForm.montantNegociable && (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-ink-soft">
                                Prix (FCFA)
                              </label>
                              <input
                                type="number"
                                value={editForm.prix}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, prix: e.target.value })
                                }
                                className={`${champClass} bg-white`}
                              />
                            </div>
                          )}
                          {!editForm.dateFinNecessaire && (
                            <div>
                              <label className="mb-1 block text-xs font-medium text-ink-soft">
                                Durée (jours)
                              </label>
                              <input
                                type="number"
                                value={editForm.dureeJours}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, dureeJours: e.target.value })
                                }
                                className={`${champClass} bg-white`}
                              />
                            </div>
                          )}
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Statut
                            </label>
                            <select
                              value={editForm.actif ? "actif" : "inactif"}
                              onChange={(e) =>
                                setEditForm({ ...editForm, actif: e.target.value === "actif" })
                              }
                              className={`${champClass} bg-white`}
                            >
                              <option value="actif">Active</option>
                              <option value="inactif">Inactive</option>
                            </select>
                          </div>
                        </div>

                        {editForm.regimeActif && (
                          <ListeRegimes
                            regimes={editForm.regimes}
                            onChange={(regimes) => setEditForm({ ...editForm, regimes })}
                          />
                        )}

                        <BlocOptions
                          valeurs={editForm}
                          idPrefix={`edition-${t._id}`}
                          onChange={(champ, valeur) =>
                            setEditForm({ ...editForm, [champ]: valeur })
                          }
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() => enregistrerModification(t._id)}
                            disabled={enregistrementEnCours}
                            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {enregistrementEnCours ? "Enregistrement..." : "Enregistrer"}
                          </button>
                          <button
                            onClick={() => setLigneEnEdition(null)}
                            disabled={enregistrementEnCours}
                            className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
              </Fragment>
              ))}
            </tbody>
          </table>

          {tarifs.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              Aucune offre créée pour le moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}