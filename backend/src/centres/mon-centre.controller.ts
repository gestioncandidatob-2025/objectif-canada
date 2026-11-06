import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../users/schemas/user.schema';
import { CentreId } from '../common/centre-id.decorator';
import { MonCentreService } from './mon-centre.service';

/** Routes sur le centre de l'administrateur connecté */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('center')
export class MonCentreController {
  constructor(private readonly monCentreService: MonCentreService) {}

  @ApiOperation({
    summary: "Ce qu'il reste à configurer dans le centre (bandeau de rappel) — administrateur",
  })
  @Get('setup-status')
  setupStatus(@CentreId() centreId: string) {
    return this.monCentreService.etatConfiguration(centreId);
  }
}