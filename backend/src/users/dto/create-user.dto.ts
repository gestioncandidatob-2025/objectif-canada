import { IsEmail, IsEnum, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../schemas/user.schema';

export const REGEX_MOT_DE_PASSE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const MESSAGE_MOT_DE_PASSE =
  'Le mot de passe doit contenir au moins 8 caractères, avec 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial';

export class CreateUserDto {
  @ApiProperty({ example: 'Marie Fotso', description: "Nom complet de l'utilisateur" })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  nom!: string;

  @ApiProperty({ example: 'marie@objectifcanada.com', description: "Email de connexion" })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: 'MotDePasse123!', description: 'Mot de passe (sera chiffré automatiquement)' })
  @MinLength(8, { message: MESSAGE_MOT_DE_PASSE })
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  motDePasse!: string;

  @ApiPropertyOptional({ enum: Role, example: Role.SECRETARIAT, description: 'Rôle (secretariat par défaut si non fourni)' })
  @IsOptional()
  @IsEnum(Role, { message: 'Rôle invalide' })
  role?: Role;
}