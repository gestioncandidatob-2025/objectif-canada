import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { CreateInscriptionDto } from '../../inscriptions/dto/create-inscription.dto';

/**
 * Nouvelle facture payée avec CamPay : les mêmes informations qu'une facture
 * normale (sans le mode de paiement, qui est forcément CamPay), plus le
 * numéro du candidat qui va valider avec son code PIN.
 */
export class PayerFactureMobileDto extends OmitType(CreateInscriptionDto, [
  'modePaiement',
  'montantMobile',
  'montantEspeces',
] as const) {
  @ApiProperty({ example: '690000000', description: 'Numéro MTN ou Orange du candidat' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  telephone!: string;
}

/** Reste à payer d'une facture existante, payé avec CamPay */
export class PayerResteMobileDto {
  @ApiProperty({ description: 'Identifiant de la facture' })
  @IsMongoId({ message: 'Facture invalide' })
  inscriptionId!: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @IsPositive({ message: 'Le montant doit être positif' })
  montant!: number;

  @ApiProperty({ example: '690000000' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  telephone!: string;
}

/** Demande de retrait de l'administrateur d'un centre */
export class DemanderRetraitDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive({ message: 'Le montant doit être positif' })
  montant!: number;

  @ApiProperty({ example: '690000000', description: 'Numéro MTN ou Orange qui reçoit l’argent' })
  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire' })
  telephone!: string;
}

/** Refus d'un retrait par le super admin */
export class RefuserRetraitDto {
  @ApiPropertyOptional({ example: 'Numéro incorrect, refais la demande' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  raison?: string;
}

/** Réglages modifiables par le super admin */
export class ModifierReglagesMobileDto {
  @ApiPropertyOptional({ example: 2.5, description: 'Frais CamPay en %' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Les frais ne peuvent pas être négatifs' })
  @Max(50, { message: 'Frais trop élevés' })
  tauxFraisCampay?: number;

  @ApiPropertyOptional({ example: 0, description: 'Commission HREFF en %' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La commission ne peut pas être négative' })
  @Max(50, { message: 'Commission trop élevée' })
  tauxCommission?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Retrait minimum en FCFA' })
  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'Le retrait minimum doit être d’au moins 100 F' })
  retraitMinimum?: number;
}