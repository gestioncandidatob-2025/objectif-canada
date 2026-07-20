import { PartialType } from '@nestjs/swagger';
import { CreateInscriptionDto } from './create-inscription.dto';

export class UpdateInscriptionDto extends PartialType(CreateInscriptionDto) {}
