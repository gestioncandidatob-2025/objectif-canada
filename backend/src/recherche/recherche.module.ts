import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Candidat, CandidatSchema } from '../candidats/schemas/candidat.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { RechercheService } from './recherche.service';
import { RechercheController } from './recherche.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Candidat.name, schema: CandidatSchema },
      { name: Inscription.name, schema: InscriptionSchema },
    ]),
  ],
  controllers: [RechercheController],
  providers: [RechercheService],
  exports: [RechercheService],
})
export class RechercheModule {}