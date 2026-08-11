"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type User = {
  _id: string;
  nom: string;
  email: string;
  role: string;
};

const LABEL_ROLE: Record<string, string> = {
  admin: "Administrateur",
  secretariat: "Secrétariat",
};

export default function UtilisateursPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [role, setRole] = useState("secretariat");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [ligneEnEdition, setLigneEnEdition] = useState<string | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editRole, setEditRole] = useState("secretariat");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null);

  async function chargerUsers() {
    setChargement(true);
    setErreur("");
    const res = await apiFetch("/users");
    if (res.ok) {
      setUsers(await res.json());
    } else {
      setErreur("Impossible de charger les utilisateurs");
    }
    setChargement(false);
  }

  useEffect(() => {
    chargerUsers();
  }, []);

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setMessage("");
    setEnvoiEnCours(true);

    const res = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({ nom, email, motDePasse, role }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnvoiEnCours(false);
      return;
    }

    setMessage("Utilisateur créé avec succès");
    setNom("");
    setEmail("");
    setMotDePasse("");
    setRole("secretariat");
    setAfficherFormulaire(false);
    setEnvoiEnCours(false);
    chargerUsers();
  }

  function ouvrirEdition(u: User) {
    setLigneEnEdition(u._id);
    setEditNom(u.nom);
    setEditRole(u.role);
  }

  async function enregistrerModification(id: string) {
    setEnregistrementEnCours(true);
    const res = await apiFetch(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nom: editNom, role: editRole }),
    });
    if (!res.ok) {
      const data = await res.json();
      setErreur(Array.isArray(data.message) ? data.message.join(", ") : data.message);
      setEnregistrementEnCours(false);
      return;
    }
    setLigneEnEdition(null);
    setEnregistrementEnCours(false);
    chargerUsers();
  }

  async function supprimer(id: string) {
    if (!window.confirm("Confirmer la suppression de cet utilisateur ?")) return;
    setSuppressionEnCours(id);
    const res = await apiFetch(`/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setErreur("Suppression impossible");
      setSuppressionEnCours(null);
      return;
    }
    setSuppressionEnCours(null);
    chargerUsers();
  }

  const champClass =
    "w-full rounded-lg border border-ink/15 px-3 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
  const labelClass = "mb-1 block text-sm font-medium text-ink-soft";

  return (
    <div className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1
            className="text-3xl text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Gestion des utilisateurs
          </h1>
          <button
            onClick={() => setAfficherFormulaire(!afficherFormulaire)}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            {afficherFormulaire ? "Annuler" : "+ Nouvel utilisateur"}
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
            <label className={labelClass}>Nom</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={champClass}
            />
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={champClass}
            />
            <label className={labelClass}>Mot de passe</label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className={champClass}
            />
            <label className={labelClass}>Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={champClass}
            >
              <option value="secretariat">Secrétariat</option>
              <option value="admin">Administrateur</option>
            </select>
            <button
              type="submit"
              disabled={envoiEnCours}
              className="w-full rounded-lg bg-accent py-2.5 font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 hover:bg-accent-hover"
            >
              {envoiEnCours ? "Création..." : "Créer l'utilisateur"}
            </button>
          </form>
        )}

        {chargement && <p className="text-sm text-ink-soft">Chargement...</p>}

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-paper text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <>
                  <tr key={u._id} className="border-b border-ink/5">
                    <td className="px-4 py-3">{u.nom}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                        {LABEL_ROLE[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="space-x-3 px-4 py-3">
                      <button
                        onClick={() => ouvrirEdition(u)}
                        className="font-medium text-seal hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => supprimer(u._id)}
                        disabled={suppressionEnCours === u._id}
                        className="font-medium text-error hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {suppressionEnCours === u._id ? "Suppression..." : "Supprimer"}
                      </button>
                    </td>
                  </tr>

                  {ligneEnEdition === u._id && (
                    <tr className="border-b border-ink/5 bg-accent/5">
                      <td colSpan={4} className="space-y-3 px-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Nom
                            </label>
                            <input
                              value={editNom}
                              onChange={(e) => setEditNom(e.target.value)}
                              className={`${champClass} bg-white`}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-ink-soft">
                              Rôle
                            </label>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className={`${champClass} bg-white`}
                            >
                              <option value="secretariat">Secrétariat</option>
                              <option value="admin">Administrateur</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => enregistrerModification(u._id)}
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
                </>
              ))}
            </tbody>
          </table>

          {users.length === 0 && !chargement && (
            <p className="px-4 py-8 text-center text-ink-soft">
              Aucun utilisateur trouvé.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}