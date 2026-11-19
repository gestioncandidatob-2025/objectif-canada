import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InscriptionsService } from '../inscriptions/inscriptions.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { CentresService } from '../centres/centres.service';

@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);

  constructor(
    private inscriptionsService: InscriptionsService,
    private usersService: UsersService,
    private mailService: MailService,
    private configService: ConfigService,
    private centresService: CentresService,
  ) {}

  /** Les crons ne tournent qu'en production (ou si ENABLE_CRONS=true) */
  private cronsActifs(): boolean {
    return this.configService.get<boolean>('ENABLE_CRONS') === true;
  }

  /**
   * Exécute une tâche pour chaque centre actif. Une erreur dans un centre
   * n'empêche pas les autres centres d'être traités.
   */
  private async pourChaqueCentre(tache: (centreId: string, nomCentre: string) => Promise<void>) {
    const centres = await this.centresService.trouverActifs();
    for (const centre of centres) {
      try {
        await tache(String(centre._id), centre.nom);
      } catch (erreur) {
        this.logger.error(`Centre ${centre.nom} : ${(erreur as Error).message}`);
      }
    }
  }

  /**
   * Tous les jours à 7h : prévient les opérateurs de chaque centre des
   * formations dont la date de fin est atteinte, une seule fois par inscription.
   */
  @Cron('0 7 * * *')
  async notifierFormationsTerminees() {
    if (!this.cronsActifs()) return;

    await this.pourChaqueCentre(async (centreId, nomCentre) => {
      const inscriptions =
        await this.inscriptionsService.trouverFormationsTermineesNonNotifiees(centreId);
      if (inscriptions.length === 0) return;

      const emails = await this.usersService.emailsTousLesUtilisateurs(centreId);
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

        await this.inscriptionsService.marquerFormationNotifiee(String(inscription._id), centreId);
      }

      this.logger.log(
        `${nomCentre} : ${inscriptions.length} notification(s) de fin de formation envoyée(s)`,
      );
    });
  }

  /**
   * Chaque lundi et vendredi à 8h : dans chaque centre, relance les candidats
   * ayant un reste à payer depuis au moins 10 jours. La relance se répète tant
   * que la dette n'est pas soldée.
   */
  @Cron('0 8 * * 1,5')
  async relancerRestesAPayer() {
    if (!this.cronsActifs()) return;

    await this.pourChaqueCentre(async (centreId, nomCentre) => {
      const inscriptions = await this.inscriptionsService.trouverEnRetardDePaiement(10, centreId);
      if (inscriptions.length === 0) return;

      const emails = await this.usersService.emailsTousLesUtilisateurs(centreId);
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

      this.logger.log(`${nomCentre} : relance envoyée pour ${inscriptions.length} candidat(s)`);
    });
  }
}