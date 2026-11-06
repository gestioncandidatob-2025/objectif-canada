import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Enlève les espaces au début et à la fin de ce que la personne a tapé
const enleverEspaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Création d'un groupe par l'administrateur */
export class CreateGroupeDto {
  @ApiProperty({ example: 'Soir 1', description: 'Nom du groupe (unique dans le centre)' })
  @Transform(enleverEspaces)
  @IsString()
  @IsNotEmpty({ message: 'Le nom du groupe est obligatoire' })
  @MaxLength(50, { message: 'Le nom du groupe ne doit pas dépasser 50 caractères' })
  nom!: string;

  @ApiPropertyOptional({ example: 'Lundi au vendredi, 17h - 19h' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(100, { message: "L'horaire ne doit pas dépasser 100 caractères" })
  horaire?: string;

  @ApiPropertyOptional({
    example: 25,
    nullable: true,
    description: 'Nombre de places (null = pas de limite)',
  })
  @IsOptional()
  @IsInt({ message: 'La capacité doit être un nombre entier' })
  @Min(1, { message: 'La capacité doit être d’au moins 1 place' })
  @Max(1000, { message: 'La capacité ne doit pas dépasser 1000 places' })
  capacite?: number | null;

  @ApiPropertyOptional({
    example: 'soir',
    nullable: true,
    description:
      'Régime dont ce groupe est le premier groupe : les nouveaux inscrits de ce régime y entrent automatiquement (null = aucun)',
  })
  @IsOptional()
  // Comparé sans majuscules ni espaces : "Soir", " soir " et "SOIR" = "soir"
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(50, { message: 'Le régime ne doit pas dépasser 50 caractères' })
  regimeEntree?: string | null;

  @ApiPropertyOptional({
    example: '68abc1234567890abcdef12',
    nullable: true,
    description: 'Groupe dans lequel passent les candidats après N jours (null = aucun)',
  })
  @IsOptional()
  @IsMongoId({ message: 'Groupe suivant invalide' })
  groupeSuivantId?: string | null;

  @ApiPropertyOptional({
    example: 14,
    nullable: true,
    description: 'Nombre de jours avant le passage dans le groupe suivant',
  })
  @IsOptional()
  @IsInt({ message: 'Le nombre de jours doit être un nombre entier' })
  @Min(1, { message: 'Le nombre de jours doit être d’au moins 1' })
  @Max(365, { message: 'Le nombre de jours ne doit pas dépasser 365' })
  joursAvantPassage?: number | null;
}