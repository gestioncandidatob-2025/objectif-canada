import { Module } from '@nestjs/common';
import { NotificationsCronService } from './notifications-cron.service';
import { InscriptionsModule } from '../inscriptions/inscriptions.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { CentresModule } from '../centres/centres.module';

@Module({
  imports: [InscriptionsModule, UsersModule, MailModule, CentresModule],
  providers: [NotificationsCronService],
})
export class NotificationsModule {}