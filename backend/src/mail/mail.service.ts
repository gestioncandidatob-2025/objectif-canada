import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OptionsEnvoiEmail {
  to: string | string[];
  subject: string;
  htmlContent: string;
}

/**
 * Service générique d'envoi d'email via l'API de Resend
 * (https://api.resend.com/emails). Nécessite la variable d'environnement
 * RESEND_API_KEY. MAIL_FROM_EMAIL et MAIL_FROM_NAME sont optionnelles :
 * sans domaine vérifié sur Resend, on peut envoyer depuis
 * "onboarding@resend.dev" (valeur par défaut ci-dessous).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY') ?? '';
    this.fromEmail =
      this.configService.get<string>('MAIL_FROM_EMAIL') ?? 'onboarding@resend.dev';
    this.fromName =
      this.configService.get<string>('MAIL_FROM_NAME') ?? 'Objectif Canada';
  }

  async envoyer({ to, subject, htmlContent }: OptionsEnvoiEmail): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY manquant dans le .env : email "${subject}" non envoyé`,
      );
      return;
    }

    const destinataires = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (destinataires.length === 0) {
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: destinataires,
          subject,
          html: htmlContent,
        }),
      });

      if (!res.ok) {
        const texte = await res.text();
        this.logger.error(
          `Échec de l'envoi d'email Resend (${res.status}) pour "${subject}" : ${texte}`,
        );
      }
    } catch (erreur) {
      this.logger.error(
        `Erreur lors de l'envoi d'email "${subject}" : ${(erreur as Error).message}`,
      );
    }
  }
}