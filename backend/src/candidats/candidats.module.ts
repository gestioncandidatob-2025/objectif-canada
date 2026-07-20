import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CandidatsService } from './candidats.service';
import { CandidatsController } from './candidats.controller';
import { Candidat, CandidatSchema } from './schemas/candidat.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Candidat.name, schema: CandidatSchema }]),
  ],
  controllers: [CandidatsController],
  providers: [CandidatsService],
})
export class CandidatsModule {}