import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CandidatsService } from './candidats.service';
import { CreateCandidatDto } from './dto/create-candidat.dto';
import { UpdateCandidatDto } from './dto/update-candidat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatsController {
  constructor(private readonly candidatsService: CandidatsService) {}

  @ApiOperation({ summary: 'Créer un nouveau candidat' })
  @Post()
  create(@Body() createCandidatDto: CreateCandidatDto, @CentreId() centreId: string) {
    return this.candidatsService.create(createCandidatDto, centreId);
  }

  @ApiOperation({ summary: 'Lister tous les candidats, avec filtre optionnel par nom/prénom' })
  @ApiQuery({ name: 'nom', required: false })
  @Get()
  findAll(@CentreId() centreId: string, @Query('nom') nom?: string) {
    return this.candidatsService.findAll(centreId, nom);
  }

  @ApiOperation({ summary: "Voir le détail d'un candidat précis" })
  @Get(':id')
  findOne(@Param('id') id: string, @CentreId() centreId: string) {
    return this.candidatsService.findOne(id, centreId);
  }

  @ApiOperation({ summary: 'Modifier un candidat (avec justification obligatoire)' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCandidatDto: UpdateCandidatDto,
    @Req() req: any,
    @CentreId() centreId: string,
  ) {
    return this.candidatsService.update(id, updateCandidatDto, req.user.email, centreId);
  }

  @ApiOperation({ summary: "Supprimer un candidat (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CentreId() centreId: string) {
    return this.candidatsService.remove(id, centreId);
  }
}