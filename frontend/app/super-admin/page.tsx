"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

/**
 * Espace super admin (équipe HREFF) — version simple.
 * Liste des centres, création d'un centre avec son administrateur,
 * suspension / réactivation. À compléter au jalon « Abonnements ».
 */

type Centre = {
  _id: string;
  nom: string;
  ville?: string;
  telephone?: string;
  statut: "actif" | "suspendu";
  createdAt: string;
  nombreFactures: number;
  nombreUtilisateurs: number;
  admin: { id: string; nom: string; email: string; emailVerifie: boolean } | null;
};

type Modification = {
  id: string;
  nom: string;
  ville: string;
  telephone: string;
  adminEmail: string;
  adminEmailInitial: string;
};

const FORMULAIRE_VIDE = {
  nom: "",
  ville: "",
  telephone: "",
  adminNom: "",
  adminEmail: "",
  adminMotDePasse: "",
};

const champClass =
  "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

/** Transforme une réponse d'erreur de l'API en message lisible */
async function messageErreur(res: Response) {
  try {
    const data = await res.json();
    if (Array.isArray(data.message)) return data.message.join(" — ");
    return data.message || "Une erreur est survenue";
  } catch {
    return "Une erreur est survenue";
  }
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [centres, setCentres] = useState<Centre[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [modification, setModification] = useState<Modification | null>(null);

  // Seul le super admin a accès à cette page
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token || !userStr) {
      router.replace("/login");
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== "super_admin") {
      router.replace("/bienvenue");
      return;
    }
    setNomUtilisateur(user.nom);
    setPret(true);
  }, [router]);

  const chargerCentres = useCallback(async () => {
    setChargement(true);
    const res = await apiFetch("/centers");
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setErreur(await messageErreur(res));
    } else {
      setCentres(await res.json());
    }
    setChargement(false);
  }, [router]);

  useEffect(() => {
    if (pret) chargerCentres();
  }, [pret, chargerCentres]);

  async function creerCentre(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setSucces("");
    setEnvoiEnCours(true);

    // On n'envoie pas les champs facultatifs laissés vides
    const corps = Object.fromEntries(
      Object.entries(formulaire).filter(([, valeur]) => valeur.trim() !== ""),
    );

    const res = await apiFetch("/centers", {
      method: "POST",
      body: JSON.stringify(corps),
    });
    setEnvoiEnCours(false);

    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces(
      `Centre « ${formulaire.nom} » créé. Un code de vérification a été envoyé à ${formulaire.adminEmail}.`,
    );
    setFormulaire(FORMULAIRE_VIDE);
    setFormulaireOuvert(false);
    chargerCentres();
  }

  async function changerStatut(centre: Centre) {
    const nouveauStatut = centre.statut === "actif" ? "suspendu" : "actif";
    const confirmation =
      nouveauStatut === "suspendu"
        ? `Suspendre « ${centre.nom} » ? Ses utilisateurs ne pourront plus se connecter.`
        : `Réactiver « ${centre.nom} » ?`;
    if (!window.confirm(confirmation)) return;

    setErreur("");
    setSucces("");
    const res = await apiFetch(`/centers/${centre._id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ statut: nouveauStatut }),
    });
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    chargerCentres();
  }

  function ouvrirModification(centre: Centre) {
    setErreur("");
    setSucces("");
    setFormulaireOuvert(false);
    setModification({
      id: centre._id,
      nom: centre.nom,
      ville: centre.ville ?? "",
      telephone: centre.telephone ?? "",
      adminEmail: centre.admin?.email ?? "",
      adminEmailInitial: centre.admin?.email ?? "",
    });
  }

  async function enregistrerModification(e: React.FormEvent) {
    e.preventDefault();
    if (!modification) return;
    setErreur("");
    setSucces("");
    setEnvoiEnCours(true);

    const corps: Record<string, string> = {
      nom: modification.nom,
      ville: modification.ville,
      telephone: modification.telephone,
    };
    const emailChange =
      modification.adminEmail.trim() !== "" &&
      modification.adminEmail.trim() !== modification.adminEmailInitial;
    if (emailChange) corps.adminEmail = modification.adminEmail.trim();

    const res = await apiFetch(`/centers/${modification.id}`, {
      method: "PATCH",
      body: JSON.stringify(corps),
    });
    setEnvoiEnCours(false);

    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces(
      emailChange
        ? `Centre modifié. Un nouveau code de vérification a été envoyé à ${modification.adminEmail.trim()}.`
        : "Centre modifié.",
    );
    setModification(null);
    chargerCentres();
  }

  async function supprimerCentre(centre: Centre) {
    if (
      !window.confirm(
        `Supprimer définitivement « ${centre.nom} » et ses ${centre.nombreUtilisateurs} compte(s) ? Cette action est irréversible.`,
      )
    )
      return;

    setErreur("");
    setSucces("");
    const res = await apiFetch(`/centers/${centre._id}`, { method: "DELETE" });
    if (!res.ok) {
      setErreur(await messageErreur(res));
      return;
    }
    setSucces(`Centre « ${centre.nom} » supprimé.`);
    if (modification?.id === centre._id) setModification(null);
    chargerCentres();
  }

  function deconnexion() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  }

  if (!pret) return null;

  const nombreActifs = centres.filter((c) => c.statut === "actif").length;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">
              HREFF
            </p>
            <h1 className="text-xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Espace super admin
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-ink-soft sm:inline">{nomUtilisateur}</span>
            <button
              onClick={deconnexion}
              className="rounded-lg border border-ink/15 px-3 py-2 text-ink transition hover:bg-ink/5"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Centres
            </h2>
            <p className="text-sm text-ink-soft">
              {centres.length} centre(s) — {nombreActifs} actif(s)
            </p>
          </div>
          <button
            onClick={() => {
              setFormulaireOuvert(!formulaireOuvert);
              setModification(null);
              setErreur("");
              setSucces("");
            }}
            className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover"
          >
            {formulaireOuvert ? "Annuler" : "+ Créer un centre"}
          </button>
        </div>

        {erreur && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{erreur}</p>
        )}
        {succes && (
          <p className="mb-4 rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent">{succes}</p>
        )}

        {formulaireOuvert && (
          <form
            onSubmit={creerCentre}
            className="mb-8 grid gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <p className="text-sm font-semibold text-ink sm:col-span-2">Le centre</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Nom du centre *</label>
              <input
                required
                value={formulaire.nom}
                onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Ville</label>
              <input
                value={formulaire.ville}
                onChange={(e) => setFormulaire({ ...formulaire, ville: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Téléphone</label>
              <input
                value={formulaire.telephone}
                onChange={(e) => setFormulaire({ ...formulaire, telephone: e.target.value })}
                className={champClass}
              />
            </div>

            <p className="mt-2 text-sm font-semibold text-ink sm:col-span-2">
              Son administrateur
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Nom *</label>
              <input
                required
                value={formulaire.adminNom}
                onChange={(e) => setFormulaire({ ...formulaire, adminNom: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Email *</label>
              <input
                required
                type="email"
                value={formulaire.adminEmail}
                onChange={(e) => setFormulaire({ ...formulaire, adminEmail: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">
                Mot de passe provisoire *
              </label>
              <div className="relative">
                <input
                  required
                  type={motDePasseVisible ? "text" : "password"}
                  value={formulaire.adminMotDePasse}
                  onChange={(e) =>
                    setFormulaire({ ...formulaire, adminMotDePasse: e.target.value })
                  }
                  className={champClass + " pr-20"}
                />
                <button
                  type="button"
                  onClick={() => setMotDePasseVisible(!motDePasseVisible)}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-seal"
                >
                  {motDePasseVisible ? "Masquer" : "Afficher"}
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                8 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial.
              </p>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={envoiEnCours}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {envoiEnCours ? "Création en cours..." : "Créer le centre"}
              </button>
            </div>
          </form>
        )}

        {modification && (
          <form
            onSubmit={enregistrerModification}
            className="mb-8 grid gap-4 rounded-2xl border border-accent/30 bg-white p-6 shadow-sm sm:grid-cols-2"
          >
            <p className="text-sm font-semibold text-ink sm:col-span-2">
              Modifier « {modification.nom} »
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Nom du centre *</label>
              <input
                required
                value={modification.nom}
                onChange={(e) => setModification({ ...modification, nom: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Ville</label>
              <input
                value={modification.ville}
                onChange={(e) => setModification({ ...modification, ville: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Téléphone</label>
              <input
                value={modification.telephone}
                onChange={(e) => setModification({ ...modification, telephone: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">
                Email de l&apos;administrateur
              </label>
              <input
                type="email"
                value={modification.adminEmail}
                onChange={(e) => setModification({ ...modification, adminEmail: e.target.value })}
                className={champClass}
              />
              <p className="mt-1 text-xs text-ink-soft">
                Si tu le changes, un nouveau code de vérification est envoyé à la nouvelle adresse.
              </p>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={envoiEnCours}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {envoiEnCours ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => setModification(null)}
                className="rounded-lg border border-ink/15 px-5 py-2.5 text-ink transition hover:bg-ink/5"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink/10 text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-medium">Centre</th>
                <th className="px-5 py-3 font-medium">Administrateur</th>
                <th className="px-5 py-3 font-medium">Téléphone</th>
                <th className="px-5 py-3 font-medium">Factures</th>
                <th className="px-5 py-3 font-medium">Créé le</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {chargement ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-soft">
                    Chargement...
                  </td>
                </tr>
              ) : centres.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-soft">
                    Aucun centre.
                  </td>
                </tr>
              ) : (
                centres.map((centre) => (
                  <tr key={centre._id} className="border-b border-ink/5 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{centre.nom}</p>
                      <p className="text-xs text-ink-soft">{centre.ville || "—"}</p>
                    </td>
                    <td className="px-5 py-3">
                      {centre.admin ? (
                        <>
                          <p className="text-ink">{centre.admin.email}</p>
                          {!centre.admin.emailVerifie && (
                            <p className="text-xs text-seal">Email non vérifié</p>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{centre.telephone || "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">{centre.nombreFactures}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {new Date(centre.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-xs font-medium " +
                          (centre.statut === "actif"
                            ? "bg-accent/10 text-accent"
                            : "bg-error/10 text-error")
                        }
                      >
                        {centre.statut === "actif" ? "Actif" : "Suspendu"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <button
                          onClick={() => ouvrirModification(centre)}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => changerStatut(centre)}
                          className={
                            "text-sm font-medium hover:underline " +
                            (centre.statut === "actif" ? "text-seal" : "text-accent")
                          }
                        >
                          {centre.statut === "actif" ? "Suspendre" : "Réactiver"}
                        </button>
                        {/* Un centre qui a déjà facturé ne peut pas être supprimé */}
                        {centre.nombreFactures === 0 && (
                          <button
                            onClick={() => supprimerCentre(centre)}
                            className="text-sm font-medium text-error hover:underline"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}