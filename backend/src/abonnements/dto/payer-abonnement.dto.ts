import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Paiement par carte : le plan et la durée */
export class PayerParCarteDto {
  @ApiProperty({ example: 'standard', description: 'standard, pro ou sur_mesure' })
  @IsString()
  @IsNotEmpty({ message: 'Choisis un plan' })
  plan!: string;

  @ApiProperty({ enum: ['mensuel', 'annuel'], example: 'mensuel' })
  @IsIn(['mensuel', 'annuel'], { message: 'Durée invalide (mensuel ou annuel)' })
  periodicite!: 'mensuel' | 'annuel';
}

/** Paiement Mobile Money : en plus, le numéro qui va payer */
export class PayerParMobileDto extends PayerParCarteDto {
  @ApiProperty({ example: '690000000', description: 'Numéro MTN ou Orange qui va payer' })
  @IsString()
  @IsNotEmpty({ message: 'Le téléphone est obligatoire' })
  telephone!: string;
}