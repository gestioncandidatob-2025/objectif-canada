import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCandidatDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsNotEmpty({ message: 'La raison de la modification est obligatoire' })
  @IsString()
  raison!: string;
}