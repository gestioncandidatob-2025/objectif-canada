import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Modification d'un centre par le super admin (tous les champs sont facultatifs) */
export class UpdateCentreDto {
  @ApiPropertyOptional({ example: 'Centre Excellence Langues' })
  @IsOptional()
  @IsNotEmpty({ message: 'Le nom du centre ne peut pas être vide' })
  nom?: string;

  @ApiPropertyOptional({ example: 'Yaoundé' })
  @IsOptional()
  ville?: string;

  @ApiPropertyOptional({ example: '+237 6 99 00 00 00' })
  @IsOptional()
  telephone?: string;

  @ApiPropertyOptional({
    example: 'nouvel-email@gmail.com',
    description: "Corrige l'email de l'administrateur principal (un nouveau code de vérification lui est envoyé)",
  })
  @IsOptional()
  @IsEmail({}, { message: "Email de l'administrateur invalide" })
  adminEmail?: string;
}