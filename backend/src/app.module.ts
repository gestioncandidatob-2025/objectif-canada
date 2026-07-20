import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CandidatsModule } from './candidats/candidats.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI as string),
    CandidatsModule,
    InscriptionsModule,
    UsersModule,
    AuthModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}