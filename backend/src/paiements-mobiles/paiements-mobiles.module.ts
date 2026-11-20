import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaiementMobile, PaiementMobileSchema } from './schemas/paiement-mobile.schema';
import { RetraitMobile, RetraitMobileSchema } from './schemas/retrait-mobile.schema';
import { ReglageMobile, ReglageMobileSchema } from './schemas/reglage-mobile.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { Centre, CentreSchema } from '../centres/schemas/centre.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AbonnementsModule } from '../abonnements/abonnements.module';
import { InscriptionsModule } from '../inscriptions/inscriptions.module';
import { MailModule } from '../mail/mail.module';
import { PaiementsMobilesService } from './paiements-mobiles.service';
import { PaiementsMobilesController } from './paiements-mobiles.controller';
import { CampayWebhookController } from './campay-webhook.controller';

/**
 * Paiement des candidats avec CamPay et retraits des centres.
 * Reçoit aussi la notification CamPay (webhook) de tout le compte HREFF,
 * y compris celle des abonnements, qu'il passe au module Abonnements.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaiementMobile.name, schema: PaiementMobileSchema },
      { name: RetraitMobile.name, schema: RetraitMobileSchema },
      { name: ReglageMobile.name, schema: ReglageMobileSchema },
      { name: Inscription.name, schema: InscriptionSchema },
      { name: Centre.name, schema: CentreSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // CampayService et AbonnementsService (limite de factures du plan)
    AbonnementsModule,
    // Création de la facture quand le paiement réussit
    InscriptionsModule,
    MailModule,
  ],
  controllers: [PaiementsMobilesController, CampayWebhookController],
  providers: [PaiementsMobilesService],
})
export class PaiementsMobilesModule {}