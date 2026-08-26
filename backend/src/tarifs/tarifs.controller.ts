import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TarifsService } from './tarifs.service';
import { CreateTarifDto } from './dto/create-tarif.dto';
import { UpdateTarifDto } from './dto/update-tarif.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tarifs')
export class TarifsController {
  constructor(private readonly tarifsService: TarifsService) {}

  @ApiOperation({ summary: "Lister toutes les offres de formation" })
  @Get()
  findAll() {
    return this.tarifsService.findAll();
  }

  @ApiOperation({ summary: "Créer une nouvelle offre (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() createTarifDto: CreateTarifDto) {
    return this.tarifsService.create(createTarifDto);
  }

  @ApiOperation({ summary: "Modifier une offre existante (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTarifDto: UpdateTarifDto) {
    return this.tarifsService.update(id, updateTarifDto);
  }

  @ApiOperation({ summary: "Supprimer une offre (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tarifsService.remove(id);
  }
}