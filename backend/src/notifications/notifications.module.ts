import { Module } from '@nestjs/common';
import { NotificationsCronService } from './notifications-cron.service';
import { InscriptionsModule } from '../inscriptions/inscriptions.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [InscriptionsModule, UsersModule, MailModule],
  providers: [NotificationsCronService],
})
export class NotificationsModule {}