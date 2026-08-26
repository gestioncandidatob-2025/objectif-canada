import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTarifDto {
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({ example: ['jour', 'soir'], description: 'Liste des régimes proposés' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regimes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le prix ne peut pas être négatif' })
  prix?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La durée ne peut pas être négative' })
  dureeJours?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @ApiPropertyOptional({ description: 'La date de fin doit-elle être saisie manuellement dans le formulaire d\'inscription ?' })
  @IsOptional()
  @IsBoolean()
  dateFinNecessaire?: boolean;

  @ApiPropertyOptional({ description: 'Le champ remise doit-il être proposé dans le formulaire d\'inscription ?' })
  @IsOptional()
  @IsBoolean()
  remiseActive?: boolean;

  @ApiPropertyOptional({ description: 'Le champ régime (et date de début du test) doit-il être proposé dans le formulaire d\'inscription ?' })
  @IsOptional()
  @IsBoolean()
  regimeActif?: boolean;

  @ApiPropertyOptional({ description: 'Le montant est-il négocié librement à chaque inscription ?' })
  @IsOptional()
  @IsBoolean()
  montantNegociable?: boolean;
}