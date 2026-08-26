import { IsEnum, IsOptional, IsNumber, IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModePaiement } from '../schemas/inscription.schema';

export class CreateInscriptionDto {
  @ApiProperty({ example: '68abc1234567890abcdef12', description: "Identifiant du candidat (obtenu via GET /candidats)" })
  @IsNotEmpty({ message: "L'identifiant du candidat est obligatoire" })
  @IsString()
  candidatId!: string;

  @ApiProperty({ example: 'tcf', description: 'Service choisi (doit correspondre à une offre active créée dans /tarifs)' })
  @IsNotEmpty({ message: 'Le service est obligatoire' })
  @IsString()
  service!: string;

  @ApiPropertyOptional({ example: 'soir', description: 'Régime — obligatoire uniquement si le service a "régime actif" coché dans /tarifs' })
  @IsOptional()
  @IsString()
  regime?: string;

  @ApiPropertyOptional({ example: '2026-07-25', description: 'Date de début du test — pertinente uniquement si le service a "régime actif" coché' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début du test invalide' })
  dateDebutTest?: Date;

  @ApiPropertyOptional({ example: '2026-08-30', description: 'Date de fin — obligatoire uniquement si le service a "date de fin nécessaire" cochée dans /tarifs' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide' })
  dateFin?: Date;
  
  @ApiProperty({ enum: ModePaiement, example: ModePaiement.MOBILE_ESPECES, description: 'Mode de paiement' })
  @IsEnum(ModePaiement, { message: 'Mode de paiement invalide' })
  modePaiement!: ModePaiement;

  @ApiPropertyOptional({ example: 45000, description: 'Montant négocié — obligatoire uniquement si le service a "montant négociable" coché dans /tarifs' })
  @IsOptional()
  @IsNumber()
  montantNegocie?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Remise accordée — pertinente uniquement si le service a "remise active" cochée dans /tarifs' })
  @IsOptional()
  @IsNumber()
  remise?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Montant payé (si mode de paiement simple)' })
  @IsOptional()
  @IsNumber()
  montantPaye?: number;

  @ApiPropertyOptional({ example: 25000, description: 'Montant payé en Mobile Money (si paiement mixte)' })
  @IsOptional()
  @IsNumber()
  montantMobile?: number;

  @ApiPropertyOptional({ example: 15000, description: 'Montant payé en Espèces (si paiement mixte)' })
  @IsOptional()
  @IsNumber()
  montantEspeces?: number;

  @ApiProperty({ example: 'Secretaire 1', description: 'Nom de la personne ayant facturé' })
  @IsNotEmpty({ message: 'Le champ "facturé par" est obligatoire' })
  @IsString()
  facturePar!: string;

  @ApiPropertyOptional({ example: 'REF-2026-0001', description: 'Référence libre' })
  @IsOptional()
  @IsString()
  reference?: string;
}