import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OptionsEnvoiEmail {
  to: string | string[];
  subject: string;
  htmlContent: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly appEnv: string;
  private readonly redirection: string[];

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY') ?? '';
    this.fromEmail = this.configService.get<string>('MAIL_FROM_EMAIL') ?? 'onboarding@resend.dev';
    this.fromName = this.configService.get<string>('MAIL_FROM_NAME') ?? 'Objectif Canada';
    this.appEnv = this.configService.get<string>('APP_ENV') ?? 'development';
    // Hors prod : tous les emails partent vers MAIL_REDIRECT_TO
    this.redirection =
      this.appEnv === 'production'
        ? []
        : (this.configService.get<string>('MAIL_REDIRECT_TO') ?? '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean);
  }

  async envoyer({ to, subject, htmlContent }: OptionsEnvoiEmail): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`RESEND_API_KEY manquant : email "${subject}" non envoyé`);
      return;
    }

    const destinatairesReels = (Array.isArray(to) ? to : [to]).filter(Boolean);
    if (destinatairesReels.length === 0) return;

    const destinataires = this.redirection.length > 0 ? this.redirection : destinatairesReels;
    if (this.appEnv !== 'production') {
      subject = `[${this.appEnv.toUpperCase()}] ${subject}`;
      if (this.redirection.length > 0) {
        htmlContent =
          `<p style="color:#b45309"><em>Email de test redirigé — destinataires d'origine : ` +
          `${destinatairesReels.join(', ')}</em></p>` + htmlContent;
      }
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
        this.logger.error(`Échec Resend (${res.status}) pour "${subject}" : ${await res.text()}`);
      }
    } catch (erreur) {
      this.logger.error(`Erreur d'envoi "${subject}" : ${(erreur as Error).message}`);
    }
  }
}