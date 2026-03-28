import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  // Ensure upload directories exist
  const uploadsPath = join(process.cwd(), 'uploads');
  const signaturesPath = join(uploadsPath, 'signatures');
  const defaultsPath = join(uploadsPath, 'defaults');
  const templatesPath = join(uploadsPath, 'templates');
  for (const dir of [uploadsPath, signaturesPath, defaultsPath, templatesPath]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Serve uploaded images as static files
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

