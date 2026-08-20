import 'dotenv/config';
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

  // 2 saltos medidos en produccion (2026-08-20): XFF = "IP cliente, salto interno del edge". Numero exacto y no true: con true una XFF forjada decide req.ip.
  app.set('trust proxy', 2);

  // TEMPORARY [PROXY-PROBE-F9] instrumentacion de diagnostico, se revierte en el commit siguiente.
  let probeF9Count = 0;
  app.use(
    (
      req: {
        method?: string;
        originalUrl?: string;
        headers?: Record<string, string | string[] | undefined>;
        ip?: string;
        ips?: string[];
        socket?: { remoteAddress?: string };
      },
      _res: unknown,
      next: () => void,
    ) => {
      const tag = req.headers?.['x-probe-tag'];
      if (tag && probeF9Count < 60) {
        probeF9Count++;
        const h = (name: string) =>
          req.headers && name in req.headers
            ? JSON.stringify(req.headers[name])
            : '<ausente>';
        const extra = Object.keys(req.headers ?? {})
          .filter(
            (k) =>
              k.startsWith('x-forwarded') ||
              k.startsWith('x-envoy') ||
              k === 'forwarded' ||
              k === 'cf-connecting-ip' ||
              k === 'true-client-ip' ||
              k === 'x-client-ip',
          )
          .map((k) => `${k}=${JSON.stringify(req.headers?.[k])}`)
          .join(' ');
        console.log(
          `[PROXY-PROBE-F9] ${probeF9Count} tag=${JSON.stringify(tag)} ` +
            `${req.method} ${req.originalUrl} ` +
            `xff=${h('x-forwarded-for')} ` +
            `x-real-ip=${h('x-real-ip')} ` +
            `req.ip=${JSON.stringify(req.ip)} ` +
            `req.ips=${JSON.stringify(req.ips)} ` +
            `socket=${JSON.stringify(req.socket?.remoteAddress)} ` +
            `otros=[${extra}]`,
        );
      }
      next();
    },
  );

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

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
