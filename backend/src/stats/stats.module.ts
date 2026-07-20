import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { Candidat, CandidatSchema } from '../candidats/schemas/candidat.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inscription.name, schema: InscriptionSchema },
      { name: Candidat.name, schema: CandidatSchema },
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}