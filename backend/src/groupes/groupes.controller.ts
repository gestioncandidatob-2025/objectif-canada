import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { CentreId } from '../common/centre-id.decorator';
import { GroupesService } from './groupes.service';
import { CreateGroupeDto } from './dto/create-groupe.dto';
import { UpdateGroupeDto } from './dto/update-groupe.dto';

/**
 * Groupes de candidats du centre (remplacent les classes Jour/Soir).
 * Seul l'administrateur crée et modifie les groupes ; les candidats y entrent
 * et en changent automatiquement.
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupesController {
  constructor(private readonly groupesService: GroupesService) {}

  @ApiOperation({
    summary: 'Lister les groupes du centre avec leur nombre de candidats en cours — tous les utilisateurs',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    description: "'true' = seulement les groupes actifs",
  })
  @Get()
  findAll(@CentreId() centreId: string, @Query('active') active?: string) {
    return this.groupesService.lister(centreId, active === 'true');
  }

  @ApiOperation({ summary: 'Créer un groupe — administrateur' })
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateGroupeDto, @CentreId() centreId: string) {
    return this.groupesService.creer(dto, centreId);
  }

  @ApiOperation({
    summary: 'Modifier ou désactiver un groupe (null efface un champ) — administrateur',
  })
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupeDto, @CentreId() centreId: string) {
    return this.groupesService.modifier(id, dto, centreId);
  }

  @ApiOperation({
    summary: "Candidats en cours d'un groupe et ce qu'ils doivent — tous les utilisateurs",
  })
  @Get(':id/candidates')
  candidates(@Param('id') id: string, @CentreId() centreId: string) {
    return this.groupesService.candidats(id, centreId);
  }
}