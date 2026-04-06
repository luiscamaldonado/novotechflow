import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';


/** TTL del cache de TRM en milisegundos (5 minutos). */
const TRM_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class TrmService {
  private readonly logger = new Logger(TrmService.name);

  /** Cache en memoria para evitar scraping repetitivo de TRM. */
  private trmCache: { data: unknown; expiresAt: number } | null = null;

  /**
   * Obtiene valores extra de TRM (Promedio SET-ICAP y Spot Wilkinson).
   * Maneja cache interno de 5 minutos para evitar scraping repetitivo.
   */
  async getExtraTrmValues() {
    const now = Date.now();
    if (this.trmCache && now < this.trmCache.expiresAt) {
      return this.trmCache.data;
    }

    const data = await this.fetchTrmValues();
    this.trmCache = { data, expiresAt: now + TRM_CACHE_TTL_MS };
    return data;
  }

  /**
   * Realiza el fetch real de los valores TRM desde fuentes externas.
   */
  private async fetchTrmValues() {
    const today = new Date().toISOString().split('T')[0];
    const results: { setIcapAverage: number | null; wilkinsonSpot: number | null } = {
      setIcapAverage: null,
      wilkinsonSpot: null
    };

    // 1. SET-ICAP Average (POST API)
    try {
      const setIcapRes = await axios.post('https://proxy.set-icap.com/seticap/api/estadisticas/estadisticasPromedioCierre/', {
        fecha: today,
        mercado: 71,
        delay: 15
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://dolar.set-icap.com/'
        },
        timeout: 5000
      });
      if (setIcapRes.data?.data?.avg) {
        results.setIcapAverage = this.parseCurrencyString(setIcapRes.data.data.avg);
      }
    } catch (e) {
      this.logger.error(`Error fetching SET-ICAP average: ${(e as Error).message}`);
    }

    // 2. Wilkinson Spot Average (Scraping)
    try {
      const wilkinsonRes = await axios.get('https://dolar.wilkinsonpc.com.co/dolar-hoy-spot-minuto-a-minuto/', {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        },
        timeout: 5000
      });
      const $ = cheerio.load(wilkinsonRes.data);
      const spotText = $('.display-5.fw-bold.text-dark.lh-1.my-1 span').first().text();
      if (spotText) {
        results.wilkinsonSpot = this.parseCurrencyString(spotText);
      }
    } catch (e) {
      this.logger.error(`Error fetching Wilkinson spot: ${(e as Error).message}`);
    }

    return results;
  }

  /**
   * Normaliza y parsea cadenas de moneda (pudiendo tener . o , como separadores)
   */
  private parseCurrencyString(val: string): number {
    if (!val) return 0;
    // Remueve todo menos dígitos, puntos y comas
    let clean = val.replace(/[^0-9.,]/g, '');
    
    // Si tiene coma Y punto: la última suele ser el decimal
    const lastComma = clean.lastIndexOf(',');
    const lastPoint = clean.lastIndexOf('.');
    
    if (lastComma > lastPoint) {
      // Formato latino 3.704,17
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (lastPoint > lastComma) {
      // Formato USA 3,704.17
      clean = clean.replace(/,/g, '');
    } else {
      // Solo uno de los dos o ninguno
      if (lastComma !== -1) clean = clean.replace(',', '.');
    }
    
    return parseFloat(clean);
  }
}
