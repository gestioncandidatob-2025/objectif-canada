import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { HistoriqueService } from './historique.service';

const LIBELLES_ACTION: Record<string, string> = {
  POST: 'Création',
  PATCH: 'Modification',
  PUT: 'Modification',
  DELETE: 'Suppression',
};

const LIBELLES_MODULE: Record<string, string> = {
  candidates: 'Candidats',
  users: 'Utilisateurs',
  tarifs: 'Tarifs',
  factures: 'Factures',
  inscriptions: 'Inscriptions',
  auth: 'Authentification',
  subscription: 'Abonnement',
};

// Traduction des noms de champs (tous modules confondus) en libellés lisibles,
// pour dire concrètement ce qui a été touché plutôt qu'un simple nom de module.
const LIBELLES_CHAMPS: Record<string, string> = {
  nom: 'Nom',
  prenom: 'Prénom',
  telephone: 'Téléphone',
  email: 'Email',
  role: 'Rôle',
  motDePasse: 'Mot de passe',
  service: 'Service',
  regime: 'Régime',
  dateDebutTest: 'Date de début du test',
  dateFin: 'Date de fin',
  montantPaye: 'Montant payé',
  montantMobile: 'Montant Mobile Money',
  montantEspeces: 'Montant Espèces',
  modePaiement: 'Mode de paiement',
  remise: 'Remise',
  montantNegocie: 'Montant négocié',
  facturePar: 'Facturé par',
  reference: 'Référence',
  candidatId: 'Candidat',
  prix: 'Prix',
  dureeJours: 'Durée (jours)',
  actif: 'Statut actif',
  regimes: 'Régimes proposés',
  regimeActif: 'Régime activé',
  remiseActive: 'Remise activée',
  montantNegociable: 'Montant négociable',
  dateFinNecessaire: 'Date de fin nécessaire',
};

// Champs techniques à ne jamais afficher comme "élément modifié" (déjà traités
// à part, ou sans intérêt pour un humain qui relit le journal).
const CHAMPS_IGNORES = new Set(['raison']);

// Segments d'URL à ne jamais journaliser automatiquement (déjà gérés à part,
// ou non pertinents). Les questions posées à l'assistant ne sont pas des
// actions sur les données : elles ne vont pas dans le journal.
const MODULES_IGNORES = new Set(['historique', 'api', 'auth', 'assistant']);

const METHODES_JOURNALISEES = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Trouve un identifiant lisible (nom, service, email...) dans l'objet renvoyé par la route. */
function sujetLisible(reponse: any): string | undefined {
  if (!reponse || typeof reponse !== 'object') return undefined;
  if (reponse.nom && reponse.prenom) return `${reponse.nom} ${reponse.prenom}`;
  if (reponse.candidatId?.nom) {
    return `${reponse.candidatId.nom} ${reponse.candidatId.prenom ?? ''}`.trim();
  }
  if (reponse.nom) return reponse.nom;
  if (reponse.service) return reponse.service;
  if (reponse.email) return reponse.email;
  return undefined;
}

/** Décrit concrètement ce qui a été touché : champs modifiés, ou élément créé/supprimé. */
function decrireElementTouche(methode: string, body: any, reponse: any): string | undefined {
  const sujet = sujetLisible(reponse);

  if (methode === 'POST') {
    return sujet ? `Nouveau : ${sujet}` : undefined;
  }

  if (methode === 'PATCH' || methode === 'PUT') {
    const champsModifies = Object.keys(body || {})
      .filter((champ) => !CHAMPS_IGNORES.has(champ) && body[champ] !== undefined)
      .map((champ) => LIBELLES_CHAMPS[champ] || champ);
    const liste = champsModifies.length ? champsModifies.join(', ') : undefined;
    if (sujet && liste) return `${sujet} — ${liste} modifié(s)`;
    if (liste) return `${liste} modifié(s)`;
    return sujet;
  }

  if (methode === 'DELETE') {
    return sujet ? `Suppression : ${sujet}` : undefined;
  }

  return undefined;
}

@Injectable()
export class HistoriqueLogInterceptor implements NestInterceptor {
  constructor(private readonly historiqueService: HistoriqueService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const methode: string = req.method;

    if (!METHODES_JOURNALISEES.has(methode)) {
      return next.handle();
    }

    const segment = String(req.url || '')
      .split('?')[0]
      .split('/')
      .filter(Boolean)[0];

    if (!segment || MODULES_IGNORES.has(segment)) {
      return next.handle();
    }

    const utilisateur = req.user as
      | { email?: string; nom?: string; role?: string; centreId?: string }
      | undefined;

    // Seules les actions faites dans un centre sont journalisées (le journal
    // est consulté par l'administrateur du centre).
    if (!utilisateur?.email || !utilisateur.centreId) {
      return next.handle();
    }

    const module = LIBELLES_MODULE[segment] || segment;
    const chemin = String(req.url || '').split('?')[0];
    // Une impression de reçu n'est pas une création : on l'appelle par son nom
    const action = chemin.endsWith('/print')
      ? 'Impression'
      : LIBELLES_ACTION[methode] || methode;
    const route = `${methode} ${req.originalUrl || req.url}`;

    return next.handle().pipe(
      tap((reponse) => {
        const elementTouche = decrireElementTouche(methode, req.body, reponse);
        const raison = typeof req.body?.raison === 'string' ? req.body.raison : undefined;
        // Valeurs avant / après, quand la route les a fournies (correction de facture)
        const changements = Array.isArray(req.changementsHistorique)
          ? (req.changementsHistorique as { champ: string; avant: string; apres: string }[])
          : undefined;
        void this.historiqueService.enregistrer({
          centreId: utilisateur.centreId!,
          utilisateurEmail: utilisateur.email!,
          utilisateurNom: utilisateur.nom,
          role: utilisateur.role,
          action,
          module,
          route,
          statut: 'succès',
          details: [elementTouche, raison].filter(Boolean).join(' — ') || undefined,
          motif: raison,
          changements: changements?.length ? changements : undefined,
        });
      }),
      catchError((erreur) => {
        const elementTouche = decrireElementTouche(methode, req.body, undefined);
        void this.historiqueService.enregistrer({
          centreId: utilisateur.centreId!,
          utilisateurEmail: utilisateur.email!,
          utilisateurNom: utilisateur.nom,
          role: utilisateur.role,
          action,
          module,
          route,
          statut: 'échec',
          details: [elementTouche, erreur?.message].filter(Boolean).join(' — ') || undefined,
        });
        return throwError(() => erreur);
      }),
    );
  }
}