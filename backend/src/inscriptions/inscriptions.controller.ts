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

 @ApiOperation({ summary: 'Lister les inscriptions, avec filtres optionnels par nom/service/régime/candidat/statut/dates/paiement' })
  @ApiQuery({ name: 'nom', required: false })
  @ApiQuery({ name: 'service', required: false })
  @ApiQuery({ name: 'regime', required: false })
  @ApiQuery({ name: 'candidatId', required: false })
  @ApiQuery({ name: 'statut', required: false, description: "'en_cours' ou 'termine' (basé sur la date de fin de formation)" })
  @ApiQuery({ name: 'dateInscriptionDebut', required: false, description: 'Filtrer les inscriptions à partir de cette date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateInscriptionFin', required: false, description: "Filtrer les inscriptions jusqu'à cette date (YYYY-MM-DD)" })
  @ApiQuery({ name: 'paiement', required: false, description: "'avec_reste' ou 'solde'" })
  @Get()
  findAll(
    @Query('nom') nom?: string,
    @Query('service') service?: string,
    @Query('regime') regime?: string,
    @Query('candidatId') candidatId?: string,
    @Query('statut') statut?: string,
    @Query('dateInscriptionDebut') dateInscriptionDebut?: string,
    @Query('dateInscriptionFin') dateInscriptionFin?: string,
    @Query('paiement') paiement?: string,
  ) {
    return this.inscriptionsService.findAll({
      nom,
      service,
      regime,
      candidatId,
      statut,
      dateInscriptionDebut,
      dateInscriptionFin,
      paiement,
    });
  }

  @ApiOperation({ summary: "Vérifier si un candidat (par téléphone) existe déjà et a une dette en cours" })
  @Get('dette/:telephone')
  verifierDette(@Param('telephone') telephone: string) {
    return this.inscriptionsService.verifierDette(telephone);
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

  @ApiOperation({ summary: "Lister toutes les factures stockées sur AWS S3, de la plus récente à la plus ancienne" })
  @UseGuards(RolesGuard)
  @Roles('admin', 'secretariat')
  @Get('factures/liste')
  listerFactures() {
    return this.inscriptionsService.listerFactures();
  }

  @ApiOperation({ summary: "Obtenir un lien temporaire pour consulter/réimprimer la facture PDF stockée sur AWS S3" })
  @UseGuards(RolesGuard)
  @Roles('admin', 'secretariat')
  @Get(':id/facture')
  urlFacture(@Param('id') id: string) {
    return this.inscriptionsService.urlFacture(id);
  }

  @ApiOperation({ summary: 'Ajouter un paiement complémentaire' })
  @Patch(':id/payment')
  ajouterPaiement(@Param('id') id: string, @Body() dto: AjouterPaiementDto) {
    return this.inscriptionsService.ajouterPaiement(id, dto.montant);
  }

  @ApiOperation({ summary: "Modifier une inscription (justification obligatoire)" })
  @UseGuards(RolesGuard)
  @Roles('admin', 'secretariat')
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