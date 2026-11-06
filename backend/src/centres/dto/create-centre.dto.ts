import { IsEmail, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MESSAGE_MOT_DE_PASSE, REGEX_MOT_DE_PASSE } from '../../users/dto/create-user.dto';

/** Création d'un centre et de son premier administrateur (par le super admin) */
export class CreateCentreDto {
  @ApiProperty({ example: 'Centre Excellence Langues' })
  @IsNotEmpty({ message: 'Le nom du centre est obligatoire' })
  nom!: string;

  @ApiPropertyOptional({ example: 'Yaoundé' })
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ example: '+237 6 99 00 00 00' })
  @IsOptional()
  telephone?: string;

  @ApiProperty({ example: 'Paul Mbarga', description: "Nom de l'administrateur du centre" })
  @IsNotEmpty({ message: "Le nom de l'administrateur est obligatoire" })
  adminNom!: string;

  @ApiProperty({ example: 'paul@excellence-langues.cm' })
  @IsEmail({}, { message: "Email de l'administrateur invalide" })
  adminEmail!: string;

  @ApiProperty({ example: 'MotDePasse123!' })
  @MinLength(8, { message: MESSAGE_MOT_DE_PASSE })
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  adminMotDePasse!: string;
}