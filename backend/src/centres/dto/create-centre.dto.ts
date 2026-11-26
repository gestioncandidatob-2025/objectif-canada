import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MESSAGE_MOT_DE_PASSE_CENTRE } from '../../users/dto/create-user.dto';

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

  // Création d'un centre : seulement 6 caractères minimum, sans autre règle
  @ApiProperty({ example: 'secret' })
  @MinLength(6, { message: MESSAGE_MOT_DE_PASSE_CENTRE })
  adminMotDePasse!: string;
}