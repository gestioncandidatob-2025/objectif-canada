import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { CentreId } from '../common/centre-id.decorator';
import { GroupesService } from './groupes.service';
import { UpdateBlocGroupesDto } from './dto/update-bloc-groupes.dto';

/**
 * Groupes de candidats du centre (remplacent les classes Jour/Soir).
 * Les groupes viennent des services et de leurs régimes ; l'administrateur
 * règle seulement le groupe 2, les jours avant le passage et les capacités.
 * Les candidats y entrent et en changent automatiquement.
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupesController {
  constructor(private readonly groupesService: GroupesService) {}

  @ApiOperation({
    summary: 'Liste simple de tous les groupes du centre avec leur nombre de candidats — tous les utilisateurs',
  })
  @Get()
  findAll(@CentreId() centreId: string) {
    return this.groupesService.lister(centreId);
  }

  @ApiOperation({
    summary:
      'Blocs de groupes de la page Groupes (un par service, ou par service et régime) ; crée le groupe 1 s’il manque — tous les utilisateurs',
  })
  @Get('blocks')
  findBlocks(@CentreId() centreId: string) {
    return this.groupesService.parBloc(centreId);
  }

  @ApiOperation({
    summary:
      "Régler un bloc : capacités, groupe 2 coché ou non, jours avant le passage — administrateur",
  })
  @Roles(Role.ADMIN)
  @Put('blocks')
  updateBlock(@Body() dto: UpdateBlocGroupesDto, @CentreId() centreId: string) {
    return this.groupesService.enregistrerBloc(dto, centreId);
  }

  @ApiOperation({
    summary:
      'Appliquer tout de suite les passages au groupe suivant (fait aussi chaque nuit automatiquement) — administrateur',
  })
  @Roles(Role.ADMIN)
  @Post('apply-transfers')
  applyTransfers(@CentreId() centreId: string) {
    return this.groupesService.appliquerPassages(centreId);
  }

  @ApiOperation({
    summary: "Candidats en cours d'un groupe et ce qu'ils doivent — tous les utilisateurs",
  })
  @Get(':id/candidates')
  candidates(@Param('id') id: string, @CentreId() centreId: string) {
    return this.groupesService.candidats(id, centreId);
  }
}