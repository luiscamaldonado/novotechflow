import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import axios from 'axios';

/** Endpoint REST de Gemini (modelo gemini-3.1-flash-lite, API v1beta). */
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

/** Temperatura por defecto para una extracción determinista de especificaciones. */
const DEFAULT_TEMPERATURE = 0.1;

/** Tiempo máximo de espera por respuesta de Gemini (ms). */
const REQUEST_TIMEOUT_MS = 120000;

/** Número máximo de intentos ante saturación temporal de la API. */
const MAX_RETRIES = 3;

/** Espera inicial entre reintentos (ms); se duplica en cada intento. */
const INITIAL_RETRY_DELAY_MS = 1500;

/** Factor de crecimiento exponencial del backoff entre reintentos. */
const RETRY_BACKOFF_FACTOR = 2;

/** Códigos HTTP que justifican un reintento (saturación temporal). */
const HTTP_SERVICE_UNAVAILABLE = 503;
const HTTP_TOO_MANY_REQUESTS = 429;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Forma mínima de la respuesta de generateContent que este cliente consume. */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Cliente único para la API REST de Gemini.
 * Centraliza la llamada HTTP, el backoff ante saturación y el parseo de JSON,
 * para que las estrategias de prellenado no dupliquen esa lógica.
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly geminiApiKey: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.geminiApiKey = apiKey;
  }

  /**
   * Envía un prompt con un responseSchema y devuelve el JSON parseado.
   * El resultado se normaliza siempre a un arreglo (un objeto suelto se envuelve).
   */
  async generarJson(
    prompt: string,
    schema: unknown,
    temperature: number = DEFAULT_TEMPERATURE,
  ): Promise<unknown[]> {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    };

    const data = await this.postWithRetry(payload);
    return this.parseResponse(data);
  }

  private async postWithRetry(payload: unknown): Promise<GeminiResponse> {
    let delayMs = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post<GeminiResponse>(
          GEMINI_API_URL,
          payload,
          {
            headers: { 'x-goog-api-key': this.geminiApiKey },
            timeout: REQUEST_TIMEOUT_MS,
          },
        );
        return response.data;
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        const isRetryable =
          status === HTTP_SERVICE_UNAVAILABLE ||
          status === HTTP_TOO_MANY_REQUESTS;

        if (attempt === MAX_RETRIES || !isRetryable) {
          throw error;
        }

        this.logger.warn(
          `Gemini saturado (status ${status}). Reintento ${attempt}/${MAX_RETRIES} en ${delayMs}ms.`,
        );
        await sleep(delayMs);
        delayMs *= RETRY_BACKOFF_FACTOR;
      }
    }

    throw new BadGatewayException('No se obtuvo respuesta de Gemini.');
  }

  private parseResponse(data: GeminiResponse): unknown[] {
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== 'string') {
      throw new BadGatewayException(
        'Respuesta de Gemini sin contenido de texto.',
      );
    }

    const cleanText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      throw new BadGatewayException(
        'Error al parsear la respuesta JSON de Gemini.',
      );
    }

    return Array.isArray(parsed) ? parsed : [parsed];
  }
}
