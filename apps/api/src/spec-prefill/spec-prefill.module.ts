import { Module } from '@nestjs/common';
import { SpecPrefillController } from './spec-prefill.controller';
import { SpecPrefillService } from './spec-prefill.service';
import { GeminiClient } from './gemini.client';
import { LenovoPsrefService } from './services/lenovo-psref.service';
import { TextoPlanoStrategy } from './strategies/texto-plano.strategy';
import { PartNumberStrategy } from './strategies/part-number.strategy';
import { ExcelStrategy } from './strategies/excel.strategy';
import { PdfStrategy } from './strategies/pdf.strategy';
import { HpPartNumberStrategy } from './strategies/hp-part-number.strategy';

/**
 * Módulo de prellenado de especificaciones técnicas.
 * Expone el endpoint de extracción y registra las estrategias y el cliente Gemini.
 */
@Module({
    imports: [],
    controllers: [SpecPrefillController],
    providers: [
        SpecPrefillService,
        GeminiClient,
        LenovoPsrefService,
        TextoPlanoStrategy,
        PartNumberStrategy,
        ExcelStrategy,
        PdfStrategy,
        HpPartNumberStrategy,
    ],
})
export class SpecPrefillModule {}
