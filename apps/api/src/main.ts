import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
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

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NovoTechFlow API')
    .setDescription('API de cotizaciones comerciales para NOVOTECHNO')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

