import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CentresService } from '../centres/centres.service';
import { GroupesService } from './groupes.service';

/** Tâche de nuit : passage automatique des candidats au groupe suivant */
@Injectable()
export class GroupesCronService {
  private readonly logger = new Logger(GroupesCronService.name);

  constructor(
    private groupesService: GroupesService,
    private centresService: CentresService,
    private configService: ConfigService,
  ) {}

  /**
   * Tous les jours à 1h du matin (heure du Cameroun), pour chaque centre
   * actif. Comme les autres tâches planifiées, elle ne tourne qu'en
   * production, ou si ENABLE_CRONS=true.
   */
  @Cron('0 1 * * *', { timeZone: 'Africa/Douala' })
  async passerAuxGroupesSuivants() {
    if (this.configService.get<boolean>('ENABLE_CRONS') !== true) return;

    const centres = await this.centresService.trouverActifs();
    for (const centre of centres) {
      try {
        await this.groupesService.appliquerPassages(String(centre._id));
      } catch (erreur) {
        // Une erreur dans un centre n'empêche pas de traiter les autres
        this.logger.error(`Centre ${centre.nom} : ${(erreur as Error).message}`);
      }
    }
  }
}