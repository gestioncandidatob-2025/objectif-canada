import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Centre, CentreSchema } from './schemas/centre.schema';
import { CentresService } from './centres.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Centre.name, schema: CentreSchema }]),
  ],
  providers: [CentresService],
  exports: [CentresService],
})
export class CentresModule {}