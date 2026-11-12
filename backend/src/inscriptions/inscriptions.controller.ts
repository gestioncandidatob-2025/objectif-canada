import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InscriptionsService } from './inscriptions.service';
import type { Changement } from './inscriptions.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { UpdateInscriptionDto } from './dto/update-inscription.dto';
import { AjouterPaiementDto } from './dto/ajouter-paiement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { AbonnementsService } from '../abonnements/abonnements.service';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('registrations')
export class InscriptionsController {
  constructor(
    private readonly inscriptionsService: InscriptionsService,
    private readonly abonnementsService: AbonnementsService,
  ) {}

  @ApiOperation({ summary: 'Créer une inscription (calcule automatiquement montant, dates et numéro de reçu)' })
  @Post()
  async create(
    @Body() createInscriptionDto: CreateInscriptionDto,
    @CentreId() centreId: string,
    @Req() req: any,
  ) {
    // Abonnement : refusé si le quota de factures du mois est atteint,
    // ou si le centre est en lecture seule (abonnement expiré)
    await this.abonnementsService.verifierPeutCreerFacture(centreId);
    // req.user.userId : la personne connectée, qui encaisse (point de caisse)
    return this.inscriptionsService.create(createInscriptionDto, centreId, req.user.userId);
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
    @CentreId() centreId: string,
    @Query('nom') nom?: string,
    @Query('service') service?: string,
    @Query('regime') regime?: string,
    @Query('candidatId') candidatId?: string,
    @Query('statut') statut?: string,
    @Query('dateInscriptionDebut') dateInscriptionDebut?: string,
    @Query('dateInscriptionFin') dateInscriptionFin?: string,
    @Query('paiement') paiement?: string,
  ) {
    return this.inscriptionsService.findAll(centreId, {
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

  @ApiOperation({ summary: "Exporter en Excel les factures d'une période (réservé à l'administrateur)" })
  @ApiQuery({ name: 'debut', required: true, description: 'Date de début (YYYY-MM-DD)' })
  @ApiQuery({ name: 'fin', required: true, description: 'Date de fin (YYYY-MM-DD)' })
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('export')
  async exporter(
    @CentreId() centreId: string,
    @Res() res: Response,
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
  ) {
    const fichier = await this.inscriptionsService.exporterExcel(centreId, debut, fin);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="factures-${debut}-au-${fin}.xlsx"`);
    res.send(fichier);
  }

  @ApiOperation({ summary: "Vérifier si un candidat (par téléphone) existe déjà et a une dette en cours" })
  @Get('dette/:telephone')
  verifierDette(@Param('telephone') telephone: string, @CentreId() centreId: string) {
    return this.inscriptionsService.verifierDette(telephone, centreId);
  }

  @ApiOperation({ summary: "Voir le détail d'une inscription précise" })
  @Get(':id')
  findOne(@Param('id') id: string, @CentreId() centreId: string) {
    return this.inscriptionsService.findOne(id, centreId);
  }

  @ApiOperation({ summary: "Voir les données du reçu d'une inscription" })
  @Get(':id/receipt')
  getRecu(@Param('id') id: string, @CentreId() centreId: string) {
    return this.inscriptionsService.findOne(id, centreId);
  }

  @ApiOperation({ summary: "Lister toutes les factures stockées sur AWS S3, de la plus récente à la plus ancienne" })
  @UseGuards(RolesGuard)
  @Roles('admin', 'secretariat')
  @Get('factures/liste')
  listerFactures(@CentreId() centreId: string) {
    return this.inscriptionsService.listerFactures(centreId);
  }

  @ApiOperation({ summary: "Obtenir un lien temporaire pour consulter/réimprimer la facture PDF stockée sur AWS S3" })
  @UseGuards(RolesGuard)
  @Roles('admin', 'secretariat')
  @Get(':id/facture')
  urlFacture(@Param('id') id: string, @CentreId() centreId: string) {
    return this.inscriptionsService.urlFacture(id, centreId);
  }

  @ApiOperation({ summary: "Noter une impression du reçu (à partir de la 2e : DUPLICATA)" })
  @Post(':id/print')
  imprimer(@Param('id') id: string, @CentreId() centreId: string) {
    return this.inscriptionsService.enregistrerImpression(id, centreId);
  }

  @ApiOperation({ summary: 'Ajouter un paiement complémentaire' })
  @Patch(':id/payment')
  ajouterPaiement(
    @Param('id') id: string,
    @Body() dto: AjouterPaiementDto,
    @CentreId() centreId: string,
    @Req() req: any,
  ) {
    return this.inscriptionsService.ajouterPaiement(
      id,
      dto.montant,
      dto.modePaiement ?? 'especes',
      centreId,
      req.user.userId,
    );
  }

  @ApiOperation({
    summary:
      "Corriger une facture (motif obligatoire). La secrétaire ne change que le régime et les dates ; les montants sont réservés à l'administrateur",
  })
  @UseGuards(RolesGuard)
  @Roles('admin', 'secretariat')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateInscriptionDto: UpdateInscriptionDto,
    @CentreId() centreId: string,
    @Req() req: any,
  ) {
    const sortie: { changements?: Changement[] } = {};
    const resultat = await this.inscriptionsService.update(
      id,
      updateInscriptionDto,
      centreId,
      req.user.userId,
      req.user.role,
      sortie,
    );
    // Lu par le journal (historique) : ancienne et nouvelle valeur de chaque champ
    req.changementsHistorique = sortie.changements ?? [];
    return resultat;
  }

  // Pas de route de suppression : une facture ne s'efface jamais, elle se corrige.
}