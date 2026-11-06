import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MESSAGE_MOT_DE_PASSE, REGEX_MOT_DE_PASSE } from '../../users/dto/create-user.dto';

// Enlève les espaces au début et à la fin de ce que la personne a tapé
const enleverEspaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Formulaire public « Inscrire mon centre » */
export class RegisterCenterDto {
  @ApiProperty({ example: 'Centre Excellence Langues', description: 'Nom du centre (unique)' })
  @Transform(enleverEspaces)
  @IsString()
  @IsNotEmpty({ message: 'Le nom du centre est obligatoire' })
  @MaxLength(100, { message: 'Le nom du centre ne doit pas dépasser 100 caractères' })
  nomCentre!: string;

  @ApiProperty({ example: 'Paul Mbarga', description: 'Nom du responsable du centre' })
  @Transform(enleverEspaces)
  @IsString()
  @IsNotEmpty({ message: 'Ton nom est obligatoire' })
  @MaxLength(100, { message: 'Ton nom ne doit pas dépasser 100 caractères' })
  nom!: string;

  @ApiProperty({ example: 'paul@excellence-langues.cm', description: 'Email de connexion' })
  // Email en minuscules : "Paul@Mail.com" et "paul@mail.com" = le même compte
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: '+237 699 00 00 00', description: 'Téléphone du centre' })
  @Transform(enleverEspaces)
  @Matches(/^[+\d\s().-]{8,20}$/, { message: 'Numéro de téléphone invalide' })
  telephone!: string;

  @ApiProperty({ example: 'MotDePasse123!' })
  @MinLength(8, { message: MESSAGE_MOT_DE_PASSE })
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  motDePasse!: string;
}