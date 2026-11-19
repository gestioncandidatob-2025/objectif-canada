import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Paiement, PaiementSchema } from '../caisse/schemas/paiement.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { Candidat, CandidatSchema } from '../candidats/schemas/candidat.schema';
import { Tarif, TarifSchema } from '../tarifs/schemas/tarif.schema';
import { CaisseModule } from '../caisse/caisse.module';
import { RechercheModule } from '../recherche/recherche.module';
import { UtilisationAssistant, UtilisationAssistantSchema } from './schemas/utilisation-assistant.schema';
import { AssistantOutilsService } from './assistant-outils.service';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Paiement.name, schema: PaiementSchema },
      { name: Inscription.name, schema: InscriptionSchema },
      { name: Candidat.name, schema: CandidatSchema },
      { name: Tarif.name, schema: TarifSchema },
      { name: UtilisationAssistant.name, schema: UtilisationAssistantSchema },
    ]),
    CaisseModule,
    RechercheModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantOutilsService, AssistantService],
})
export class AssistantModule {}