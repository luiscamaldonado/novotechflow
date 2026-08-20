import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { ExternalAppModule } from './external-app.module';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(ExternalAppModule);

  // 2 saltos medidos en produccion (2026-08-20): XFF = "IP cliente, salto
  // interno del edge". Numero exacto y no true: con true una XFF forjada
  // decide req.ip (mismo criterio que main.ts).
  app.set('trust proxy', 2);

  app.use(compression());

  // Limite explicito y no el default de Express: los cuerpos de este servicio son credenciales y codigos, de cientos de bytes. Fijarlo evita que un `json()` anadido despues lo abra sin que nadie lo note. Ver ADR de F11.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Sin Swagger, ni siquiera tras opt-in: este proceso no publica su
  // inventario de rutas. El fail-fast de JWT_SECRET y EXTERNAL_JWT_SECRET ya
  // lo hacen AuthModule/ExternalModule al definirse, antes de este bootstrap.

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
