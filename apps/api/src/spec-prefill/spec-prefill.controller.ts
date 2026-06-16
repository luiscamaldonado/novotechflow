import {
    Body,
    Controller,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SpecPrefillService } from './spec-prefill.service';
import { ExtractSpecsDto } from './dto/extract-specs.dto';
import type { PrefillResponseDto } from './dto/prefill-response.dto';

/** Techo de tamaño para archivos subidos (10 MB); cada estrategia afina su propio límite. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('SpecPrefill')
@ApiBearerAuth()
@Controller('spec-prefill')
export class SpecPrefillController {
    constructor(private readonly specPrefill: SpecPrefillService) {}

    @Post('extract')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Extrae especificaciones de un equipo desde texto, part number o archivo (Excel/PDF).',
    })
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: MAX_UPLOAD_BYTES },
        }),
    )
    async extract(
        @Body() dto: ExtractSpecsDto,
        @UploadedFile() file?: Express.Multer.File,
    ): Promise<PrefillResponseDto> {
        return this.specPrefill.extraer(dto.tipoInput, { payload: dto.payload, file });
    }
}
