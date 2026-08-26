import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty({ example: 'secretaire1@objectifcanada.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;
}