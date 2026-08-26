import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ example: 'secretaire1@objectifcanada.com' })
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty({ message: 'Le code est obligatoire' })
  @IsString()
  @Length(6, 6, { message: 'Le code doit contenir 6 chiffres' })
  code!: string;
}