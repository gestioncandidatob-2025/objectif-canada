import { IsEmail, IsIn, IsNotEmpty, IsOptional, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../schemas/user.schema';

// Règle unique pour tous les mots de passe : 6 caractères minimum, sans autre contrainte
export const REGEX_MOT_DE_PASSE = /^.{6,}$/;
export const MESSAGE_MOT_DE_PASSE =
  'Le mot de passe doit contenir au moins 6 caractères';

/** Création d'un centre (inscription ou super admin) : même règle */
export const MESSAGE_MOT_DE_PASSE_CENTRE = MESSAGE_MOT_DE_PASSE;

export class CreateUserDto {
  @ApiProperty({ example: 'Marie Fotso', description: "Nom complet de l'utilisateur" })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  nom!: string;

  @ApiProperty({ example: 'marie@objectifcanada.com', description: "Email de connexion" })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: 'MotDePasse123!', description: 'Mot de passe (sera chiffré automatiquement)' })
  @MinLength(6, { message: MESSAGE_MOT_DE_PASSE })
  @Matches(REGEX_MOT_DE_PASSE, { message: MESSAGE_MOT_DE_PASSE })
  motDePasse!: string;

  // Un administrateur de centre ne peut créer que des comptes secrétariat ou
  // admin. Le rôle super_admin n'est jamais attribuable depuis l'application.
  @ApiPropertyOptional({ enum: [Role.SECRETARIAT, Role.ADMIN], example: Role.SECRETARIAT, description: 'Rôle (secretariat par défaut si non fourni)' })
  @IsOptional()
  @IsIn([Role.SECRETARIAT, Role.ADMIN], { message: 'Rôle invalide' })
  role?: Role;
}