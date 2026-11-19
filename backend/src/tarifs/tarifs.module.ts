import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TarifsService } from './tarifs.service';
import { TarifsController } from './tarifs.controller';
import { Tarif, TarifSchema } from './schemas/tarif.schema';
import { Inscription, InscriptionSchema } from '../inscriptions/schemas/inscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tarif.name, schema: TarifSchema },
      // Pour savoir si un service a déjà été facturé avant de le supprimer
      { name: Inscription.name, schema: InscriptionSchema },
    ]),
  ],
  controllers: [TarifsController],
  providers: [TarifsService],
  exports: [TarifsService],
})
export class TarifsModule {}