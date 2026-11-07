import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Réglages d'un bloc de groupes par l'administrateur (page Groupes).
 * Un bloc = un service, ou un service et un régime. Le groupe 1 existe
 * toujours ; le groupe 2 est facultatif. Les capacités sont facultatives
 * (null = pas de limite).
 */
export class UpdateBlocGroupesDto {
  @ApiProperty({ example: 'tcf', description: 'Service du bloc (tel que dans Paramètres → Services)' })
  @IsString()
  @IsNotEmpty({ message: 'Le service est obligatoire' })
  service!: string;

  @ApiPropertyOptional({ example: 'soir', nullable: true, description: 'Régime du bloc (null = service sans régime)' })
  @IsOptional()
  @IsString()
  regime?: string | null;

  @ApiPropertyOptional({ example: 25, nullable: true, description: 'Capacité du groupe 1 (null = pas de limite)' })
  @IsOptional()
  @IsInt({ message: 'La capacité doit être un nombre entier' })
  @Min(1, { message: 'La capacité doit être d’au moins 1 place' })
  @Max(1000, { message: 'La capacité ne doit pas dépasser 1000 places' })
  capacite1?: number | null;

  @ApiProperty({ example: true, description: 'Le groupe 2 est-il coché ?' })
  @IsBoolean({ message: 'deuxiemeGroupeActif doit valoir true ou false' })
  deuxiemeGroupeActif!: boolean;

  @ApiPropertyOptional({
    example: 14,
    nullable: true,
    description: 'Nombre de jours avant le passage dans le groupe 2 (obligatoire si le groupe 2 est coché)',
  })
  @IsOptional()
  @IsInt({ message: 'Le nombre de jours doit être un nombre entier' })
  @Min(1, { message: 'Le nombre de jours doit être d’au moins 1' })
  @Max(365, { message: 'Le nombre de jours ne doit pas dépasser 365' })
  joursAvantPassage?: number | null;

  @ApiPropertyOptional({ example: 25, nullable: true, description: 'Capacité du groupe 2 (null = pas de limite)' })
  @IsOptional()
  @IsInt({ message: 'La capacité doit être un nombre entier' })
  @Min(1, { message: 'La capacité doit être d’au moins 1 place' })
  @Max(1000, { message: 'La capacité ne doit pas dépasser 1000 places' })
  capacite2?: number | null;
}