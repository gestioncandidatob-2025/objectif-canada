import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InscriptionsService } from '../inscriptions/inscriptions.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);

  constructor(
    private inscriptionsService: InscriptionsService,
    private usersService: UsersService,
    private mailService: MailService,
  ) {}

  /**
   * Tous les jours à 7h : prévient tous les opérateurs des formations dont
   * la date de fin est atteinte (aujourd'hui ou avant), une seule fois par inscription.
   */
  @Cron('0 7 * * *')
  async notifierFormationsTerminees() {
    const inscriptions = await this.inscriptionsService.trouverFormationsTermineesNonNotifiees();
    if (inscriptions.length === 0) return;

    const emails = await this.usersService.emailsTousLesUtilisateurs();
    if (emails.length === 0) return;

    for (const inscription of inscriptions) {
      const candidat: any = inscription.candidatId;

      await this.mailService.envoyer({
        to: emails,
        subject: `Formation terminée — ${candidat?.nom ?? ''} ${candidat?.prenom ?? ''}`,
        htmlContent: `
          <p>La formation d'un candidat est arrivée à échéance :</p>
          <ul>
            <li><strong>Candidat :</strong> ${candidat?.nom ?? ''} ${candidat?.prenom ?? ''}</li>
            <li><strong>Téléphone :</strong> ${candidat?.telephone ?? ''}</li>
            <li><strong>Service :</strong> ${inscription.service}${inscription.regime ? ' — ' + inscription.regime : ''}</li>
            <li><strong>Date de fin :</strong> ${new Date(inscription.dateFin).toLocaleDateString('fr-FR')}</li>
            <li><strong>Reçu N° :</strong> ${inscription.numeroRecu}</li>
          </ul>
        `,
      });

      await this.inscriptionsService.marquerFormationNotifiee(String(inscription._id));
    }

    this.logger.log(`${inscriptions.length} notification(s) de fin de formation envoyée(s)`);
  }

  /**
   * Chaque lundi et vendredi à 8h : relance les candidats ayant un reste à
   * payer depuis au moins 10 jours. Cette relance se répète tant que la
   * dette n'est pas soldée (elle réapparaîtra au prochain lundi/vendredi).
   */
  @Cron('0 8 * * 1,5')
  async relancerRestesAPayer() {
    const inscriptions = await this.inscriptionsService.trouverEnRetardDePaiement(10);
    if (inscriptions.length === 0) return;

    const emails = await this.usersService.emailsTousLesUtilisateurs();
    if (emails.length === 0) return;

    const lignes = inscriptions
      .map((inscription) => {
        const candidat: any = inscription.candidatId;
        return `<li><strong>${candidat?.nom ?? ''} ${candidat?.prenom ?? ''}</strong> (${candidat?.telephone ?? ''}) — Reçu N° ${inscription.numeroRecu} — Reste à payer : ${inscription.resteAPayer.toLocaleString('fr-FR')} FCFA — Inscrit le ${new Date(inscription.dateInscription).toLocaleDateString('fr-FR')}</li>`;
      })
      .join('');

    await this.mailService.envoyer({
      to: emails,
      subject: `Relance paiement — ${inscriptions.length} candidat(s) concerné(s)`,
      htmlContent: `
        <p>Les candidats suivants ont un reste à payer depuis au moins 10 jours :</p>
        <ul>${lignes}</ul>
      `,
    });

    this.logger.log(`Relance de paiement envoyée pour ${inscriptions.length} candidat(s)`);
  }
}