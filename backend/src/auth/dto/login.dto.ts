import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'aicha@objectifcanada.com', description: "Email de l'utilisateur" })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: 'MonMotDePasse123', description: "Mot de passe de l'utilisateur" })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  motDePasse!: string;
}