import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

/** Le super admin change les prix ou les limites d'un plan */
export class ModifierPlanDto {
  @ApiPropertyOptional({ example: 10000, description: 'Prix par mois en FCFA (null : pas de paiement au mois)' })
  @IsOptional()
  @ValidateIf((_o, valeur) => valeur !== null)
  @IsInt({ message: 'Le prix doit être un nombre entier' })
  @Min(0)
  prixMensuel?: number | null;

  @ApiPropertyOptional({ example: 100000, description: "Prix par an en FCFA (null : pas de paiement à l'année)" })
  @IsOptional()
  @ValidateIf((_o, valeur) => valeur !== null)
  @IsInt({ message: 'Le prix doit être un nombre entier' })
  @Min(0)
  prixAnnuel?: number | null;

  @ApiPropertyOptional({ example: 100, description: 'Factures par mois' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Au moins 1 facture par mois' })
  factures?: number;

  @ApiPropertyOptional({ example: 3, description: 'Nombre de comptes' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Au moins 1 compte' })
  comptes?: number;
}

/** Prix et limites d'un centre au plan Sur mesure */
export class SurMesureDto {
  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  factures?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  comptes?: number;

  @ApiPropertyOptional({ example: 40000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prixMensuel?: number;

  @ApiPropertyOptional({ example: 400000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  prixAnnuel?: number;
}

/**
 * Le super admin règle à la main l'abonnement d'un centre : plan offert,
 * Sur mesure, paiement reçu en dehors de CamPay…
 */
export class ReglerAbonnementDto {
  @ApiProperty({ example: 'sur_mesure', description: 'gratuit, standard, pro ou sur_mesure' })
  @IsString()
  @IsIn(['gratuit', 'standard', 'pro', 'sur_mesure'], { message: 'Plan inconnu' })
  plan!: string;

  @ApiPropertyOptional({ enum: ['mensuel', 'annuel'] })
  @IsOptional()
  @IsIn(['mensuel', 'annuel'])
  periodicite?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: "Payé jusqu'à cette date. Vide : sans date de fin (plan offert)",
  })
  @IsOptional()
  @ValidateIf((_o, valeur) => valeur !== null)
  @IsDateString({}, { message: 'Date de fin invalide' })
  finAbonnement?: string | null;

  @ApiPropertyOptional({ type: SurMesureDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SurMesureDto)
  surMesure?: SurMesureDto;
}