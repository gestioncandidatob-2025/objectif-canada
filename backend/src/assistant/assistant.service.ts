import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AssistantOutilsService, DEFINITIONS_OUTILS } from './assistant-outils.service';
import {
  UtilisationAssistant,
  UtilisationAssistantDocument,
} from './schemas/utilisation-assistant.schema';
import { MessageDiscussionDto } from './dto/discussion.dto';

const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';
// llama-3.3-70b-versatile a été retiré par Groq le 16 août 2026 (compte gratuit)
const MODELE_PAR_DEFAUT = 'openai/gpt-oss-120b';
const QUESTIONS_PAR_JOUR_PAR_DEFAUT = 50;
// Nombre maximum d'allers-retours "l'IA demande un outil → on lui répond"
const TOURS_MAX = 5;
// Taille maximale d'un résultat d'outil envoyé à l'IA (en caractères)
const TAILLE_MAX_RESULTAT = 12000;

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

type MessageGroq = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
  name?: string;
};

/** Le jour à Douala (UTC+1), au format AAAA-MM-JJ, décalé de `decalageJours` */
function jourDouala(decalageJours = 0, maintenant = new Date()) {
  const local = new Date(maintenant.getTime() + 60 * 60 * 1000 + decalageJours * 24 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/** Repères de dates donnés à l'IA, pour qu'elle comprenne "hier", "cette semaine"… */
function reperesDeDates() {
  const maintenant = new Date();
  const local = new Date(maintenant.getTime() + 60 * 60 * 1000);
  const jourSemaine = local.getUTCDay();
  const decalageLundi = (jourSemaine + 6) % 7;
  return {
    aujourdhui: jourDouala(0, maintenant),
    jourSemaine: JOURS_FR[jourSemaine],
    hier: jourDouala(-1, maintenant),
    lundi: jourDouala(-decalageLundi, maintenant),
    debutMois: `${jourDouala(0, maintenant).slice(0, 8)}01`,
    heure: local.toISOString().slice(11, 16),
  };
}

function consignesSysteme(langue: 'fr' | 'en') {
  const d = reperesDeDates();
  return `Tu es l'assistant de HREFF, un logiciel de facturation pour centres de formation (TCF, TEF, IELTS, cours de langue…) au Cameroun. Tu parles à l'administrateur du centre.

Date et heure à Douala : ${d.jourSemaine} ${d.aujourdhui}, ${d.heure}.
Repères : hier = ${d.hier} ; cette semaine commence le lundi ${d.lundi} ; ce mois commence le ${d.debutMois}.

Règles :
- Pour tout chiffre (argent, factures, candidats, restes), appelle d'abord un outil. N'invente JAMAIS un chiffre, un nom ou un numéro. Si un outil ne renvoie rien, dis-le simplement.
- "Encaissé", "caisse", "recettes", "argent reçu" → outil encaissements. "Facturé", "nombre de factures", "chiffre d'affaires" → outil factures_periode. "Qui doit encore", "impayés", "restes" → outil restes_a_payer.
- Tu ne peux RIEN modifier (ni facture, ni candidat, ni paiement). Si on te le demande, explique où le faire dans l'application.
- Montants en FCFA, avec un espace entre les milliers (ex : 125 000 FCFA).
- Réponses courtes et claires, en texte simple : pas de tableau, pas de gras, pas de titres. Pour une liste, une ligne par élément qui commence par "- ".
- Ne parle que du centre et de l'application. Pour une autre demande, réponds poliment que tu n'aides que pour le centre.
- ${langue === 'en' ? 'Answer in English.' : 'Réponds en français.'}

Mode d'emploi de l'application (pour expliquer où faire les choses) :
- Nouvelle facture : bouton vert "Nouvelle facture" en haut du menu.
- Liste des candidats : menu "Liste des candidats" ; on ouvre la fiche d'un candidat pour voir ses factures et encaisser un reste à payer.
- Factures : menu "Factures", pour retrouver et réimprimer un reçu.
- Point de caisse : menu "Point de caisse", ce que chaque personne a encaissé (espèces et mobile) par jour, semaine et mois.
- Tableau de bord : statistiques du centre.
- Utilisateurs : créer ou gérer les comptes des secrétaires.
- Historique : les modifications faites sur les factures.
- Paramètres : informations du centre, logo, services et tarifs (onglet Services), modes de paiement acceptés.
- La barre de recherche en haut de chaque page trouve un candidat ou une facture par nom, téléphone ou numéro de reçu.`;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly outils: AssistantOutilsService,
    @InjectModel(UtilisationAssistant.name)
    private utilisationModel: Model<UtilisationAssistantDocument>,
  ) {}

  /** Combien de questions il reste aujourd'hui pour ce centre */
  async quota(centreId: string) {
    const limite = this.limiteParJour();
    const ligne = await this.utilisationModel.findOne({ centreId, jour: jourDouala() }).lean().exec();
    const utilisees = ligne?.questions ?? 0;
    return {
      configure: Boolean(this.config.get<string>('GROQ_API_KEY')),
      limite,
      restantes: Math.max(0, limite - utilisees),
    };
  }

  /** Répond à la dernière question de la discussion */
  async discuter(centreId: string, messages: MessageDiscussionDto[], langue: 'fr' | 'en' = 'fr') {
    const cle = this.config.get<string>('GROQ_API_KEY')?.trim().replace(/^["']|["']$/g, '');
    if (!cle) {
      throw new HttpException("L'assistant n'est pas encore configuré", HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (messages[messages.length - 1]?.role !== 'user') {
      throw new HttpException('Pose une question', HttpStatus.BAD_REQUEST);
    }

    await this.compterQuestion(centreId);

    const discussion: MessageGroq[] = [
      { role: 'system', content: consignesSysteme(langue) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const reponse = await this.appelerGroq(cle, discussion, true);

      // Pas d'outil demandé : c'est la réponse finale
      if (!reponse.tool_calls?.length) {
        return { reponse: (reponse.content ?? '').trim() };
      }

      discussion.push({ role: 'assistant', content: reponse.content ?? null, tool_calls: reponse.tool_calls });

      for (const appel of reponse.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(appel.function.arguments || '{}');
        } catch {
          args = {};
        }
        const resultat = await this.outils.executer(appel.function.name, args, centreId);
        let texte = JSON.stringify(resultat);
        if (texte.length > TAILLE_MAX_RESULTAT) texte = `${texte.slice(0, TAILLE_MAX_RESULTAT)}…(tronqué)`;
        discussion.push({
          role: 'tool',
          tool_call_id: appel.id,
          name: appel.function.name,
          content: texte,
        });
      }
    }

    // Trop d'allers-retours : on demande une réponse finale, sans outil
    const finale = await this.appelerGroq(cle, discussion, false);
    return { reponse: (finale.content ?? '').trim() };
  }

  private limiteParJour() {
    const valeur = Number(this.config.get<string>('ASSISTANT_QUESTIONS_PAR_JOUR'));
    return Number.isFinite(valeur) && valeur > 0 ? valeur : QUESTIONS_PAR_JOUR_PAR_DEFAUT;
  }

  /** Ajoute une question au compteur du jour, ou refuse si la limite est atteinte */
  private async compterQuestion(centreId: string) {
    const limite = this.limiteParJour();
    const ligne = await this.utilisationModel
      .findOneAndUpdate(
        { centreId, jour: jourDouala() },
        { $inc: { questions: 1 } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    if ((ligne?.questions ?? 0) > limite) {
      throw new HttpException(
        `Limite de ${limite} questions par jour atteinte. Réessaie demain.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async appelerGroq(cle: string, messages: MessageGroq[], avecOutils: boolean) {
    const modele = this.config.get<string>('GROQ_MODEL') || MODELE_PAR_DEFAUT;
    const corps: Record<string, unknown> = {
      model: modele,
      messages,
      temperature: 0.2,
      // Les modèles gpt-oss "réfléchissent" avant de répondre, et cette
      // réflexion compte dans max_tokens : on garde de la marge
      max_tokens: 2048,
    };
    if (modele.startsWith('openai/gpt-oss')) {
      corps.reasoning_effort = 'low';
    }
    if (avecOutils) {
      corps.tools = DEFINITIONS_OUTILS;
      corps.tool_choice = 'auto';
    }

    // Le modèle se trompe parfois dans le format d'un appel d'outil : on réessaie une fois
    for (let essai = 0; essai < 2; essai++) {
      let res: Response;
      try {
        res = await fetch(URL_GROQ, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
          body: JSON.stringify(corps),
          signal: AbortSignal.timeout(30000),
        });
      } catch (erreur) {
        this.logger.warn(`Groq injoignable : ${String(erreur)}`);
        throw new HttpException(
          "Le serveur n'arrive pas à joindre Groq (connexion internet ou délai dépassé)",
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: MessageGroq }[] };
        const message = data.choices?.[0]?.message;
        if (!message) break;
        return message;
      }

      const texte = await res.text();
      // Ne jamais écrire la clé dans les journaux : on n'affiche que la réponse de Groq
      this.logger.warn(`Groq a répondu ${res.status} : ${texte.slice(0, 300)}`);

      if (res.status === 400 && texte.includes('tool_use_failed') && essai === 0) {
        continue;
      }
      if (res.status === 429) {
        throw new HttpException(
          "L'assistant est très demandé, réessaie dans une minute",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (res.status === 401) {
        throw new HttpException(
          'La clé Groq est refusée : vérifie GROQ_API_KEY (sans guillemets ni espace)',
          HttpStatus.BAD_GATEWAY,
        );
      }
      if (res.status === 403) {
        throw new HttpException(
          "Groq refuse l'accès depuis ce réseau ou ce pays (erreur 403)",
          HttpStatus.BAD_GATEWAY,
        );
      }
      if (res.status === 404 || texte.includes('model_not_found') || texte.includes('decommissioned')) {
        throw new HttpException(
          'Modèle Groq introuvable : vérifie GROQ_MODEL',
          HttpStatus.BAD_GATEWAY,
        );
      }
      break;
    }
    throw new HttpException("L'assistant n'a pas pu répondre, réessaie", HttpStatus.BAD_GATEWAY);
  }
}