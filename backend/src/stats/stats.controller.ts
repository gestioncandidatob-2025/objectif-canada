import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
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

  @Get('journalieres')
  journalieres() {
    return this.statsService.journalieres();
  }

  @Get('hebdomadaires')
  hebdomadaires() {
    return this.statsService.hebdomadaires();
  }

  @Get('mensuelles')
  mensuelles() {
    return this.statsService.mensuelles();
  }

  @Get('graphiques')
  graphiques() {
    return this.statsService.graphiques();
  }
}