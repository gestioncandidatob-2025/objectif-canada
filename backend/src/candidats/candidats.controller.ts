import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CandidatsService } from './candidats.service';
import { CreateCandidatDto } from './dto/create-candidat.dto';
import { UpdateCandidatDto } from './dto/update-candidat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatsController {
  constructor(private readonly candidatsService: CandidatsService) {}

  @ApiOperation({ summary: 'Créer un nouveau candidat' })
  @Post()
  create(@Body() createCandidatDto: CreateCandidatDto) {
    return this.candidatsService.create(createCandidatDto);
  }

  @ApiOperation({ summary: 'Lister tous les candidats, avec filtre optionnel par nom/prénom' })
  @ApiQuery({ name: 'nom', required: false, description: 'Filtre par nom ou prénom (recherche partielle)' })
  @Get()
  findAll(@Query('nom') nom?: string) {
    return this.candidatsService.findAll(nom);
  }

  @ApiOperation({ summary: "Voir le détail d'un candidat précis" })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatsService.findOne(id);
  }

  @ApiOperation({ summary: "Modifier un candidat (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCandidatDto: UpdateCandidatDto) {
    return this.candidatsService.update(id, updateCandidatDto);
  }

  @ApiOperation({ summary: "Supprimer un candidat (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.candidatsService.remove(id);
  }
}