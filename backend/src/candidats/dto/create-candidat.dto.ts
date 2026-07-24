import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCandidatDto {
  @ApiProperty({ example: 'Kamga', description: 'Nom de famille du candidat' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @IsString()
  nom!: string;

  @ApiProperty({ example: 'Jean', description: 'Prénom du candidat' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @IsString()
  prenom!: string;

  @ApiProperty({ example: '+237600000000', description: 'Numéro de téléphone du candidat' })
  @IsNotEmpty({ message: 'Le téléphone est obligatoire' })
  @IsString()
  telephone!: string;
}