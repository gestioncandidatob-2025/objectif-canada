import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Groupe, GroupeSchema } from './schemas/groupe.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { GroupesService } from './groupes.service';
import { GroupesController } from './groupes.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Groupe.name, schema: GroupeSchema },
      // Pour compter les candidats de chaque groupe
      { name: Inscription.name, schema: InscriptionSchema },
    ]),
  ],
  controllers: [GroupesController],
  providers: [GroupesService],
  exports: [GroupesService],
})
export class GroupesModule {}