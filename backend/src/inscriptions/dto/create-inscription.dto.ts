import { IsEnum, IsOptional, IsNumber, IsString, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Service, Regime, ModePaiement } from '../schemas/inscription.schema';

export class CreateInscriptionDto {
  @ApiProperty({ example: '68abc1234567890abcdef12', description: "Identifiant du candidat (obtenu via GET /candidats)" })
  @IsNotEmpty({ message: "L'identifiant du candidat est obligatoire" })
  @IsString()
  candidatId!: string;

  @ApiProperty({ enum: Service, example: Service.TCF, description: 'Service choisi' })
  @IsEnum(Service, { message: 'Service invalide' })
  service!: Service;

  @ApiPropertyOptional({ enum: Regime, example: Regime.SOIR, description: 'Régime (obligatoire sauf pour Examen blanc)' })
  @IsOptional()
  @IsEnum(Regime, { message: 'Régime invalide' })
  regime?: Regime;

  @ApiPropertyOptional({ example: '2026-07-25', description: 'Date de début du test (obligatoire sauf pour Examen blanc)' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début du test invalide' })
  dateDebutTest?: Date;

  @ApiProperty({ enum: ModePaiement, example: ModePaiement.MOBILE_ESPECES, description: 'Mode de paiement' })
  @IsEnum(ModePaiement, { message: 'Mode de paiement invalide' })
  modePaiement!: ModePaiement;

  @ApiPropertyOptional({ example: 45000, description: 'Montant négocié (uniquement pour TCF SPECIAL)' })
  @IsOptional()
  @IsNumber()
  montantNegocie?: number;

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