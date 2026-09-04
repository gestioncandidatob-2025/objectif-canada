import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateInscriptionDto } from './create-inscription.dto';

export class UpdateInscriptionDto extends PartialType(CreateInscriptionDto) {
  @ApiProperty({
    example: 'Erreur de saisie sur le service choisi lors de l\'inscription',
    description: 'Raison de la modification (obligatoire, journalisée dans l\'historique)',
  })
  @IsNotEmpty({ message: 'La raison de la modification est obligatoire' })
  @IsString()
  raison!: string;
}