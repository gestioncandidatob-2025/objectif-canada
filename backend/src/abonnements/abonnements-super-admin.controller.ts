import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { AbonnementsSuperAdminService } from './abonnements-super-admin.service';
import { ModifierPlanDto, OffrirPlanDto, ReglerAbonnementDto } from './dto/super-admin-abonnement.dto';

/** Espace super admin (équipe HREFF) : plans et paiements des centres */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('subscriptions')
export class AbonnementsSuperAdminController {
  constructor(private readonly service: AbonnementsSuperAdminService) {}

  @ApiOperation({ summary: 'Revenus, centres payants, plans, abonnements à suivre, derniers paiements — super admin' })
  @Get('overview')
  vueEnsemble() {
    return this.service.vueEnsemble();
  }

  @ApiOperation({ summary: "Historique de toutes les transactions d'abonnement, avec filtres — super admin" })
  @ApiQuery({ name: 'statut', required: false, description: 'reussi, echoue ou en_attente' })
  @ApiQuery({ name: 'centre', required: false, description: 'Identifiant du centre' })
  @ApiQuery({ name: 'debut', required: false, description: 'AAAA-MM-JJ' })
  @ApiQuery({ name: 'fin', required: false, description: 'AAAA-MM-JJ' })
  @ApiQuery({ name: 'page', required: false })
  @Get('transactions')
  transactions(
    @Query('statut') statut?: string,
    @Query('centre') centreId?: string,
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
    @Query('page') page?: string,
  ) {
    return this.service.transactions({ statut, centreId, debut, fin, page: page ? Number(page) : 1 });
  }

  @ApiOperation({ summary: "Changer le prix ou les limites d'un plan — super admin" })
  @Patch('plans/:code')
  modifierPlan(@Param('code') code: string, @Body() dto: ModifierPlanDto) {
    return this.service.modifierPlan(code, dto);
  }

  @ApiOperation({ summary: "Abonnement d'un centre et ses paiements — super admin" })
  @Get('centers/:id')
  abonnementDuCentre(@Param('id') id: string) {
    return this.service.abonnementDuCentre(id);
  }

  @ApiOperation({
    summary: "Régler à la main l'abonnement d'un centre (plan offert, Sur mesure, paiement hors CamPay) — super admin",
  })
  @Patch('centers/:id')
  reglerAbonnement(@Param('id') id: string, @Body() dto: ReglerAbonnementDto) {
    return this.service.reglerAbonnement(id, dto);
  }

  @ApiOperation({
    summary: "Offrir un plan à un centre pour une période (ex : 3 mois de Pro), sans paiement — super admin",
  })
  @Post('centers/:id/offer')
  offrirPlan(@Param('id') id: string, @Body() dto: OffrirPlanDto) {
    return this.service.offrirPlan(id, dto);
  }

  @ApiOperation({ summary: "Arrêter tout de suite l'offre d'un centre (retour à son plan d'avant) — super admin" })
  @Delete('centers/:id/offer')
  arreterOffre(@Param('id') id: string) {
    return this.service.arreterOffre(id);
  }
}