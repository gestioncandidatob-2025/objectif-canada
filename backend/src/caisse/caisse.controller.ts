import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { CaisseService, Cible } from './caisse.service';

/**
 * Point de caisse.
 * - L'administrateur voit la caisse de chaque personne du centre (paramètre
 *   "person"). Les totaux de tout le centre sont dans le tableau de bord.
 * - La secrétaire ne voit que la sienne : le paramètre "person" est ignoré.
 * - Le paramètre "date" (AAAA-MM-JJ) permet de revoir un jour passé.
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'secretariat')
@Controller('cash-register')
export class CaisseController {
  constructor(private readonly caisseService: CaisseService) {}

  /** Transforme le paramètre "person" en caisse à afficher, selon le rôle */
  private cible(req: any, person?: string): Cible {
    if (req.user.role !== 'admin' || !person) {
      return { userId: req.user.userId };
    }
    if (person.startsWith('nom:')) {
      return { nom: person.slice(4) };
    }
    if (!Types.ObjectId.isValid(person)) {
      throw new BadRequestException('Personne invalide');
    }
    return { userId: person };
  }

  /** Vérifie le format de la date (ou l'ignore si elle est absente) */
  private date(date?: string) {
    if (!date) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('La date doit être au format AAAA-MM-JJ');
    }
    return date;
  }

  @ApiOperation({ summary: 'Personnes du centre dont on peut voir la caisse (onglets)' })
  @Get('staff')
  async personnel(@CentreId() centreId: string, @Req() req: any) {
    if (req.user.role !== 'admin') {
      const tous = await this.caisseService.personnel(centreId);
      return tous.filter((p) => p.id === req.user.userId);
    }
    return this.caisseService.personnel(centreId);
  }

  @ApiOperation({ summary: "Totaux du jour, de la semaine et du mois (espèces, mobile, inscriptions, restes à payer)" })
  @ApiQuery({ name: 'person', required: false, description: "Identifiant du compte, ou 'nom:<nom>' pour un ancien nom" })
  @ApiQuery({ name: 'date', required: false, description: 'Jour à afficher (AAAA-MM-JJ), aujourd\'hui par défaut' })
  @Get('summary')
  resume(
    @CentreId() centreId: string,
    @Req() req: any,
    @Query('person') person?: string,
    @Query('date') date?: string,
  ) {
    return this.caisseService.resume(centreId, this.cible(req, person), this.date(date));
  }

  @ApiOperation({ summary: 'Détail des paiements encaissés le jour choisi' })
  @ApiQuery({ name: 'person', required: false })
  @ApiQuery({ name: 'date', required: false })
  @Get('today')
  detailDuJour(
    @CentreId() centreId: string,
    @Req() req: any,
    @Query('person') person?: string,
    @Query('date') date?: string,
  ) {
    return this.caisseService.detailDuJour(centreId, this.cible(req, person), this.date(date));
  }
}