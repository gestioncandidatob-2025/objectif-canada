import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/** Réponse de CamPay sur l'état d'une transaction */
export interface TransactionCampay {
  reference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | string;
  amount?: number | string;
  currency?: string;
  operator?: string;
  external_reference?: string;
  reason?: string;
}

// Adresse de test par défaut. En production : https://www.campay.net/api
const URL_DEMO = 'https://demo.campay.net/api';

/**
 * Communication avec CamPay (paiement Mobile Money MTN / Orange, et carte).
 *
 * Variables d'environnement (jamais dans le code ni sur GitHub) :
 *   CAMPAY_BASE_URL     https://demo.campay.net/api (test) ou https://www.campay.net/api (réel)
 *   CAMPAY_USERNAME     "App username" de l'application CamPay
 *   CAMPAY_PASSWORD     "App password" de l'application CamPay
 *   CAMPAY_WEBHOOK_KEY  "Webhook key" : vérifie que les notifications viennent bien de CamPay
 */
@Injectable()
export class CampayService {
  private readonly logger = new Logger(CampayService.name);
  private readonly jwt = new JwtService();

  // Jeton de connexion à CamPay, gardé en mémoire jusqu'à son expiration
  private jeton: string | null = null;
  private expirationJeton = 0;

  constructor(private readonly config: ConfigService) {}

  /** CamPay est-il configuré sur ce serveur ? */
  estConfigure() {
    return Boolean(this.config.get<string>('CAMPAY_USERNAME') && this.config.get<string>('CAMPAY_PASSWORD'));
  }

  private urlDeBase() {
    return (this.config.get<string>('CAMPAY_BASE_URL') || URL_DEMO).replace(/\/+$/, '');
  }

  /** Demande un paiement Mobile Money : le client reçoit une demande de code PIN sur son téléphone */
  async demanderPaiementMobile(params: {
    montant: number;
    telephone: string;
    description: string;
    referenceExterne: string;
  }): Promise<{ reference: string; ussdCode?: string; operateur?: string }> {
    const data = await this.appeler('POST', '/collect/', {
      amount: String(Math.round(params.montant)),
      currency: 'XAF',
      from: params.telephone,
      description: params.description,
      external_reference: params.referenceExterne,
    });
    return { reference: data.reference, ussdCode: data.ussd_code, operateur: data.operator };
  }

  /** Crée un lien vers la page de paiement par carte de CamPay */
  async creerLienPaiementCarte(params: {
    montant: number;
    description: string;
    referenceExterne: string;
    urlRetour: string;
    urlEchec: string;
    email?: string;
  }): Promise<{ lien: string; reference?: string }> {
    const data = await this.appeler('POST', '/get_payment_link/', {
      amount: String(Math.round(params.montant)),
      currency: 'XAF',
      description: params.description,
      external_reference: params.referenceExterne,
      redirect_url: params.urlRetour,
      failure_redirect_url: params.urlEchec,
      payment_options: 'CARD',
      ...(params.email ? { email: params.email } : {}),
    });
    if (!data.link) {
      throw new HttpException("CamPay n'a pas renvoyé de lien de paiement", HttpStatus.BAD_GATEWAY);
    }
    return { lien: data.link, reference: data.reference };
  }

  /** Demande à CamPay où en est une transaction (la seule source sûre) */
  async etatTransaction(reference: string): Promise<TransactionCampay | null> {
    try {
      const data = await this.appeler('GET', `/transaction/${encodeURIComponent(reference)}/`);
      return data?.status ? (data as TransactionCampay) : null;
    } catch (erreur) {
      this.logger.warn(`État de la transaction ${reference} illisible : ${String(erreur)}`);
      return null;
    }
  }

  /**
   * Vérifie la signature d'une notification CamPay (un jeton JWT signé avec
   * la "webhook key"). Sans clé configurée, on ne peut pas vérifier : la
   * notification sert alors seulement de signal, et l'état est redemandé à CamPay.
   */
  signatureValide(signature?: string): boolean {
    const cle = this.config.get<string>('CAMPAY_WEBHOOK_KEY');
    if (!cle) return true;
    if (!signature) return false;
    try {
      this.jwt.verify(signature, { secret: cle, algorithms: ['HS256'] });
      return true;
    } catch {
      return false;
    }
  }

  // ---------- Appels HTTP ----------

  private async obtenirJeton(): Promise<string> {
    if (this.jeton && Date.now() < this.expirationJeton) return this.jeton;

    const res = await this.envoyer(`${this.urlDeBase()}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.config.get<string>('CAMPAY_USERNAME'),
        password: this.config.get<string>('CAMPAY_PASSWORD'),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; expires_in?: number };
    if (!res.ok || !data.token) {
      this.logger.warn(`Connexion à CamPay refusée (${res.status})`);
      throw new HttpException(
        'Connexion à CamPay refusée : vérifie CAMPAY_USERNAME et CAMPAY_PASSWORD',
        HttpStatus.BAD_GATEWAY,
      );
    }
    this.jeton = data.token;
    // On renouvelle le jeton une minute avant son expiration
    this.expirationJeton = Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1000;
    return this.jeton;
  }

  private async appeler(methode: 'GET' | 'POST', chemin: string, corps?: Record<string, unknown>) {
    if (!this.estConfigure()) {
      throw new HttpException(
        "Le paiement en ligne n'est pas encore configuré",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const jeton = await this.obtenirJeton();
    const res = await this.envoyer(`${this.urlDeBase()}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${jeton}` },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    });

    const texte = await res.text();
    let data: any = {};
    try {
      data = texte ? JSON.parse(texte) : {};
    } catch {
      data = {};
    }

    if (res.status === 401) {
      // Jeton expiré trop tôt : on l'oublie, le prochain appel en redemandera un
      this.jeton = null;
    }
    if (!res.ok) {
      this.logger.warn(`CamPay a répondu ${res.status} sur ${chemin} : ${texte.slice(0, 300)}`);
      throw new HttpException(this.messageErreur(data), HttpStatus.BAD_GATEWAY);
    }
    return data;
  }

  private async envoyer(url: string, options: RequestInit) {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    } catch (erreur) {
      this.logger.warn(`CamPay injoignable : ${String(erreur)}`);
      throw new HttpException(
        "Le serveur n'arrive pas à joindre CamPay, réessaie",
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** Traduit les codes d'erreur de CamPay en phrases simples */
  private messageErreur(data: { error_code?: string; message?: string }) {
    switch (data?.error_code) {
      case 'ER101':
        return 'Numéro de téléphone invalide';
      case 'ER102':
        return 'Seuls les numéros MTN et Orange sont acceptés';
      case 'ER201':
        return 'Montant invalide';
      case 'ER301':
        return 'Solde insuffisant';
      default:
        return 'CamPay a refusé la demande de paiement, réessaie';
    }
  }
}