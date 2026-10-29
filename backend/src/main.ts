import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const appEnv = config.get<string>('APP_ENV');

  const origines = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  app.enableCors(origines.length > 0 ? { origin: origines, credentials: true } : undefined);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  if (config.get<boolean>('ENABLE_SWAGGER')) {
    const docConfig = new DocumentBuilder()
      .setTitle(`API Objectif Canada${appEnv === 'production' ? '' : ` [${appEnv}]`}`)
      .setDescription('Gestion des candidats, paiements et statistiques')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, docConfig));
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(
    `Environnement=${appEnv} | base=${config.get<string>('MONGODB_DB_NAME')} | ` +
      `crons=${config.get<boolean>('ENABLE_CRONS') ? 'actifs' : 'désactivés'} | port=${port}`,
  );
}
bootstrap();