import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';

/** Bases de los sitios de Lenovo consultados. */
const PSREF_BASE = 'https://psref.lenovo.com';
const SMARTFIND_BASE = 'https://smartfind.lenovo.com';

/** User-Agent de navegador para evitar bloqueos del scraping. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

/** Vida útil del cache de menú/cookie/token de PSREF (12 horas). */
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

/** Pausa de cortesía tras poblar el cache, antes de la primera consulta de matriz. */
const HANDSHAKE_COURTESY_MS = 600;

/** Tamaño de página solicitado a la matriz de modelos. */
const MATRIX_PAGE_SIZE = 500;

/** Longitud mínima de una respuesta de SmartFind para considerarla útil. */
const MIN_SMARTFIND_LENGTH = 15;

const HANDSHAKE_TIMEOUT_MS = 8000;
const MENU_TIMEOUT_MS = 10000;
const MATRIX_TIMEOUT_MS = 10000;
const SMARTFIND_TIMEOUT_MS = 15000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Matriz de modelos devuelta por PSREF (subconjunto consumido). */
interface PsrefMatrix {
  cols: string[];
  rows: string[][];
}

/** Resultado de la obtención de datos crudos de un equipo Lenovo. */
export interface LenovoDatosCrudos {
  datos: string;
  fuente: 'PSREF' | 'SMARTFIND';
}

/**
 * Servicio de scraping de Lenovo PSREF con fallback a SmartFind.
 * Cachea el menú, la cookie y el token por 12 horas y usa una promesa
 * compartida para evitar refrescos concurrentes (anti-stampede).
 * Singleton de Nest: el cache se comparte entre peticiones.
 */
@Injectable()
export class LenovoPsrefService {
  private readonly logger = new Logger(LenovoPsrefService.name);

  private cachedMenu: unknown = null;
  private cachedCookie = '';
  private cachedToken = '';
  private cacheTimestamp = 0;
  private refreshCachePromise: Promise<void> | null = null;

  async obtenerDatos(partNumber: string): Promise<LenovoDatosCrudos> {
    const mt = partNumber.substring(0, 4);
    try {
      const refrescoFresco = await this.asegurarCache();
      const productKey = this.buscarProductKey(this.cachedMenu, mt);
      if (!productKey) {
        throw new NotFoundException(
          `MT '${mt}' no encontrado en el men\u00fa de PSREF.`,
        );
      }
      if (refrescoFresco) {
        await sleep(HANDSHAKE_COURTESY_MS);
      }
      const datos = await this.consultarMatriz(productKey, partNumber, mt);
      return { datos, fuente: 'PSREF' };
    } catch (psrefError) {
      this.logger.warn(
        `PSREF fall\u00f3 para '${partNumber}', intentando SmartFind: ${this.describeError(psrefError)}`,
      );
      return this.consultarSmartFindConFallo(partNumber);
    }
  }

  private async consultarSmartFindConFallo(
    partNumber: string,
  ): Promise<LenovoDatosCrudos> {
    try {
      const datos = await this.consultarSmartFind(partNumber);
      return { datos, fuente: 'SMARTFIND' };
    } catch (smartFindError) {
      this.logger.error(
        `SmartFind tambi\u00e9n fall\u00f3 para '${partNumber}': ${this.describeError(smartFindError)}`,
      );
      throw new BadRequestException(
        `El equipo '${partNumber}' no pudo ser localizado.`,
      );
    }
  }

  private async asegurarCache(): Promise<boolean> {
    const expirado =
      !this.cachedMenu || Date.now() - this.cacheTimestamp > CACHE_TTL_MS;
    if (!expirado) {
      return false;
    }
    let creadaPorMi = false;
    if (!this.refreshCachePromise) {
      creadaPorMi = true;
      this.refreshCachePromise = this.refrescarCache().finally(() => {
        this.refreshCachePromise = null;
      });
    }
    await this.refreshCachePromise;
    return creadaPorMi;
  }

  private async refrescarCache(): Promise<void> {
    const handshake = await axios.get(
      `${PSREF_BASE}/api/home/VersionTimestamp?t=${Date.now()}`,
      {
        headers: { 'User-Agent': USER_AGENT },
        timeout: HANDSHAKE_TIMEOUT_MS,
      },
    );
    const cookies: string[] = handshake.headers['set-cookie'] ?? [];
    this.cachedCookie = cookies
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
    const tokenMatch = this.cachedCookie.match(/X-PSREF-USER-TOKEN=([^;]+)/i);
    this.cachedToken = tokenMatch ? tokenMatch[1] : '';

    const menuResponse = await axios.get(
      `${PSREF_BASE}/api/home/menu/info?IsPreviewProduct=true&_=${Date.now()}`,
      {
        headers: { 'User-Agent': USER_AGENT, Cookie: this.cachedCookie },
        timeout: MENU_TIMEOUT_MS,
      },
    );
    this.cachedMenu = menuResponse.data;
    this.cacheTimestamp = Date.now();
  }

  private buscarProductKey(node: unknown, mt: string): string {
    if (!node || typeof node !== 'object') {
      return '';
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = this.buscarProductKey(item, mt);
        if (found) {
          return found;
        }
      }
      return '';
    }
    const record = node as Record<string, unknown>;
    const productKey = this.extraerProductKey(record, mt);
    if (productKey) {
      return productKey;
    }
    for (const key of Object.keys(record)) {
      const found = this.buscarProductKey(record[key], mt);
      if (found) {
        return found;
      }
    }
    return '';
  }

  private extraerProductKey(
    record: Record<string, unknown>,
    mt: string,
  ): string {
    const { id, info } = record;
    if (id === undefined || String(id).toUpperCase() !== mt) {
      return '';
    }
    if (!info || typeof info !== 'object') {
      return '';
    }
    const href = (info as Record<string, unknown>).href;
    if (typeof href !== 'string') {
      return '';
    }
    const segments = href.split('?')[0].split('/');
    return segments[segments.length - 1];
  }

  private async consultarMatriz(
    productKey: string,
    partNumber: string,
    mt: string,
  ): Promise<string> {
    const apiUrl =
      `${PSREF_BASE}/api/search/DefinitionFilterAndSearch/ShowModel?pageindex=1&pagesize=${MATRIX_PAGE_SIZE}` +
      `&product_key=${productKey}&t=${Date.now()}&filter=%5B%5D&search=${partNumber}&search_rule=1` +
      `&orderby=&In_positive_or_reverse_order=0&filter_option=&mt=${mt}&vertical=true`;

    const response = await axios.get<{ data?: PsrefMatrix }>(apiUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        Cookie: this.cachedCookie,
        'x-psref-user-token': this.cachedToken,
        'x-requested-with': 'XMLHttpRequest',
        Referer: `${PSREF_BASE}/Product/ThinkPad/${productKey}?MT=${mt}`,
      },
      timeout: MATRIX_TIMEOUT_MS,
    });

    const matrix = response.data.data;
    if (!matrix?.cols || !matrix?.rows) {
      throw new Error('Matriz de PSREF vac\u00eda.');
    }
    const targetRow = matrix.rows.find(
      (row) => row[0]?.toUpperCase() === partNumber,
    );
    if (!targetRow) {
      throw new NotFoundException(
        `Modelo '${partNumber}' no hallado en PSREF.`,
      );
    }

    const hardware: Record<string, string> = {};
    matrix.cols.forEach((colName, index) => {
      const value = targetRow[index];
      if (typeof value === 'string' && value.trim() !== '') {
        hardware[colName] = value.trim();
      }
    });
    return JSON.stringify(hardware, null, 2);
  }

  private async consultarSmartFind(partNumber: string): Promise<string> {
    const url =
      `${SMARTFIND_BASE}/accessory/api/v2/unauthorized/checkMachineType` +
      `?mt=${partNumber}&countryAndRegion=US&language=en-us`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
        Referer: `${SMARTFIND_BASE}/`,
      },
      timeout: SMARTFIND_TIMEOUT_MS,
    });

    const datos = JSON.stringify(response.data);
    if (
      !datos ||
      datos.length < MIN_SMARTFIND_LENGTH ||
      datos.includes('"data":[]')
    ) {
      throw new Error('SmartFind sin datos \u00fatiles.');
    }
    return datos;
  }

  private describeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      return data ? JSON.stringify(data) : error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
