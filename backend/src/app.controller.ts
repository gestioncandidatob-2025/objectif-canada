import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly config: ConfigService,
    @InjectConnection() private readonly connexion: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return {
      status: this.connexion.readyState === 1 ? 'ok' : 'degrade',
      environnement: this.config.get<string>('APP_ENV'),
      baseDeDonnees: this.config.get<string>('MONGODB_DB_NAME'),
      commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
    };
  }
}