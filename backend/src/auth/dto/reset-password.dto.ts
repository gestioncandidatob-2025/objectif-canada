import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'secretaire1@objectifcanada.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty({ message: 'Le code est obligatoire' })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir 6 chiffres' })
  code!: string;

  @ApiProperty({ example: 'NouveauMotDePasse123' })
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire' })
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  nouveauMotDePasse!: string;
}