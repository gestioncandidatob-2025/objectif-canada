// Traduction des messages envoyés par le serveur.
// Le serveur répond toujours en français ; si l'interface est en anglais,
// on remplace le message par sa version anglaise. Un message inconnu reste tel quel.

const MESSAGES_EN: Record<string, string> = {
  // Connexion et compte
  "Email ou mot de passe incorrect": "Incorrect email or password",
  "Ce centre est suspendu. Contacte HREFF pour le réactiver.":
    "This centre is suspended. Contact HREFF to reactivate it.",
  "Email invalide": "Invalid email",
  "Le mot de passe est obligatoire": "Password is required",
  "Le mot de passe doit contenir au moins 8 caractères, avec 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial":
    "The password must have at least 8 characters, with 1 uppercase letter, 1 lowercase letter, 1 digit and 1 special character",
  "Ce mot de passe a déjà été utilisé. Choisis-en un différent.":
    "This password has already been used. Choose a different one.",
  "Le nouveau mot de passe est obligatoire": "The new password is required",
  "Le code est obligatoire": "The code is required",
  "Le code doit contenir 6 chiffres": "The code must have 6 digits",
  "Code de vérification invalide": "Invalid verification code",
  "Code de réinitialisation invalide": "Invalid reset code",
  "Ce code a expiré, demande-en un nouveau": "This code has expired, request a new one",
  "Ce code a expiré, refais une demande": "This code has expired, make a new request",
  "Cet email est déjà vérifié": "This email is already verified",
  "Email vérifié avec succès": "Email verified",
  "Un nouveau code de vérification a été envoyé": "A new verification code has been sent",
  "Si cet email existe, un code de réinitialisation a été envoyé":
    "If this email exists, a reset code has been sent",
  "Mot de passe réinitialisé avec succès": "Password reset",
  "Déconnecté avec succès": "Logged out",

  // Centre
  "Centre introuvable": "Centre not found",
  "Un centre porte déjà ce nom": "A centre already has this name",
  "Le nom du centre est obligatoire": "The centre name is required",
  "Le nom du centre ne peut pas être vide": "The centre name cannot be empty",
  "Cette action nécessite d'être rattaché à un centre":
    "This action requires being linked to a centre",
  "Mode de paiement invalide": "Invalid payment method",
  "Ce mode de paiement n'est pas accepté par le centre (voir Paramètres → Paiements)":
    "This payment method is not accepted by the centre (see Settings → Payments)",

  // Utilisateurs
  "Utilisateur introuvable": "User not found",
  "Un utilisateur avec cet email existe déjà": "A user with this email already exists",
  "Un compte existe déjà avec cet email": "An account already exists with this email",
  "Rôle invalide": "Invalid role",
  "Le nom est obligatoire": "The name is required",
  "Le prénom est obligatoire": "The first name is required",
  "Le téléphone est obligatoire": "The phone number is required",

  // Candidats et factures
  "Candidat introuvable": "Candidate not found",
  "Inscription introuvable": "Registration not found",
  "L'identifiant du candidat est obligatoire": "The candidate ID is required",
  "Le service est obligatoire": "The service is required",
  "Le régime est obligatoire pour ce service": "The schedule is required for this service",
  "Le montant négocié est obligatoire pour ce service":
    "The negotiated amount is required for this service",
  "La date de fin est obligatoire pour ce service": "The end date is required for this service",
  "Date de fin invalide": "Invalid end date",
  "Date de début du test invalide": "Invalid test start date",
  "Le montant payé ne peut pas être négatif": "The amount paid cannot be negative",
  "Le montant payé ne peut pas dépasser le montant total":
    "The amount paid cannot exceed the total amount",
  "La remise ne peut pas être négative": "The discount cannot be negative",
  "La remise ne peut pas dépasser le montant total": "The discount cannot exceed the total amount",
  "Le montant du paiement doit être positif": "The payment amount must be positive",
  "Le montant doit être positif": "The amount must be positive",
  "Ce paiement dépasserait le montant total dû": "This payment would exceed the total amount due",
  "La raison de la modification est obligatoire": "The reason for the change is required",
  'Le champ "facturé par" est obligatoire': 'The "invoiced by" field is required',
  "La facture n'a pas pu être générée ou stockée": "The invoice could not be generated or stored",
  "Impossible de générer le lien de la facture (vérifie la configuration AWS)":
    "Unable to create the invoice link (check the AWS settings)",
  "Aucune offre active n'est configurée pour ce service. Va dans la page Tarifs pour créer ou activer cette offre.":
    "No active offer is set up for this service. Go to the Prices page to create or activate it.",

  // Tarifs
  "Offre introuvable": "Offer not found",
  "Offre supprimée": "Offer deleted",
  "Le prix ne peut pas être négatif": "The price cannot be negative",
  "Le prix est obligatoire (sauf si le montant est négociable)":
    "The price is required (unless the amount is negotiable)",
  "La durée ne peut pas être négative": "The duration cannot be negative",
  "La durée en jours est obligatoire (sauf si la date de fin est saisie manuellement)":
    "The duration in days is required (unless the end date is entered manually)",
  "Il faut au moins un régime": "At least one schedule is required",
};

// Messages qui contiennent une valeur (montant, nom, nombre)
const MODELES_EN: [RegExp, (...valeurs: string[]) => string][] = [
  [
    /^Le régime "(.+)" n'existe pas pour ce service\.$/,
    (regime) => `The schedule "${regime}" does not exist for this service.`,
  ],
  [
    /^Le montant payé doit être supérieur à (.+) FCFA pour enregistrer une inscription$/,
    (min) => `The amount paid must be more than ${min} FCFA to save a registration`,
  ],
  [
    /^Le montant payé doit être supérieur à (.+) FCFA$/,
    (min) => `The amount paid must be more than ${min} FCFA`,
  ],
  [
    /^Ce service coûte (.+) FCFA \(moins de (.+) FCFA\) : il doit être payé intégralement à l'inscription$/,
    (prix, min) =>
      `This service costs ${prix} FCFA (less than ${min} FCFA): it must be paid in full at registration`,
  ],
  [
    /^Ce service coûte (.+) FCFA : il doit être payé intégralement$/,
    (prix) => `This service costs ${prix} FCFA: it must be paid in full`,
  ],
  [
    /^Ce service a déjà été utilisé sur (\d+) facture\(s\) : il a été désactivé au lieu d'être supprimé\.$/,
    (nombre) =>
      `This service has already been used on ${nombre} invoice(s): it was deactivated instead of deleted.`,
  ],
];

function langueChoisie(): string {
  if (typeof window === "undefined") return "fr";
  try {
    return localStorage.getItem("langue") ?? "fr";
  } catch {
    return "fr";
  }
}

// Traduit un seul message (si l'interface est en anglais)
export function traduireMessageServeur(message: string): string {
  if (langueChoisie() !== "en" || typeof message !== "string") return message;
  // Les espaces spéciaux des montants (65 000) deviennent des espaces normaux
  const texte = message.replace(/[  ]/g, " ").trim();
  if (MESSAGES_EN[texte]) return MESSAGES_EN[texte];
  for (const [modele, traduire] of MODELES_EN) {
    const trouve = texte.match(modele);
    if (trouve) return traduire(...trouve.slice(1));
  }
  return message;
}

// Traduit le champ "message" d'une réponse (texte seul ou liste de textes)
export function traduireReponse<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  const objet = data as Record<string, unknown>;
  if (typeof objet.message === "string") {
    return { ...objet, message: traduireMessageServeur(objet.message) } as T;
  }
  if (Array.isArray(objet.message)) {
    return {
      ...objet,
      message: objet.message.map((m) => (typeof m === "string" ? traduireMessageServeur(m) : m)),
    } as T;
  }
  return data;
}