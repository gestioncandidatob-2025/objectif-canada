import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Un message de la discussion : la question de l'admin, ou une réponse de l'assistant */
export class MessageDiscussionDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsIn(['user', 'assistant'], { message: 'Rôle de message invalide' })
  role!: 'user' | 'assistant';

  @ApiProperty({ example: "Combien a-t-on encaissé aujourd'hui ?" })
  @IsString()
  @IsNotEmpty({ message: 'Le message est vide' })
  @MaxLength(2000, { message: 'Le message est trop long (2000 caractères maximum)' })
  content!: string;
}

export class DiscussionDto {
  // Les derniers messages seulement : le navigateur n'envoie pas toute la discussion
  @ApiProperty({ type: [MessageDiscussionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Pose une question' })
  @ArrayMaxSize(20, { message: 'La discussion est trop longue' })
  @ValidateNested({ each: true })
  @Type(() => MessageDiscussionDto)
  messages!: MessageDiscussionDto[];

  // Langue de l'interface : l'assistant répond dans cette langue
  @ApiPropertyOptional({ enum: ['fr', 'en'], example: 'fr' })
  @IsOptional()
  @IsIn(['fr', 'en'])
  langue?: 'fr' | 'en';
}