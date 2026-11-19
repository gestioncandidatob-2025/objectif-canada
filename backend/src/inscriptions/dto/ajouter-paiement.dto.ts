import { IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AjouterPaiementDto {
  @ApiProperty({ example: 5000, description: 'Montant du paiement complémentaire à ajouter' })
  @IsNumber()
  @IsPositive({ message: 'Le montant doit être positif' })
  montant!: number;

  // Comment le reste a été payé (pour le point de caisse). Espèces par défaut.
  @ApiPropertyOptional({ enum: ['especes', 'orange_money', 'mobile_money'], example: 'especes' })
  @IsOptional()
  @IsIn(['especes', 'orange_money', 'mobile_money'], { message: 'Mode de paiement invalide' })
  modePaiement?: string;
}