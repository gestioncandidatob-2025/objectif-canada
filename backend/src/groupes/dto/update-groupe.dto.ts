import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateGroupeDto } from './create-groupe.dto';

/** Modification d'un groupe : on n'envoie que ce qui change */
export class UpdateGroupeDto extends PartialType(CreateGroupeDto) {
  @ApiPropertyOptional({
    example: false,
    description: 'false = groupe désactivé (il ne reçoit plus de nouveaux inscrits)',
  })
  @IsOptional()
  @IsBoolean({ message: 'actif doit valoir true ou false' })
  actif?: boolean;
}