import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Historique, HistoriqueSchema } from './schemas/historique.schema';
import { HistoriqueService } from './historique.service';
import { HistoriqueController } from './historique.controller';
import { HistoriqueLogInterceptor } from './historique-log.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Historique.name, schema: HistoriqueSchema },
    ]),
  ],
  controllers: [HistoriqueController],
  providers: [
    HistoriqueService,
    { provide: APP_INTERCEPTOR, useClass: HistoriqueLogInterceptor },
  ],
  exports: [HistoriqueService],
})
export class HistoriqueModule {}