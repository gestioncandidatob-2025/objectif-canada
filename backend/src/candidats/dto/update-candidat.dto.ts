import { PartialType } from '@nestjs/mapped-types';
import { CreateCandidatDto } from './create-candidat.dto';

export class UpdateCandidatDto extends PartialType(CreateCandidatDto) {}
