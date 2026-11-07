import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Groupe, GroupeSchema } from './schemas/groupe.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { Tarif, TarifSchema } from '../tarifs/schemas/tarif.schema';
import { GroupesService } from './groupes.service';
import { GroupesController } from './groupes.controller';
import { GroupesCronService } from './groupes-cron.service';
import { CentresModule } from '../centres/centres.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Groupe.name, schema: GroupeSchema },
      // Pour compter les candidats de chaque groupe
      { name: Inscription.name, schema: InscriptionSchema },
      // Les régimes des services donnent la liste des groupes
      { name: Tarif.name, schema: TarifSchema },
    ]),
    // Liste des centres actifs, pour le passage automatique de chaque nuit
    CentresModule,
  ],
  controllers: [GroupesController],
  providers: [GroupesService, GroupesCronService],
  exports: [GroupesService],
})
export class GroupesModule {}