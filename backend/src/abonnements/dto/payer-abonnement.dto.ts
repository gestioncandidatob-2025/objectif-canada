import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Paiement par carte : le plan et la durée */
export class PayerParCarteDto {
  @ApiProperty({ example: 'standard', description: 'standard, pro ou sur_mesure' })
  @IsString()
  @IsNotEmpty({ message: 'Choisis un plan' })
  plan!: string;

  @ApiProperty({ enum: ['mensuel', 'annuel'], example: 'mensuel' })
  @IsIn(['mensuel', 'annuel'], { message: 'Durée invalide (mensuel ou annuel)' })
  periodicite!: 'mensuel' | 'annuel';

  // Plan Sur mesure : factures par mois choisies (obligatoire pour ce plan)
  @ApiPropertyOptional({ example: 500 })
  @ValidateIf((o) => o.plan === 'sur_mesure')
  @IsInt({ message: 'Indique un nombre de factures par mois' })
  @Min(1, { message: 'Indique un nombre de factures par mois' })
  @Max(1_000_000_000, { message: 'Nombre de factures trop grand' })
  factures?: number;

  // Plan Sur mesure : comptes souhaités (les comptes inclus sont ajoutés d'office)
  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt({ message: 'Indique un nombre de comptes' })
  @Min(1, { message: 'Indique un nombre de comptes' })
  @Max(1_000_000, { message: 'Nombre de comptes trop grand' })
  comptes?: number;
}

/** Paiement Mobile Money : en plus, le numéro qui va payer */
export class PayerParMobileDto extends PayerParCarteDto {
  @ApiProperty({ example: '690000000', description: 'Numéro MTN ou Orange qui va payer' })
  @IsString()
  @IsNotEmpty({ message: 'Le téléphone est obligatoire' })
  telephone!: string;
}