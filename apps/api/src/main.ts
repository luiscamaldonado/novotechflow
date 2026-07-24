import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1 y no true: con true, una XFF forjada decide req.ip si el edge appendea (anexo trust proxy en docs/diagnostico-2026-07-24-deps-bundle.md)
  app.set('trust proxy', 1);

  // --- TEMPORAL [PROXY-PROBE] ---------------------------------------------
  // Instrumento de medicion de un solo uso: loguea las 3 primeras peticiones
  // del proceso para ver que cabeceras manda de verdad el edge de Railway
  // (X-Forwarded-For / X-Real-IP) y en que queda req.ip con trust proxy = 1.
  // Sin variables de entorno y sin dependencias; contador en memoria.
  // Se retira en un commit dedicado tras leer las 3 lineas (hash pendiente).
  let proxyProbeCount = 0;
  app.use(
    (
      req: {
        headers: Record<string, string | string[] | undefined>;
        ip?: string;
        ips?: string[];
        socket: { remoteAddress?: string };
      },
      _res: unknown,
      next: () => void,
    ) => {
      if (proxyProbeCount < 3) {
        proxyProbeCount++;
        const h = (name: string) =>
          name in req.headers ? JSON.stringify(req.headers[name]) : '<ausente>';
        console.log(
          `[PROXY-PROBE] ${proxyProbeCount}/3 ` +
            `xff=${h('x-forwarded-for')} ` +
            `x-real-ip=${h('x-real-ip')} ` +
            `req.ip=${JSON.stringify(req.ip)} ` +
            `req.ips=${JSON.stringify(req.ips)} ` +
            `socket=${JSON.stringify(req.socket.remoteAddress)}`,
        );
      }
      next();
    },
  );
  // --- FIN TEMPORAL [PROXY-PROBE] -----------------------------------------

  app.use(compression());

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

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

  // Ensure upload directories exist
  const uploadsPath = join(process.cwd(), 'uploads');
  const signaturesPath = join(uploadsPath, 'signatures');
  const defaultsPath = join(uploadsPath, 'defaults');
  const templatesPath = join(uploadsPath, 'templates');
  for (const dir of [
    uploadsPath,
    signaturesPath,
    defaultsPath,
    templatesPath,
  ]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Serve uploaded images as static files
  app.useStaticAssets(uploadsPath, { prefix: '/uploads/' });

  // Swagger / OpenAPI - desactivado salvo opt-in explicito.
  // setup() registra 4 rutas mediante httpAdapter.get(), fuera del router de
  // Nest: /api/docs, /api/docs-json, /api/docs-yaml y
  // /api/docs/swagger-ui-init.js (este ultimo lleva el spec incrustado).
  if (process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NovoTechFlow API')
      .setDescription('API de cotizaciones comerciales para NOVOTECHNO')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
