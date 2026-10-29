import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { validerEnvironnement } from './config/environnement';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validerEnvironnement,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        dbName: config.get<string>('MONGODB_DB_NAME'),
      }),
    }),
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