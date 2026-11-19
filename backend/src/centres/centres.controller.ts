import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { CentresService } from './centres.service';
import { CreateCentreDto } from './dto/create-centre.dto';
import { UpdateStatutCentreDto } from './dto/update-statut-centre.dto';
import { UpdateCentreDto } from './dto/update-centre.dto';
import { CentresSuperAdminService } from './centres-super-admin.service';
import { UsersService } from '../users/users.service';

/**
 * Espace super admin (équipe HREFF) : gestion des centres.
 * Le super admin n'a accès à aucune donnée d'un centre (candidats, factures…).
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('centers')
export class CentresController {
  constructor(
    private readonly centresService: CentresService,
    private readonly usersService: UsersService,
    private readonly superAdminService: CentresSuperAdminService,
  ) {}

  @ApiOperation({
    summary: 'Lister tous les centres avec leur admin et leur nombre de factures — super admin',
  })
  @Get()
  lister() {
    return this.superAdminService.lister();
  }

  @ApiOperation({ summary: 'Créer un centre et son premier administrateur — super admin' })
  @Post()
  async creer(@Body() dto: CreateCentreDto) {
    // Vérifier l'email avant de créer le centre, pour ne pas laisser un centre sans admin
    if (await this.usersService.findByEmail(dto.adminEmail)) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const centre = await this.centresService.creer({
      nom: dto.nom,
      ville: dto.ville,
      telephone: dto.telephone,
    });

    try {
      const admin = await this.usersService.create(
        { nom: dto.adminNom, email: dto.adminEmail, motDePasse: dto.adminMotDePasse, role: Role.ADMIN },
        String(centre._id),
      );
      return { centre, admin: { id: admin._id, nom: admin.nom, email: admin.email } };
    } catch (erreur) {
      // L'administrateur n'a pas pu être créé : on annule la création du centre
      await this.centresService.supprimer(String(centre._id));
      throw erreur;
    }
  }

  @ApiOperation({
    summary: "Modifier un centre (nom, ville, téléphone, email de l'admin) — super admin",
  })
  @Patch(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateCentreDto) {
    return this.superAdminService.modifier(id, dto);
  }

  @ApiOperation({
    summary: 'Supprimer un centre sans aucune facture (sinon : le suspendre) — super admin',
  })
  @Delete(':id')
  supprimer(@Param('id') id: string) {
    return this.superAdminService.supprimer(id);
  }

  @ApiOperation({ summary: 'Suspendre ou réactiver un centre — super admin' })
  @Patch(':id/status')
  changerStatut(@Param('id') id: string, @Body() dto: UpdateStatutCentreDto) {
    return this.centresService.changerStatut(id, dto.statut);
  }
}