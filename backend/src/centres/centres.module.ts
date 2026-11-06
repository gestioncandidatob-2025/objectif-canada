import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Centre, CentreSchema } from './schemas/centre.schema';
import { CentresService } from './centres.service';
import { CentresSuperAdminService } from './centres-super-admin.service';
import { CentresController } from './centres.controller';
import { MonCentreService } from './mon-centre.service';
import { MonCentreController } from './mon-centre.controller';
import { UsersModule } from '../users/users.module';
import { FacturesModule } from '../factures/factures.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { Candidat, CandidatSchema } from '../candidats/schemas/candidat.schema';
import { Tarif, TarifSchema } from '../tarifs/schemas/tarif.schema';
import { Historique, HistoriqueSchema } from '../historique/schemas/historique.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Centre.name, schema: CentreSchema },
      // Utilisés par l'espace super admin (comptages, suppression d'un centre vide)
      // et par le bandeau de rappel de configuration
      { name: User.name, schema: UserSchema },
      { name: Inscription.name, schema: InscriptionSchema },
      { name: Candidat.name, schema: CandidatSchema },
      { name: Tarif.name, schema: TarifSchema },
      { name: Historique.name, schema: HistoriqueSchema },
    ]),
    UsersModule,
    // Envoi du logo sur S3
    FacturesModule,
  ],
  controllers: [CentresController, MonCentreController],
  providers: [CentresService, CentresSuperAdminService, MonCentreService],
  exports: [CentresService],
})
export class CentresModule {}