import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { REGEX_MOT_DE_PASSE, MESSAGE_MOT_DE_PASSE } from '../../users/dto/create-user.dto';

export class ResetPasswordDto {
  @ApiProperty({ example: 'secretaire1@objectifcanada.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty({ message: 'Le code est obligatoire' })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir 6 chiffres' })
  code!: string;

  @ApiProperty({ example: 'NouveauMotDePasse123!' })
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire' })
  @IsString()
  @MinLength(8, { message: MESSAGE_MOT_DE_PASSE })
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  nouveauMotDePasse!: string;
}