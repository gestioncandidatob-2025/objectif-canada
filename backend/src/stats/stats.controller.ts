import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @ApiOperation({ summary: "Statistiques du jour : candidats totaux, inscriptions et montant encaissé aujourd'hui" })
  @Get('daily')
  journalieres() {
    return this.statsService.journalieres();
  }

  @ApiOperation({ summary: 'Statistiques de la semaine en cours' })
  @Get('weekly')
  hebdomadaires() {
    return this.statsService.hebdomadaires();
  }

  @ApiOperation({ summary: 'Statistiques du mois en cours' })
  @Get('monthly')
  mensuelles() {
    return this.statsService.mensuelles();
  }

  @ApiOperation({ summary: "Données journalières du mois, pour construire des graphiques d'inscriptions et d'encaissements" })
  @Get('charts')
  graphiques() {
    return this.statsService.graphiques();
  }
}