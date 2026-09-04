import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CandidatsModule } from './candidats/candidats.module';
import { InscriptionsModule } from './inscriptions/inscriptions.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StatsModule } from './stats/stats.module';
import { TarifsModule } from './tarifs/tarifs.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HistoriqueModule } from './historique/historique.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI as string),
    ScheduleModule.forRoot(),
    CandidatsModule,
    InscriptionsModule,
    UsersModule,
    AuthModule,
    StatsModule,
    TarifsModule,
    MailModule,
    NotificationsModule,
    HistoriqueModule,   
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}