import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Centre, CentreSchema } from '../centres/schemas/centre.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { PaiementAbonnement, PaiementAbonnementSchema } from './schemas/paiement-abonnement.schema';
import { CampayService } from './campay.service';
import { AbonnementsService } from './abonnements.service';
import { AbonnementsSuperAdminService } from './abonnements-super-admin.service';
import { AbonnementsController } from './abonnements.controller';
import { CampayWebhookController } from './campay-webhook.controller';
import { AbonnementsSuperAdminController } from './abonnements-super-admin.controller';

/**
 * Abonnements des centres (plans, limites, paiement CamPay).
 * Ce module n'importe aucun autre module de l'application : il peut donc
 * être importé par Inscriptions et Users (pour vérifier les limites) sans
 * créer de boucle.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Centre.name, schema: CentreSchema },
      { name: Inscription.name, schema: InscriptionSchema },
      { name: User.name, schema: UserSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: PaiementAbonnement.name, schema: PaiementAbonnementSchema },
    ]),
  ],
  controllers: [AbonnementsController, CampayWebhookController, AbonnementsSuperAdminController],
  providers: [CampayService, AbonnementsService, AbonnementsSuperAdminService],
  exports: [AbonnementsService],
})
export class AbonnementsModule {}