import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Paiement, PaiementSchema } from './schemas/paiement.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CaisseService } from './caisse.service';
import { CaisseController } from './caisse.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Paiement.name, schema: PaiementSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CaisseController],
  providers: [CaisseService],
  exports: [CaisseService],
})
export class CaisseModule {}