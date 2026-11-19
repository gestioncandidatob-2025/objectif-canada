import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationCaisse, VerificationCaisseSchema } from './schemas/verification-caisse.schema';
import { Paiement, PaiementSchema } from '../caisse/schemas/paiement.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MailModule } from '../mail/mail.module';
import { CentresModule } from '../centres/centres.module';
import { VerificationsCaisseService } from './verifications-caisse.service';
import { VerificationsCaisseController } from './verifications-caisse.controller';
import { VerificationsCaisseCron } from './verifications-caisse.cron';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VerificationCaisse.name, schema: VerificationCaisseSchema },
      { name: Paiement.name, schema: PaiementSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MailModule,
    CentresModule,
  ],
  controllers: [VerificationsCaisseController],
  providers: [VerificationsCaisseService, VerificationsCaisseCron],
})
export class VerificationsCaisseModule {}