import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { PaiementsMobilesService } from './paiements-mobiles.service';
import {
  DemanderRetraitDto,
  ModifierReglagesMobileDto,
  PayerFactureMobileDto,
  PayerResteMobileDto,
  RefuserRetraitDto,
} from './dto/paiement-mobile.dto';

/**
 * Paiement des candidats avec CamPay (demande de code PIN sur leur téléphone),
 * solde CamPay du centre et retraits.
 * Les routes « platform/… » sont réservées au super admin (équipe HREFF).
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mobile-payments')
export class PaiementsMobilesController {
  constructor(private readonly service: PaiementsMobilesService) {}

  // ---------- Centre : encaisser ----------

  @ApiOperation({ summary: 'Nouvelle facture payée avec CamPay (la facture est créée quand le paiement réussit)' })
  @Roles('admin', 'secretariat')
  @Post('registration')
  payerNouvelleFacture(@CentreId() centreId: string, @Req() req: any, @Body() dto: PayerFactureMobileDto) {
    return this.service.payerNouvelleFacture(centreId, req.user.userId, dto);
  }

  @ApiOperation({ summary: "Reste à payer d'une facture, payé avec CamPay" })
  @Roles('admin', 'secretariat')
  @Post('remaining-balance')
  payerReste(@CentreId() centreId: string, @Req() req: any, @Body() dto: PayerResteMobileDto) {
    return this.service.payerReste(centreId, req.user.userId, dto);
  }

  // ---------- Centre : solde et retraits (administrateur) ----------

  @ApiOperation({ summary: 'Solde CamPay du centre, paiements reçus et retraits' })
  @Roles('admin')
  @Get('wallet')
  portefeuille(@CentreId() centreId: string) {
    return this.service.portefeuille(centreId);
  }

  @ApiOperation({ summary: 'Demander un retrait vers un numéro MTN ou Orange (validé ensuite par HREFF)' })
  @Roles('admin')
  @Post('withdrawals')
  demanderRetrait(@CentreId() centreId: string, @Req() req: any, @Body() dto: DemanderRetraitDto) {
    return this.service.demanderRetrait(centreId, req.user.userId, dto);
  }

  // ---------- Super admin ----------

  @ApiOperation({ summary: 'Vue d’ensemble : argent reçu, frais, ce qui est dû aux centres — super admin' })
  @Roles('super_admin')
  @Get('platform/overview')
  vueEnsemble() {
    return this.service.vueEnsemble();
  }

  @ApiOperation({ summary: 'Demandes de retrait de tous les centres — super admin' })
  @ApiQuery({ name: 'status', required: false, description: 'demande, en_cours, envoye, refuse, echoue' })
  @Roles('super_admin')
  @Get('platform/withdrawals')
  listeRetraits(@Query('status') statut?: string) {
    return this.service.listeRetraits(statut);
  }

  @ApiOperation({ summary: "Valider un retrait : CamPay envoie l'argent — super admin" })
  @Roles('super_admin')
  @Patch('platform/withdrawals/:id/approve')
  validerRetrait(@Param('id') id: string, @Req() req: any) {
    return this.service.validerRetrait(id, req.user.userId);
  }

  @ApiOperation({ summary: 'Refuser un retrait — super admin' })
  @Roles('super_admin')
  @Patch('platform/withdrawals/:id/reject')
  refuserRetrait(@Param('id') id: string, @Req() req: any, @Body() dto: RefuserRetraitDto) {
    return this.service.refuserRetrait(id, req.user.userId, dto.raison);
  }

  @ApiOperation({ summary: 'Réglages : frais CamPay, commission HREFF, retrait minimum — super admin' })
  @Roles('super_admin')
  @Get('platform/settings')
  reglages() {
    return this.service.reglages();
  }

  @ApiOperation({ summary: 'Modifier les réglages — super admin' })
  @Roles('super_admin')
  @Patch('platform/settings')
  modifierReglages(@Body() dto: ModifierReglagesMobileDto) {
    return this.service.modifierReglages(dto);
  }

  // ---------- Suivi d'un paiement (en dernier : « :id » attrape tout) ----------

  @ApiOperation({ summary: 'Où en est un paiement (redemandé à CamPay pendant l’attente)' })
  @Roles('admin', 'secretariat')
  @Get(':id')
  suivre(@CentreId() centreId: string, @Param('id') id: string) {
    return this.service.suivre(centreId, id);
  }
}