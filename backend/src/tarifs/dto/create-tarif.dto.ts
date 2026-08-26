import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTarifDto {
  @ApiProperty({ example: 'tcf', description: 'Nom du service (existant ou nouveau)' })
  @IsNotEmpty({ message: 'Le service est obligatoire' })
  @IsString()
  service!: string;

  @ApiPropertyOptional({
    example: ['jour', 'soir'],
    description: 'Liste des régimes proposés (obligatoire si "régime actif" est coché)',
  })
  @ValidateIf((o) => o.regimeActif === true)
  @IsArray({ message: 'Il faut au moins un régime' })
  @ArrayMinSize(1, { message: 'Il faut au moins un régime' })
  @IsString({ each: true })
  regimes?: string[];

  @ApiPropertyOptional({ example: 65000, description: 'Prix en FCFA (obligatoire sauf si "montant négociable" est coché)' })
  @ValidateIf((o) => !o.montantNegociable)
  @IsNotEmpty({ message: 'Le prix est obligatoire (sauf si le montant est négociable)' })
  @IsNumber()
  @Min(0, { message: 'Le prix ne peut pas être négatif' })
  prix?: number;

  @ApiPropertyOptional({ example: 35, description: 'Durée de la formation en jours (obligatoire sauf si "date de fin nécessaire" est cochée)' })
  @ValidateIf((o) => !o.dateFinNecessaire)
  @IsNotEmpty({ message: 'La durée en jours est obligatoire (sauf si la date de fin est saisie manuellement)' })
  @IsNumber()
  @Min(0, { message: 'La durée ne peut pas être négative' })
  dureeJours?: number;

  @ApiPropertyOptional({ example: true, description: "L'offre est-elle active ?" })
  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @ApiPropertyOptional({ example: false, description: 'La date de fin doit-elle être saisie manuellement dans le formulaire d\'inscription ?' })
  @IsOptional()
  @IsBoolean()
  dateFinNecessaire?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Le champ remise doit-il être proposé dans le formulaire d\'inscription ?' })
  @IsOptional()
  @IsBoolean()
  remiseActive?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Le champ régime (et date de début du test) doit-il être proposé dans le formulaire d\'inscription ?' })
  @IsOptional()
  @IsBoolean()
  regimeActif?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Le montant est-il négocié librement à chaque inscription (au lieu du prix fixe) ?' })
  @IsOptional()
  @IsBoolean()
  montantNegociable?: boolean;
}