import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { VerificationsCaisseService, jourDHier } from './verifications-caisse.service';
import { ActionEmailDto, ChangerStatutDto, EnvoyerMessageDto } from './dto/verification-caisse.dto';

/**
 * Vérification de la caisse par l'administrateur.
 * - Chaque matin, un email avec la caisse d'hier de chaque personne et 3 boutons.
 * - Les journées pas encore confirmées restent sur l'Accueil de l'administrateur.
 * - L'administrateur peut poser une question à la personne concernée, qui répond
 *   depuis son Accueil. Elle ne voit pas le statut choisi par l'administrateur.
 */
@Controller('cash-checks')
export class VerificationsCaisseController {
  constructor(
    private readonly verificationsService: VerificationsCaisseService,
    private readonly config: ConfigService,
  ) {}

  // ----- Sans connexion : bouton de l'email (protégé par le lien secret) -----

  @ApiOperation({ summary: "Clic sur un bouton de l'email (Je confirme / À vérifier / À signaler)" })
  @Post('email-action')
  actionEmail(@Body() dto: ActionEmailDto) {
    return this.verificationsService.actionDepuisEmail(dto.token, dto.action);
  }

  // ----- Administrateur -----

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Journées de caisse pas encore confirmées (Accueil de l’administrateur)' })
  @Get()
  aSuivre(@CentreId() centreId: string) {
    return this.verificationsService.aSuivre(centreId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: "Choix de l'administrateur depuis l'application" })
  @Patch(':id/status')
  changerStatut(
    @CentreId() centreId: string,
    @Param('id') id: string,
    @Body() dto: ChangerStatutDto,
    @Req() req: any,
  ) {
    return this.verificationsService.changerStatut(centreId, id, dto.action, req.user.userId);
  }

  /**
   * Pour tester (hors production seulement) : envoie tout de suite l'email
   * de la caisse d'un jour, sans attendre 6 h. Par défaut, hier.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Test : envoyer maintenant la caisse d’un jour (hors production)' })
  @ApiQuery({ name: 'day', required: false, description: 'AAAA-MM-JJ, hier par défaut' })
  @Post('send-now')
  async envoyerMaintenant(@CentreId() centreId: string, @Query('day') day?: string) {
    if (this.config.get<string>('APP_ENV') === 'production') {
      throw new ForbiddenException("Réservé aux tests : en production, l'email part chaque matin à 6 h.");
    }
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      throw new BadRequestException('La date doit être au format AAAA-MM-JJ');
    }
    const jour = day ?? jourDHier();
    const envoyees = await this.verificationsService.envoyerLaCaisseDuJour(centreId, jour);
    return { jour, envoyees };
  }

  // ----- Administrateur et personne qui a encaissé -----

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'secretariat')
  @ApiOperation({ summary: "Question de l'administrateur, ou réponse de la personne concernée" })
  @Post(':id/messages')
  envoyerMessage(
    @CentreId() centreId: string,
    @Param('id') id: string,
    @Body() dto: EnvoyerMessageDto,
    @Req() req: any,
  ) {
    return this.verificationsService.envoyerMessage(centreId, id, req.user, dto.texte);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'secretariat')
  @ApiOperation({ summary: 'Questions qui attendent ma réponse (Accueil)' })
  @Get('my-questions')
  mesQuestions(@CentreId() centreId: string, @Req() req: any) {
    return this.verificationsService.mesQuestions(centreId, req.user.userId);
  }
}