import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AjouterPaiementDto {
  @ApiProperty({ example: 5000, description: 'Montant du paiement complémentaire à ajouter' })
  @IsNumber()
  @IsPositive({ message: 'Le montant doit être positif' })
  montant!: number;
}