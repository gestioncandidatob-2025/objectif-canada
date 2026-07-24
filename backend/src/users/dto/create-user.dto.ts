import { IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../schemas/user.schema';

export class CreateUserDto {
  @ApiProperty({ example: 'Marie Fotso', description: "Nom complet de l'utilisateur" })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  nom!: string;

  @ApiProperty({ example: 'marie@objectifcanada.com', description: "Email de connexion" })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: 'MotDePasse123', description: 'Mot de passe (sera chiffré automatiquement)' })
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse!: string;

  @ApiPropertyOptional({ enum: Role, example: Role.SECRETARIAT, description: 'Rôle (secretariat par défaut si non fourni)' })
  @IsOptional()
  @IsEnum(Role, { message: 'Rôle invalide' })
  role?: Role;
}