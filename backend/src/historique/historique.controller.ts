import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HistoriqueService } from './historique.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('historique')
export class HistoriqueController {
  constructor(private readonly historiqueService: HistoriqueService) {}

  @ApiOperation({
    summary:
      "Lister le journal des actions des utilisateurs — réservé à l'administrateur",
  })
  @ApiQuery({ name: 'utilisateur', required: false, description: 'Recherche par nom ou email' })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @Get()
  findAll(
    @Query('utilisateur') utilisateur?: string,
    @Query('module') module?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page') page?: string,
    @Query('limite') limite?: string,
  ) {
    return this.historiqueService.findAll({
      utilisateur,
      module,
      dateDebut,
      dateFin,
      page: page ? parseInt(page, 10) : undefined,
      limite: limite ? parseInt(limite, 10) : undefined,
    });
  }
}