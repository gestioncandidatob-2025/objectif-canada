import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { AbonnementsSuperAdminService } from './abonnements-super-admin.service';
import { ModifierPlanDto, ReglerAbonnementDto } from './dto/super-admin-abonnement.dto';

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
}