"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import { BadgePlan, CarteChiffre, ICONES, Notification } from "../components/SuperAdminUI";
import DialoguePlanCentre from "../components/DialoguePlanCentre";

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
  // Logo du centre (lien temporaire), null s'il n'en a pas
  logoUrl?: string | null;
  // Abonnement
  plan?: string;
  finAbonnement?: string;
  offre?: { fin?: string } | null;
};

/** Logo du centre, ou ses initiales s'il n'a pas de logo (ou si l'image ne charge pas) */
function LogoCentre({ centre }: { centre: Centre }) {
  const [enErreur, setEnErreur] = useState(false);
  if (centre.logoUrl && !enErreur) {
    return (
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/10 bg-white p-1 sm:flex">
        <img
          src={centre.logoUrl}
          alt={`Logo de ${centre.nom}`}
          className="h-full w-full object-contain"
          onError={() => setEnErreur(true)}
        />
      </span>
    );
  }
  return (
    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white sm:flex">
      {initiales(centre.nom)}
    </span>
  );
}

/** Ce qu'il faut savoir sur l'abonnement (offert, payé jusqu'au…, grâce, lecture seule) */
function etatPlan(centre: Centre): { texte: string; classe: string } | null {
  const code = centre.plan || "gratuit";
  const jour = (valeur: string) =>
    new Date(valeur).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  if (centre.offre?.fin) return { texte: `offert jusqu'au ${jour(centre.offre.fin)}`, classe: "text-seal" };
  if (code === "gratuit") return null;
  if (!centre.finAbonnement) return { texte: "sans date de fin", classe: "text-ink-soft" };
  const fin = new Date(centre.finAbonnement).getTime();
  const maintenant = Date.now();
  if (maintenant <= fin) return { texte: `jusqu'au ${jour(centre.finAbonnement)}`, classe: "text-ink-soft" };
  if (maintenant <= fin + 7 * 24 * 60 * 60 * 1000) return { texte: "période de grâce", classe: "text-seal" };
  return { texte: "lecture seule", classe: "text-error" };
}

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
  "w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";
const labelClass = "mb-1.5 block text-sm font-medium text-ink-soft";

/** Initiales d'un centre ("Centre Excellence" → "CE") */
function initiales(nom: string) {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((mot) => mot.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

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

function PageCentres() {
  const router = useRouter();
  const parametres = useSearchParams();
  // Centre dont on change le plan (fenêtre « Changer le plan »).
  // Les pages Paiements et À suivre l'ouvrent avec ?plan=<id du centre>.
  const [centrePlan, setCentrePlan] = useState<string | null>(parametres.get("plan"));
  const [pret, setPret] = useState(false);
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

  if (!pret) return null;

  const nombreActifs = centres.filter((c) => c.statut === "actif").length;

  const nombreSuspendus = centres.length - nombreActifs;

  function PastilleStatut({ statut }: { statut: Centre["statut"] }) {
    const actif = statut === "actif";
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          actif ? "bg-accent/10 text-accent" : "bg-error/10 text-error"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${actif ? "bg-accent" : "bg-error"}`} />
        {actif ? "Actif" : "Suspendu"}
      </span>
    );
  }

  function ActionsCentre({ centre }: { centre: Centre }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => ouvrirModification(centre)}
          className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
        >
          Modifier
        </button>
        <button
          onClick={() => changerStatut(centre)}
          className={
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition " +
            (centre.statut === "actif"
              ? "bg-seal/15 text-ink hover:bg-seal/25"
              : "bg-accent/10 text-accent hover:bg-accent/20")
          }
        >
          {centre.statut === "actif" ? "Suspendre" : "Réactiver"}
        </button>
        {/* Un centre qui a déjà facturé ne peut pas être supprimé */}
        {centre.nombreFactures === 0 && (
          <button
            onClick={() => supprimerCentre(centre)}
            className="rounded-lg bg-error/10 px-3 py-1.5 text-xs font-semibold text-error transition hover:bg-error/20"
          >
            Supprimer
          </button>
        )}
      </div>
    );
  }
  const nombrePayants = centres.filter((c) => (c.plan ?? "gratuit") !== "gratuit" && !c.offre?.fin).length;

  return (
    <>
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-seal">HREFF</p>
            <h1 className="mt-1 text-3xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Centres
            </h1>
            <p className="mt-1 text-sm text-ink-soft">Tous les centres qui utilisent la plateforme.</p>
          </div>
          <button
            onClick={() => {
              setFormulaireOuvert(!formulaireOuvert);
              setModification(null);
              setErreur("");
              setSucces("");
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.97] ${
              formulaireOuvert
                ? "border border-ink/15 bg-white text-ink hover:bg-ink/5"
                : "bg-accent text-white hover:bg-accent-hover hover:shadow-md"
            }`}
          >
            {formulaireOuvert ? (
              "Annuler"
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                Créer un centre
              </>
            )}
          </button>
        </div>

        {/* Chiffres clés */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CarteChiffre titre="Centres" valeur={String(centres.length)} detail="au total" icone={ICONES.centres} couleur="ink" />
          <CarteChiffre titre="Actifs" valeur={String(nombreActifs)} detail="peuvent se connecter" icone={ICONES.centres} />
          <CarteChiffre titre="Payants" valeur={String(nombrePayants)} detail="plan Standard, Pro ou Sur mesure" icone={ICONES.argent} couleur="seal" />
          <CarteChiffre titre="Suspendus" valeur={String(nombreSuspendus)} detail="connexion bloquée" icone={ICONES.pause} couleur="error" />
        </div>

        <Notification message={erreur} type="erreur" onFermer={() => setErreur("")} />
        <Notification message={succes} type="succes" onFermer={() => setSucces("")} />

        {formulaireOuvert && (
          <form
            onSubmit={creerCentre}
            className="mb-8 grid gap-4 rounded-2xl border border-accent/25 bg-white p-6 shadow-md sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <h2 className="text-lg font-semibold text-ink">Nouveau centre</h2>
              <p className="text-sm text-ink-soft">Le centre et son premier administrateur.</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-seal sm:col-span-2">Le centre</p>
            <div>
              <label className={labelClass}>Nom du centre *</label>
              <input
                required
                value={formulaire.nom}
                onChange={(e) => setFormulaire({ ...formulaire, nom: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ville</label>
              <input
                value={formulaire.ville}
                onChange={(e) => setFormulaire({ ...formulaire, ville: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>Téléphone</label>
              <input
                value={formulaire.telephone}
                onChange={(e) => setFormulaire({ ...formulaire, telephone: e.target.value })}
                className={champClass}
              />
            </div>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.15em] text-seal sm:col-span-2">
              Son administrateur
            </p>
            <div>
              <label className={labelClass}>Nom *</label>
              <input
                required
                value={formulaire.adminNom}
                onChange={(e) => setFormulaire({ ...formulaire, adminNom: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                required
                type="email"
                value={formulaire.adminEmail}
                onChange={(e) => setFormulaire({ ...formulaire, adminEmail: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>
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
                className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {envoiEnCours ? "Création en cours..." : "Créer le centre"}
              </button>
            </div>
          </form>
        )}

        {modification && (
          <form
            onSubmit={enregistrerModification}
            className="mb-8 grid gap-4 rounded-2xl border border-accent/25 bg-white p-6 shadow-md sm:grid-cols-2"
          >
            <h2 className="text-lg font-semibold text-ink sm:col-span-2">
              Modifier « {modification.nom} »
            </h2>
            <div>
              <label className={labelClass}>Nom du centre *</label>
              <input
                required
                value={modification.nom}
                onChange={(e) => setModification({ ...modification, nom: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>Ville</label>
              <input
                value={modification.ville}
                onChange={(e) => setModification({ ...modification, ville: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>Téléphone</label>
              <input
                value={modification.telephone}
                onChange={(e) => setModification({ ...modification, telephone: e.target.value })}
                className={champClass}
              />
            </div>
            <div>
              <label className={labelClass}>
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
                className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {envoiEnCours ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => setModification(null)}
                className="rounded-xl border border-ink/15 px-6 py-3 text-sm font-semibold text-ink transition hover:bg-ink/5"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {chargement && <p className="py-8 text-center text-ink-soft">Chargement...</p>}
        {!chargement && centres.length === 0 && (
          <p className="rounded-2xl border border-ink/10 bg-white py-10 text-center text-ink-soft">Aucun centre.</p>
        )}

        {!chargement && centres.length > 0 && (
          // Tableau qui tient toujours dans la largeur : sur petit écran, les
          // colonnes moins utiles se cachent (leurs infos passent sous le nom)
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-ink/10 bg-paper text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="w-[38%] px-3 py-3.5 font-semibold sm:px-4 lg:w-[22%]">Centre</th>
                  <th className="hidden px-4 py-3.5 font-semibold lg:table-cell lg:w-[22%]">Administrateur</th>
                  <th className="w-[30%] px-3 py-3.5 font-semibold sm:px-4 lg:w-[15%]">Plan</th>
                  <th className="w-[32%] px-3 py-3.5 font-semibold sm:px-4 md:w-[18%] lg:w-[13%]">Changer le plan</th>
                  <th className="hidden px-4 py-3.5 font-semibold md:table-cell md:w-[10%] lg:w-[8%]">Factures</th>
                  <th className="hidden px-4 py-3.5 font-semibold md:table-cell md:w-[12%] lg:w-[9%]">Statut</th>
                  <th className="hidden px-4 py-3.5 font-semibold sm:table-cell sm:w-[20%] lg:w-[11%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {centres.map((centre) => (
                  <tr key={centre._id} className="border-b border-ink/5 align-top transition last:border-0 hover:bg-paper/70">
                    <td className="px-3 py-4 sm:px-4">
                      <div className="flex items-center gap-3">
                        <LogoCentre centre={centre} />
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-ink">{centre.nom}</p>
                          <p className="text-xs text-ink-soft">
                            {centre.ville || "—"} · créé le {new Date(centre.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                          {/* Petits écrans : l'administrateur, le statut et les actions passent ici */}
                          <p className="mt-1 break-all text-xs text-ink-soft lg:hidden">{centre.admin?.email ?? "—"}</p>
                          <div className="mt-2 md:hidden">
                            <PastilleStatut statut={centre.statut} />
                          </div>
                          <div className="mt-2 sm:hidden">
                            <ActionsCentre centre={centre} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 lg:table-cell">
                      <p className="break-all text-ink">{centre.admin?.email ?? "—"}</p>
                      <p className="text-xs text-ink-soft">{centre.telephone || "—"}</p>
                      {centre.admin && !centre.admin.emailVerifie && (
                        <p className="text-xs text-seal">Email non vérifié</p>
                      )}
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <BadgePlan code={centre.plan || "gratuit"} />
                      {etatPlan(centre) && (
                        <p className={`mt-1 text-xs ${etatPlan(centre)!.classe}`}>{etatPlan(centre)!.texte}</p>
                      )}
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <button
                        onClick={() => setCentrePlan(centre._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover active:scale-[0.97]"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
                          <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Changer
                      </button>
                    </td>
                    <td className="hidden px-4 py-4 font-semibold text-ink md:table-cell">{centre.nombreFactures}</td>
                    <td className="hidden px-4 py-4 md:table-cell">
                      <PastilleStatut statut={centre.statut} />
                    </td>
                    <td className="hidden px-4 py-4 sm:table-cell">
                      <ActionsCentre centre={centre} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fenêtre « Changer le plan » */}
        {centrePlan && (
          <DialoguePlanCentre
            centreId={centrePlan}
            nomCentre={centres.find((c) => c._id === centrePlan)?.nom ?? "Centre"}
            onFermer={() => {
              setCentrePlan(null);
              router.replace("/super-admin");
            }}
            onEnregistre={(message) => {
              setCentrePlan(null);
              router.replace("/super-admin");
              setSucces(message);
              chargerCentres();
            }}
          />
        )}
      </main>
    </>
  );
}

export default function SuperAdminPage() {
  return (
    <Suspense>
      <PageCentres />
    </Suspense>
  );
}