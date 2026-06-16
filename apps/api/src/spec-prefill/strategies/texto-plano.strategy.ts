import { Injectable, BadRequestException } from '@nestjs/common';
import { GeminiClient } from '../gemini.client';
import { NORMALIZATION_RULES } from '../constants/normalization-rules.constant';
import { SPEC_SCHEMA_ARRAY } from '../constants/spec-schema.constant';
import type { PrefillStrategy, PrefillInput } from '../interfaces/prefill-strategy.interface';
import type {
    PrefillResponseDto,
    ProductoPrefillDto,
    CampoPrefillDto,
    PrefillSource,
} from '../dto/prefill-response.dto';

/** Origen que se estampa en cada campo extraído por esta estrategia. */
const SOURCE: PrefillSource = 'TEXTO_PLANO';

/** Longitud mínima del texto de entrada para intentar una extracción. */
const MIN_TEXT_LENGTH = 15;

const PROMPT_HEADER = `Extrae las especificaciones de este texto. REGLAS CR\u00cdTICAS:
- Purgar basura t\u00e9cnica (hilos, latencias, P/E cores, protocolos Wi-Fi).
- Procesador: Solo familia, modelo y n\u00facleos.
- Deduce el fabricante (Lenovo, HP, Dell, etc.) y el formato de cada equipo.

REGLA DE L\u00cdNEAS INDEPENDIENTES (TEXTO CONTINUO):
Si el texto de entrada contiene m\u00faltiples l\u00edneas y cada l\u00ednea describe un equipo independiente con sus propias especificaciones completas separadas por puntos y comas (Ej: 'Tipo de producto: Computadora port\u00e1til; Familia de procesador...'), DEBES generar un objeto JSON individual para cada l\u00ednea. NO los agrupes en un solo equipo.

REFINAMIENTO DE PART NUMBER (DELL CODES):
Para textos continuos de Dell, busca c\u00f3digos alfanum\u00e9ricos al inicio de la l\u00ednea o junto al nombre de la marca (ej. '6750370', 'PP70R', '9KP97') para usarlos como 'partNumber'. Si un c\u00f3digo o n\u00famero de producto viene acompa\u00f1ado de un numeral y caracteres posteriores (ej. 'BH8M9LT#ABM'), ignora el numeral y todo lo que le siga, dejando solo el c\u00f3digo base ('BH8M9LT').

ASEGURAR EXTRACTOS LIMPIOS:
Aseg\u00farate de mapear las llaves obligatorias limpiando la basura t\u00e9cnica del p\u00e1rrafo continuo:
- 'modelo': Extrae el nombre comercial completo (ej. 'Dell Pro 15 Essential').`;

const PROMPT_FOOTER = `- 'almacenamiento': Identifica la capacidad y tipo (ej. '512 GB SSD NVMe').
- 'pantalla': Extrae tama\u00f1o y resoluci\u00f3n (ej. '15.6" FHD 1920x1080'). Busca t\u00e9rminos como "Pantalla", "Diagonal", "Display".
- 'network': Extrae detalles de conectividad (ej. 'Wi-Fi 6E, Bluetooth'). Busca t\u00e9rminos como "Conectividad", "Conexi\u00f3n", "Wi-Fi", "Red".

REGLA DELL (CTO/Cotizaciones): Si se lista un Sistema Base seguido de m\u00faltiples filas de componentes con SKUs individuales, NO extraigas cada componente como un \u00edtem separado. AGRUPA todos los componentes que le sigan al Sistema Base en UN SOLO objeto JSON y usa el nombre del Sistema Base como 'modelo'.`;

const readString = (raw: Record<string, unknown>, key: string): string => {
    const value = raw[key];
    return typeof value === 'string' ? value.trim() : '';
};

const cleanModelo = (modelo: string): string =>
    modelo.replace(/^(Dell|HP|Lenovo)\s+/i, '').trim();

const toCampo = (value: string): CampoPrefillDto => ({ value, source: SOURCE });

const mapProducto = (raw: Record<string, unknown>): ProductoPrefillDto => ({
    fabricante: toCampo(readString(raw, 'fabricante')),
    numeroParte: toCampo(readString(raw, 'partNumber')),
    formato: toCampo(readString(raw, 'formato')),
    modelo: toCampo(cleanModelo(readString(raw, 'modelo'))),
    procesador: toCampo(readString(raw, 'procesador')),
    sistemaOperativo: toCampo(readString(raw, 'sistemaOperativo')),
    graficos: toCampo(readString(raw, 'graficos')),
    memoriaRam: toCampo(readString(raw, 'memoriaRam')),
    almacenamiento: toCampo(readString(raw, 'almacenamiento')),
    pantalla: toCampo(readString(raw, 'pantalla')),
    network: toCampo(readString(raw, 'network')),
    seguridad: toCampo(readString(raw, 'seguridad')),
    garantiaEquipo: toCampo(readString(raw, 'garantiaEquipo')),
    garantiaBateria: toCampo(readString(raw, 'garantiaBateria')),
});

/**
 * Estrategia de prellenado a partir de texto plano (párrafos o listados).
 * Envía el texto a Gemini con las reglas de normalización y devuelve los
 * equipos detectados.
 */
@Injectable()
export class TextoPlanoStrategy implements PrefillStrategy {
    constructor(private readonly gemini: GeminiClient) {}

    async ejecutar(data: PrefillInput): Promise<PrefillResponseDto> {
        const texto = data.payload?.trim();
        if (!texto || texto.length < MIN_TEXT_LENGTH) {
            throw new BadRequestException(
                'El texto proporcionado es muy corto para extraer especificaciones.',
            );
        }

        const prompt = `${PROMPT_HEADER}\n${NORMALIZATION_RULES}\n${PROMPT_FOOTER}\n\nTexto:\n"${texto}"`;
        const rawProducts = await this.gemini.generarJson(prompt, SPEC_SCHEMA_ARRAY);

        const productos = rawProducts
            .filter(
                (item): item is Record<string, unknown> =>
                    typeof item === 'object' && item !== null,
            )
            .map(mapProducto);

        if (productos.length === 0) {
            throw new BadRequestException('No se detectaron equipos en el texto proporcionado.');
        }

        return { productos };
    }
}
