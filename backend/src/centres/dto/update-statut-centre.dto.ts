import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StatutCentre } from '../schemas/centre.schema';

export class UpdateStatutCentreDto {
  @ApiProperty({ enum: StatutCentre, example: StatutCentre.SUSPENDU })
  @IsEnum(StatutCentre, { message: 'Statut invalide (actif ou suspendu)' })
  statut!: StatutCentre;
}