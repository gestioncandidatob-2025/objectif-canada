import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CentresService } from '../centres/centres.service';
import { VerificationsCaisseService, jourDHier } from './verifications-caisse.service';

@Injectable()
export class VerificationsCaisseCron {
  private readonly logger = new Logger(VerificationsCaisseCron.name);

  constructor(
    private verificationsService: VerificationsCaisseService,
    private centresService: CentresService,
    private config: ConfigService,
  ) {}

  /**
   * Chaque matin à 6 h (heure de Douala) : dans chaque centre, l'email de la
   * caisse d'hier part aux administrateurs. À 6 h, la journée d'hier est
   * terminée : un client enregistré tard le soir est bien compté.
   */
  @Cron('0 6 * * *', { timeZone: 'Africa/Douala' })
  async envoyerLaCaisseDHier() {
    if (this.config.get<boolean>('ENABLE_CRONS') !== true) return;

    const jour = jourDHier();
    const centres = await this.centresService.trouverActifs();
    for (const centre of centres) {
      try {
        const nombre = await this.verificationsService.envoyerLaCaisseDuJour(String(centre._id), jour);
        if (nombre > 0) this.logger.log(`${centre.nom} : caisse du ${jour} envoyée (${nombre} personne(s))`);
      } catch (erreur) {
        this.logger.error(`Centre ${centre.nom} : ${(erreur as Error).message}`);
      }
    }
  }
}