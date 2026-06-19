import { Injectable, BadRequestException } from '@nestjs/common';
import { TextoPlanoStrategy } from './strategies/texto-plano.strategy';
import { PartNumberStrategy } from './strategies/part-number.strategy';
import { ExcelStrategy } from './strategies/excel.strategy';
import { PdfStrategy } from './strategies/pdf.strategy';
import { HpPartNumberStrategy } from './strategies/hp-part-number.strategy';
import { PrefillStrategyType } from './interfaces/prefill-strategy.interface';
import type {
  PrefillStrategy,
  PrefillInput,
} from './interfaces/prefill-strategy.interface';
import type { PrefillResponseDto } from './dto/prefill-response.dto';

/**
 * Orquestador del prellenado de especificaciones.
 * Resuelve la estrategia según el tipo de entrada y delega la extracción.
 */
@Injectable()
export class SpecPrefillService {
  private readonly strategies: Map<PrefillStrategyType, PrefillStrategy>;

  constructor(
    textoPlano: TextoPlanoStrategy,
    partNumber: PartNumberStrategy,
    excel: ExcelStrategy,
    pdf: PdfStrategy,
    hpPartNumber: HpPartNumberStrategy,
  ) {
    this.strategies = new Map<PrefillStrategyType, PrefillStrategy>([
      [PrefillStrategyType.TEXTO_PLANO, textoPlano],
      [PrefillStrategyType.PART_NUMBER, partNumber],
      [PrefillStrategyType.EXCEL, excel],
      [PrefillStrategyType.PDF, pdf],
      [PrefillStrategyType.HP_PART_NUMBER, hpPartNumber],
    ]);
  }

  async extraer(
    tipo: PrefillStrategyType,
    input: PrefillInput,
  ): Promise<PrefillResponseDto> {
    const strategy = this.strategies.get(tipo);
    if (!strategy) {
      throw new BadRequestException(
        `Tipo de extracci\u00f3n no soportado: ${tipo}`,
      );
    }
    return strategy.ejecutar(input);
  }
}
