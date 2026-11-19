import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ModePaiement } from '../../inscriptions/schemas/inscription.schema';

// Enlève les espaces au début et à la fin de ce que la personne a tapé
const enleverEspaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Paramètres du centre modifiés par son administrateur (page Paramètres).
 * Tous les champs sont facultatifs : on n'envoie que ce qui change.
 * Seul le nom ne peut pas être vidé.
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Centre Excellence Langues' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @IsNotEmpty({ message: 'Le nom du centre est obligatoire' })
  @MaxLength(100, { message: 'Le nom du centre ne doit pas dépasser 100 caractères' })
  nom?: string;

  @ApiPropertyOptional({ example: 'Douala' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(100, { message: 'La ville ne doit pas dépasser 100 caractères' })
  ville?: string;

  @ApiPropertyOptional({ example: '+237 699 00 00 00' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(30, { message: 'Le téléphone ne doit pas dépasser 30 caractères' })
  telephone?: string;

  @ApiPropertyOptional({ example: 'Bonamoussadi, face pharmacie' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(200, { message: "L'adresse ne doit pas dépasser 200 caractères" })
  adresse?: string;

  @ApiPropertyOptional({ example: 'M012345678901A', description: "Numéro d'identifiant unique" })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(50, { message: 'Le NIU ne doit pas dépasser 50 caractères' })
  niu?: string;

  @ApiPropertyOptional({ example: 'RC/DLA/2024/B/1234', description: 'Registre du commerce' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(50, { message: 'Le RCCM ne doit pas dépasser 50 caractères' })
  rccm?: string;

  @ApiPropertyOptional({ example: 'Merci de votre confiance', description: 'Texte en bas du reçu' })
  @IsOptional()
  @Transform(enleverEspaces)
  @IsString()
  @MaxLength(300, { message: 'Le texte du reçu ne doit pas dépasser 300 caractères' })
  piedDePageRecu?: string;

  @ApiPropertyOptional({
    enum: ModePaiement,
    isArray: true,
    example: [ModePaiement.ESPECES, ModePaiement.ORANGE_MONEY],
    description: 'Modes de paiement acceptés (au moins un)',
  })
  @IsOptional()
  @IsArray({ message: 'Les modes de paiement doivent être une liste' })
  @ArrayMinSize(1, { message: 'Garde au moins un mode de paiement' })
  @ArrayUnique({ message: 'Un mode de paiement est en double' })
  @IsIn(Object.values(ModePaiement), { each: true, message: 'Mode de paiement invalide' })
  modesPaiement?: string[];
}