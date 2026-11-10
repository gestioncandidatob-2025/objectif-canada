import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { AbonnementsService } from './abonnements.service';
import { PayerParCarteDto, PayerParMobileDto } from './dto/payer-abonnement.dto';

/** Abonnement du centre de l'utilisateur connecté */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscription')
export class AbonnementsController {
  constructor(private readonly abonnementsService: AbonnementsService) {}

  @ApiOperation({
    summary: 'État de l\'abonnement (peut-on facturer ? avertissements) — tous les utilisateurs du centre',
  })
  @Roles('admin', 'secretariat')
  @Get('status')
  etat(@CentreId() centreId: string) {
    return this.abonnementsService.etatPourLeCentre(centreId);
  }

  @ApiOperation({ summary: 'Page Abonnement : plan, utilisation, plans, derniers paiements — administrateur' })
  @Roles('admin')
  @Get()
  resume(@CentreId() centreId: string) {
    return this.abonnementsService.resumePourAdmin(centreId);
  }

  @ApiOperation({
    summary: 'Payer par Mobile Money (MTN, Orange) : une demande de code PIN arrive sur le téléphone — administrateur',
  })
  @Roles('admin')
  @Post('pay/mobile')
  @HttpCode(200)
  payerParMobile(@CentreId() centreId: string, @Req() req: any, @Body() dto: PayerParMobileDto) {
    return this.abonnementsService.payerParMobile(centreId, req.user.userId, dto);
  }

  @ApiOperation({ summary: 'Payer par carte : renvoie le lien de la page de paiement CamPay — administrateur' })
  @Roles('admin')
  @Post('pay/card')
  @HttpCode(200)
  payerParCarte(@CentreId() centreId: string, @Req() req: any, @Body() dto: PayerParCarteDto) {
    return this.abonnementsService.payerParCarte(centreId, req.user.userId, req.user.email, dto);
  }

  @ApiOperation({ summary: "Où en est un paiement (redemandé à CamPay s'il est en attente) — administrateur" })
  @Roles('admin')
  @Get('payments/:id')
  suivre(@CentreId() centreId: string, @Param('id') id: string) {
    return this.abonnementsService.suivrePaiement(centreId, id);
  }
}