import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** data:<mime>;base64,<payload> — el payload se captura sin el prefijo. */
const DATA_URI_PATTERN = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/;

/** Forma de UUID v4 tal como los genera Prisma para ImageAsset.id. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Proyeccion minima necesaria para reconstruir un data URI. */
interface AssetPayload {
  id: string;
  mimeType: string;
  data: string;
}

@Injectable()
export class ImageAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persiste un data URI base64 y devuelve el id del asset.
   * Deduplica por sha256 de los BYTES decodificados: dos data URIs con la
   * misma imagen comparten fila. Devuelve null si el data URI no es valido.
   */
  async ingestDataUri(dataUri: string): Promise<string | null> {
    const match: RegExpExecArray | null = DATA_URI_PATTERN.exec(dataUri);
    if (match === null) return null;

    const mimeType: string = match[1];
    const payload: string = match[2];
    const buffer: Buffer = Buffer.from(payload, 'base64');
    if (buffer.length === 0) return null;

    const sha256: string = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex');

    const asset = await this.prisma.imageAsset.upsert({
      where: { sha256 },
      create: {
        sha256,
        mimeType,
        sizeBytes: buffer.length,
        data: payload,
      },
      update: {},
      select: { id: true },
    });

    return asset.id;
  }

  /**
   * Saca el data URI de un content de bloque y lo reemplaza por assetId.
   * Devuelve el content intacto si url no es un data URI valido (rutas como
   * /defaults/portada.png, bloques sin url, o base64 malformado).
   */
  async dehydrateImageContent(
    content: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url: unknown = content.url;
    if (typeof url !== 'string' || !url.startsWith('data:')) return content;

    const assetId: string | null = await this.ingestDataUri(url);
    if (assetId === null) return content;

    const dehydrated: Record<string, unknown> = { ...content, assetId };
    delete dehydrated.url;
    return dehydrated;
  }

  /**
   * Reconstruye content.url desde content.assetId, conservando assetId.
   * Devuelve el content intacto si no hay assetId o si el asset no existe.
   */
  async rehydrateImageContent(
    content: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const assetId: string | null = this.readAssetId(content);
    if (assetId === null) return content;

    const asset = await this.prisma.imageAsset.findUnique({
      where: { id: assetId },
      select: { id: true, mimeType: true, data: true },
    });
    if (!asset) return content;

    return { ...content, url: this.toDataUri(asset) };
  }

  /**
   * Version en lote de rehydrateImageContent: resuelve todos los assetId
   * con un unico findMany en vez de una consulta por content.
   */
  async rehydrateMany(
    contents: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const ids = new Set<string>();
    for (const content of contents) {
      const assetId: string | null = this.readAssetId(content);
      if (assetId !== null) ids.add(assetId);
    }
    if (ids.size === 0) return contents;

    const assets: AssetPayload[] = await this.prisma.imageAsset.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, mimeType: true, data: true },
    });
    const byId = new Map<string, AssetPayload>(
      assets.map((asset) => [asset.id, asset]),
    );

    return contents.map((content) => {
      const assetId: string | null = this.readAssetId(content);
      if (assetId === null) return content;

      const asset: AssetPayload | undefined = byId.get(assetId);
      if (asset === undefined) return content;

      return { ...content, url: this.toDataUri(asset) };
    });
  }

  /**
   * Narrowing de content.assetId: devuelve el id solo si es un string con
   * forma de UUID. Un assetId arbitrario haria fallar a Prisma (P2023), asi
   * que se descarta antes de consultar.
   */
  private readAssetId(content: Record<string, unknown>): string | null {
    const assetId: unknown = content.assetId;
    if (typeof assetId !== 'string') return null;
    if (!UUID_PATTERN.test(assetId)) return null;
    return assetId;
  }

  /** Reensambla el data URI a partir del mime y el payload almacenados. */
  private toDataUri(asset: AssetPayload): string {
    return `data:${asset.mimeType};base64,${asset.data}`;
  }
}
