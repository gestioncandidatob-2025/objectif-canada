import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InscriptionsService } from './inscriptions.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { UpdateInscriptionDto } from './dto/update-inscription.dto';
import { AjouterPaiementDto } from './dto/ajouter-paiement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('registrations')
export class InscriptionsController {
  constructor(private readonly inscriptionsService: InscriptionsService) {}

  @ApiOperation({ summary: 'Créer une inscription (calcule automatiquement montant, dates et numéro de reçu)' })
  @Post()
  create(@Body() createInscriptionDto: CreateInscriptionDto) {
    return this.inscriptionsService.create(createInscriptionDto);
  }

 @ApiOperation({ summary: 'Lister les inscriptions, avec filtres optionnels par nom/service/régime/candidat' })
  @ApiQuery({ name: 'nom', required: false })
  @ApiQuery({ name: 'service', required: false })
  @ApiQuery({ name: 'regime', required: false })
  @ApiQuery({ name: 'candidatId', required: false })
  @Get()
  findAll(
    @Query('nom') nom?: string,
    @Query('service') service?: string,
    @Query('regime') regime?: string,
    @Query('candidatId') candidatId?: string,
  ) {
    return this.inscriptionsService.findAll({ nom, service, regime, candidatId });
  }

  @ApiOperation({ summary: "Voir le détail d'une inscription précise" })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inscriptionsService.findOne(id);
  }

  @ApiOperation({ summary: "Voir les données du reçu d'une inscription" })
  @Get(':id/receipt')
  getRecu(@Param('id') id: string) {
    return this.inscriptionsService.findOne(id);
  }

  @ApiOperation({ summary: "Ajouter un paiement complémentaire (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id/payment')
  ajouterPaiement(@Param('id') id: string, @Body() dto: AjouterPaiementDto) {
    return this.inscriptionsService.ajouterPaiement(id, dto.montant);
  }

  @ApiOperation({ summary: "Modifier une inscription (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInscriptionDto: UpdateInscriptionDto) {
    return this.inscriptionsService.update(id, updateInscriptionDto);
  }

  @ApiOperation({ summary: "Supprimer une inscription (réservé à l'administrateur)" })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inscriptionsService.remove(id);
  }
}