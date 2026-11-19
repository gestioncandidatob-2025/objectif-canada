import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { CentreId } from '../common/centre-id.decorator';
import { MonCentreService } from './mon-centre.service';
import type { FichierEnvoye } from './mon-centre.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** Routes sur le centre de l'utilisateur connecté */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('center')
export class MonCentreController {
  constructor(private readonly monCentreService: MonCentreService) {}

  @ApiOperation({
    summary: "Paramètres du centre (nom, coordonnées, reçu, modes de paiement, logo) — tous les utilisateurs du centre",
  })
  @Get('settings')
  getSettings(@CentreId() centreId: string) {
    return this.monCentreService.obtenirParametres(centreId);
  }

  @ApiOperation({ summary: 'Modifier les paramètres du centre — administrateur' })
  @Roles(Role.ADMIN)
  @Patch('settings')
  updateSettings(@CentreId() centreId: string, @Body() dto: UpdateSettingsDto) {
    return this.monCentreService.modifierParametres(centreId, dto);
  }

  @ApiOperation({ summary: 'Envoyer le logo du centre (PNG ou JPG, 1 Mo maximum) — administrateur' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { logo: { type: 'string', format: 'binary' } },
      required: ['logo'],
    },
  })
  @Roles(Role.ADMIN)
  // 2 Mo ici pour bloquer les très gros fichiers ; la vraie limite (1 Mo, avec
  // un message clair) est vérifiée dans le service
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 2 * 1024 * 1024 } }))
  @Post('logo')
  uploadLogo(@CentreId() centreId: string, @UploadedFile() fichier: FichierEnvoye) {
    return this.monCentreService.televerserLogo(centreId, fichier);
  }

  @ApiOperation({
    summary: "Ce qu'il reste à configurer dans le centre (bandeau de rappel) — administrateur",
  })
  @Roles(Role.ADMIN)
  @Get('setup-status')
  setupStatus(@CentreId() centreId: string) {
    return this.monCentreService.etatConfiguration(centreId);
  }
}