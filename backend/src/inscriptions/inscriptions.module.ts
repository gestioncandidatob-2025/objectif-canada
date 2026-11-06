import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InscriptionsService } from './inscriptions.service';
import { InscriptionsController } from './inscriptions.controller';
import { Inscription, InscriptionSchema } from './schemas/inscription.schema';
import { Candidat, CandidatSchema } from '../candidats/schemas/candidat.schema';
import { TarifsModule } from '../tarifs/tarifs.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { FacturesModule } from '../factures/factures.module';
import { CentresModule } from '../centres/centres.module';
import { GroupesModule } from '../groupes/groupes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inscription.name, schema: InscriptionSchema },
      { name: Candidat.name, schema: CandidatSchema },
    ]),
    TarifsModule,
    MailModule,
    UsersModule,
    FacturesModule,
    CentresModule,
    // Vérifier le groupe choisi sur la facture
    GroupesModule,
  ],
  controllers: [InscriptionsController],
  providers: [InscriptionsService],
  exports: [InscriptionsService],
})
export class InscriptionsModule {}