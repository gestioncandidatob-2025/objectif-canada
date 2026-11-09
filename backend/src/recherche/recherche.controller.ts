import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { RechercheService } from './recherche.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'secretariat')
@Controller('search')
export class RechercheController {
  constructor(private readonly rechercheService: RechercheService) {}

  @ApiOperation({
    summary:
      'Recherche globale dans le centre : candidats (nom, prénom, téléphone) et factures (numéro de reçu)',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Au moins 2 caractères' })
  @Get()
  rechercher(@CentreId() centreId: string, @Query('q') q?: string) {
    return this.rechercheService.rechercher(centreId, q ?? '');
  }
}