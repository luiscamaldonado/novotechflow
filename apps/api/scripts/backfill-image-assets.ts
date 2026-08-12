/**
 * Backfill de imagenes embebidas (data URIs) hacia image_assets.
 *
 * Fases:
 *   1. proposal_page_blocks: content.url -> content.assetId (sin url)
 *   2. pdf_templates: cada bloque del array content, igual que (1)
 *   3. users: signature_url -> signature_asset_id (signature_url = null)
 *
 * Deduplica por sha256 de los bytes decodificados, con los mismos criterios
 * que ImageAssetsService (constantes duplicadas adrede: el script no importa
 * codigo Nest para no acoplarse al DI).
 *
 * Idempotente: tras una corrida no quedan data URIs, y una segunda corrida
 * no cambia nada.
 *
 * PRECONDICION: correr en ventana sin escrituras (API detenida o trafico
 * congelado). Cada update es un compare-and-swap contra el valor leido, asi
 * que una escritura concurrente no se pisa (la fila se omite y se reporta
 * como concurrente), pero la corrida limpia es con la API quieta.
 *
 * Uso (desde apps/api):
 *   BACKFILL_DATABASE_URL=postgresql://usuario:clave@host:5432/base \
 *   BACKFILL_CONFIRM=yes \
 *   pnpm exec ts-node scripts/backfill-image-assets.ts
 *
 * Nunca lee el DATABASE_URL del .env: el destino se pasa explicito.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

/** Mismo criterio que ImageAssetsService.ingestDataUri (duplicado adrede). */
const DATA_URI_PATTERN = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/;

/** Filas por lote en el recorrido por cursor de proposal_page_blocks. */
const BATCH_SIZE = 100;

interface ParsedDataUri {
  mimeType: string;
  /** Payload base64 SIN el prefijo "data:<mime>;base64," (asi se almacena). */
  payload: string;
  sizeBytes: number;
  /** sha256 hex sobre los BYTES decodificados, no sobre el string base64. */
  sha256: string;
}

interface PhaseStats {
  examined: number;
  migrated: number;
  invalid: number;
  /** Filas omitidas porque otro proceso las modifico entre leer y escribir. */
  concurrent: number;
}

function emptyPhaseStats(): PhaseStats {
  return { examined: 0, migrated: 0, invalid: 0, concurrent: 0 };
}

const stats = {
  assetsCreated: 0,
  assetsReused: 0,
  blocks: emptyPhaseStats(),
  templates: emptyPhaseStats(),
  templateRowsUpdated: 0,
  users: emptyPhaseStats(),
};

/** Cache sha256 -> assetId para no repetir consultas por duplicados. */
const assetIdBySha256 = new Map<string, string>();

function parseDataUri(value: unknown): ParsedDataUri | null {
  if (typeof value !== 'string') return null;
  const match: RegExpExecArray | null = DATA_URI_PATTERN.exec(value);
  if (match === null) return null;
  const buffer: Buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) return null;
  return {
    mimeType: match[1],
    payload: match[2],
    sizeBytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function isContentObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Devuelve el assetId para la imagen, creando la fila si no existe.
 * findUnique + create en vez de upsert para poder reportar creados vs
 * reutilizados; la carrera con un ingest concurrente del API (P2002 sobre
 * sha256 unico) se resuelve releyendo en vez de abortar la corrida.
 */
async function ensureAsset(
  prisma: PrismaClient,
  parsed: ParsedDataUri,
): Promise<string> {
  const cached: string | undefined = assetIdBySha256.get(parsed.sha256);
  if (cached !== undefined) {
    stats.assetsReused += 1;
    return cached;
  }

  const existing = await prisma.imageAsset.findUnique({
    where: { sha256: parsed.sha256 },
    select: { id: true },
  });
  if (existing) {
    assetIdBySha256.set(parsed.sha256, existing.id);
    stats.assetsReused += 1;
    return existing.id;
  }

  try {
    const created = await prisma.imageAsset.create({
      data: {
        sha256: parsed.sha256,
        mimeType: parsed.mimeType,
        sizeBytes: parsed.sizeBytes,
        data: parsed.payload,
      },
      select: { id: true },
    });
    assetIdBySha256.set(parsed.sha256, created.id);
    stats.assetsCreated += 1;
    return created.id;
  } catch (error: unknown) {
    // P2002: otro proceso creo el mismo sha256 entre findUnique y create.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const raced = await prisma.imageAsset.findUnique({
        where: { sha256: parsed.sha256 },
        select: { id: true },
      });
      if (raced) {
        assetIdBySha256.set(parsed.sha256, raced.id);
        stats.assetsReused += 1;
        return raced.id;
      }
    }
    throw error;
  }
}

/** Fase 1: proposal_page_blocks, por cursor en lotes de BATCH_SIZE. */
async function backfillBlocks(prisma: PrismaClient): Promise<void> {
  console.log('Fase 1: proposal_page_blocks');
  let cursor: string | null = null;

  for (;;) {
    const batch: { id: string; content: unknown }[] =
      await prisma.proposalPageBlock.findMany({
        take: BATCH_SIZE,
        ...(cursor === null ? {} : { skip: 1, cursor: { id: cursor } }),
        orderBy: { id: 'asc' },
        select: { id: true, content: true },
      });
    if (batch.length === 0) break;

    for (const block of batch) {
      stats.blocks.examined += 1;
      if (!isContentObject(block.content)) continue;
      const url: unknown = block.content.url;
      if (typeof url !== 'string' || !url.startsWith('data:')) continue;

      const parsed: ParsedDataUri | null = parseDataUri(url);
      if (parsed === null) {
        stats.blocks.invalid += 1;
        console.warn(
          `  AVISO bloque ${block.id}: data URI malformado, se deja intacto`,
        );
        continue;
      }

      const assetId: string = await ensureAsset(prisma, parsed);
      const content: Record<string, unknown> = { ...block.content, assetId };
      delete content.url;
      // Compare-and-swap: solo escribe si el content sigue siendo el leido;
      // una edicion concurrente deja la fila intacta y se reporta.
      const updated = await prisma.proposalPageBlock.updateMany({
        where: {
          id: block.id,
          content: { equals: block.content as Prisma.InputJsonValue },
        },
        data: { content: content as Prisma.InputJsonValue },
      });
      if (updated.count === 0) {
        stats.blocks.concurrent += 1;
        console.warn(
          `  AVISO bloque ${block.id}: modificado concurrentemente, omitido`,
        );
        continue;
      }
      stats.blocks.migrated += 1;
    }

    console.log(
      `  examinados=${stats.blocks.examined} migrados=${stats.blocks.migrated}`,
    );
    cursor = batch[batch.length - 1].id;
    if (batch.length < BATCH_SIZE) break;
  }
}

/** Fase 2: pdf_templates, bloque por bloque dentro del array content. */
async function backfillTemplates(prisma: PrismaClient): Promise<void> {
  console.log('Fase 2: pdf_templates');
  // Solo ids al inicio; el content se relee fila por fila justo antes de
  // transformarlo, para achicar la ventana entre lectura y escritura.
  const templateIds = await prisma.pdfTemplate.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  for (const { id } of templateIds) {
    const template = await prisma.pdfTemplate.findUnique({
      where: { id },
      select: { id: true, content: true },
    });
    if (!template || !Array.isArray(template.content)) continue;
    const blocks: unknown[] = [...template.content];
    let changed = false;

    // Recorrido por posicion real del array, nunca por indice fijo.
    for (let i = 0; i < blocks.length; i++) {
      const block: unknown = blocks[i];
      if (!isContentObject(block)) continue;
      const blockContent: unknown = block.content;
      if (!isContentObject(blockContent)) continue;
      stats.templates.examined += 1;
      const url: unknown = blockContent.url;
      if (typeof url !== 'string' || !url.startsWith('data:')) continue;

      const parsed: ParsedDataUri | null = parseDataUri(url);
      if (parsed === null) {
        stats.templates.invalid += 1;
        console.warn(
          `  AVISO template ${template.id} bloque #${i}: data URI malformado`,
        );
        continue;
      }

      const assetId: string = await ensureAsset(prisma, parsed);
      const dehydrated: Record<string, unknown> = { ...blockContent, assetId };
      delete dehydrated.url;
      blocks[i] = { ...block, content: dehydrated };
      changed = true;
      stats.templates.migrated += 1;
    }

    if (changed) {
      // Compare-and-swap sobre el array completo leido.
      const updated = await prisma.pdfTemplate.updateMany({
        where: {
          id: template.id,
          content: { equals: template.content as Prisma.InputJsonValue },
        },
        data: { content: blocks as Prisma.InputJsonValue },
      });
      if (updated.count === 0) {
        stats.templates.concurrent += 1;
        console.warn(
          `  AVISO template ${template.id}: modificado concurrentemente, omitido`,
        );
        continue;
      }
      stats.templateRowsUpdated += 1;
    }
  }

  console.log(
    `  bloques examinados=${stats.templates.examined} ` +
      `migrados=${stats.templates.migrated} ` +
      `filas actualizadas=${stats.templateRowsUpdated}`,
  );
}

/** Fase 3: users.signature_url -> users.signature_asset_id. */
async function backfillSignatures(prisma: PrismaClient): Promise<void> {
  console.log('Fase 3: users (firmas)');
  const users = await prisma.user.findMany({
    where: { signatureUrl: { startsWith: 'data:' } },
    select: { id: true, signatureUrl: true },
  });

  for (const user of users) {
    stats.users.examined += 1;
    const parsed: ParsedDataUri | null = parseDataUri(user.signatureUrl);
    if (parsed === null) {
      stats.users.invalid += 1;
      console.warn(
        `  AVISO usuario ${user.id}: firma con data URI malformado, intacta`,
      );
      continue;
    }

    const assetId: string = await ensureAsset(prisma, parsed);
    // Compare-and-swap sobre la firma leida.
    const updated = await prisma.user.updateMany({
      where: { id: user.id, signatureUrl: user.signatureUrl },
      data: { signatureAssetId: assetId, signatureUrl: null },
    });
    if (updated.count === 0) {
      stats.users.concurrent += 1;
      console.warn(
        `  AVISO usuario ${user.id}: firma modificada concurrentemente, omitida`,
      );
      continue;
    }
    stats.users.migrated += 1;
  }

  console.log(
    `  examinados=${stats.users.examined} migrados=${stats.users.migrated}`,
  );
}

interface Verification {
  blocksRemaining: number;
  templatesRemaining: number;
  usersRemaining: number;
  totalAssets: number;
}

/** Conteo de data URIs restantes por tabla (esperado: 0 en todas). */
async function verify(prisma: PrismaClient): Promise<Verification> {
  const blocksRemaining: number = await prisma.proposalPageBlock.count({
    where: { content: { path: ['url'], string_starts_with: 'data:' } },
  });

  const templates = await prisma.pdfTemplate.findMany({
    select: { content: true },
  });
  let templatesRemaining = 0;
  for (const template of templates) {
    if (!Array.isArray(template.content)) continue;
    for (const block of template.content) {
      if (!isContentObject(block)) continue;
      const blockContent: unknown = block.content;
      if (!isContentObject(blockContent)) continue;
      const url: unknown = blockContent.url;
      if (typeof url === 'string' && url.startsWith('data:')) {
        templatesRemaining += 1;
      }
    }
  }

  const usersRemaining: number = await prisma.user.count({
    where: { signatureUrl: { startsWith: 'data:' } },
  });

  const totalAssets: number = await prisma.imageAsset.count();

  return { blocksRemaining, templatesRemaining, usersRemaining, totalAssets };
}

async function main(): Promise<void> {
  const databaseUrl: string | undefined = process.env.BACKFILL_DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'ERROR: BACKFILL_DATABASE_URL no esta definida. Este script NUNCA usa ' +
        'el DATABASE_URL del .env: pasa la URL de destino explicitamente.',
    );
    process.exit(1);
  }

  let target: URL;
  try {
    target = new URL(databaseUrl);
  } catch {
    console.error('ERROR: BACKFILL_DATABASE_URL no es una URL valida.');
    process.exit(1);
  }
  console.log(
    `Destino: ${target.hostname}:${target.port || '5432'}${target.pathname}`,
  );
  console.log(
    'PRECONDICION: correr sin escrituras concurrentes (API detenida); las ' +
      'filas modificadas durante la corrida se omiten y se reportan.',
  );

  if (process.env.BACKFILL_CONFIRM !== 'yes') {
    console.error(
      'ERROR: define BACKFILL_CONFIRM=yes para confirmar que el destino ' +
        'impreso arriba es el correcto.',
    );
    process.exit(1);
  }

  const startedAt: number = Date.now();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await backfillBlocks(prisma);
    await backfillTemplates(prisma);
    await backfillSignatures(prisma);

    const verification: Verification = await verify(prisma);
    const elapsedSeconds: string = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log('');
    console.log('=== REPORTE FINAL ===');
    console.log(
      `proposal_page_blocks: examinadas=${stats.blocks.examined} ` +
        `migradas=${stats.blocks.migrated} ` +
        `malformadas=${stats.blocks.invalid} ` +
        `concurrentes=${stats.blocks.concurrent}`,
    );
    console.log(
      `pdf_templates (bloques): examinadas=${stats.templates.examined} ` +
        `migradas=${stats.templates.migrated} ` +
        `malformadas=${stats.templates.invalid} ` +
        `concurrentes=${stats.templates.concurrent} ` +
        `(filas reescritas=${stats.templateRowsUpdated})`,
    );
    console.log(
      `users: examinadas=${stats.users.examined} ` +
        `migradas=${stats.users.migrated} ` +
        `malformadas=${stats.users.invalid} ` +
        `concurrentes=${stats.users.concurrent}`,
    );
    console.log(
      `assets creados=${stats.assetsCreated} ` +
        `reutilizaciones=${stats.assetsReused}`,
    );
    console.log('--- verificacion ---');
    console.log(
      `data URIs restantes: proposal_page_blocks=${verification.blocksRemaining} ` +
        `pdf_templates=${verification.templatesRemaining} ` +
        `users=${verification.usersRemaining}`,
    );
    console.log(`total filas en image_assets: ${verification.totalAssets}`);
    console.log(`duracion: ${elapsedSeconds}s`);

    const remaining: number =
      verification.blocksRemaining +
      verification.templatesRemaining +
      verification.usersRemaining;
    if (remaining > 0) {
      console.error(
        `ERROR: quedan ${remaining} data URIs sin migrar (ver detalle arriba).`,
      );
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
