import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InscriptionsService } from './inscriptions.service';
import { InscriptionsController } from './inscriptions.controller';
import { Inscription, InscriptionSchema } from './schemas/inscription.schema';
import { Candidat, CandidatSchema } from '../candidats/schemas/candidat.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inscription.name, schema: InscriptionSchema },
      { name: Candidat.name, schema: CandidatSchema },
    ]),
  ],
  controllers: [InscriptionsController],
  providers: [InscriptionsService],
})
export class InscriptionsModule {}