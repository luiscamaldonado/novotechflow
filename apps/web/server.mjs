/**
 * Production static server for the Vite-built SPA.
 *
 * Adds security headers (HSTS, X-Frame-Options, etc.) via Helmet,
 * gzip via compression, and a /healthz endpoint for Railway.
 *
 * Why not "vite preview"?  Railway's autodetect runs it without
 * Helmet, so Invicti flagged missing HSTS (CVSS 7.7).
 */

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 4173;

const app = express();

// ── Security headers ────────────────────────────────────────────
app.use(
  helmet({
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // TODO: habilitar CSP en paso posterior — puede romper assets inline de Vite
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── Compression ─────────────────────────────────────────────────
app.use(compression());

// ── Health check (Railway) ──────────────────────────────────────
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ── Static assets (long cache, no index fallback) ───────────────
app.use(
  express.static(DIST_DIR, {
    maxAge: '1y',
    index: false,
  }),
);

// ── SPA fallback ────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Web server listening on :${PORT}`);
});
