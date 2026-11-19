import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @ApiOperation({ summary: "Statistiques du jour : candidats totaux, inscriptions et montant encaissé aujourd'hui" })
  @Get('daily')
  journalieres(@CentreId() centreId: string) {
    return this.statsService.journalieres(centreId);
  }

  @ApiOperation({ summary: 'Statistiques de la semaine en cours' })
  @Get('weekly')
  hebdomadaires(@CentreId() centreId: string) {
    return this.statsService.hebdomadaires(centreId);
  }

  @ApiOperation({ summary: 'Statistiques du mois en cours' })
  @Get('monthly')
  mensuelles(@CentreId() centreId: string) {
    return this.statsService.mensuelles(centreId);
  }

  @ApiOperation({ summary: "Données journalières du mois, pour construire des graphiques d'inscriptions et d'encaissements" })
  @Get('charts')
  graphiques(@CentreId() centreId: string) {
    return this.statsService.graphiques(centreId);
  }

  @ApiOperation({ summary: "Données mensuelles de l'année en cours, pour un graphique annuel montrant l'évolution mois par mois" })
  @Get('annual')
  annuelles(@CentreId() centreId: string) {
    return this.statsService.annuelles(centreId);
  }
}