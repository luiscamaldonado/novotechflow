import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsEnum, IsDateString, Min, MaxLength, IsObject, IsIn } from 'class-validator';
import { ItemType, ProposalStatus } from '@prisma/client';

/**
 * DTO para la creación de una nueva propuesta.
 */
export class CreateProposalDto {
    @IsOptional()
    @IsString()
    clientId?: string;

    @IsString()
    @MaxLength(200)
    clientName: string;

    @IsString()
    subject: string;

    @IsDateString()
    issueDate: string;

    @IsInt()
    validityDays: number;

    @IsDateString()
    validityDate: string;
}

/**
 * DTO para actualización parcial de una propuesta.
 */
export class UpdateProposalDto {
    @IsOptional()
    @IsString()
    subject?: string;

    @IsOptional()
    @IsDateString()
    issueDate?: string;

    @IsOptional()
    @IsInt()
    validityDays?: number;

    @IsOptional()
    @IsDateString()
    validityDate?: string;

    @IsOptional()
    @IsEnum(ProposalStatus)
    status?: ProposalStatus;

    @IsOptional()
    @IsDateString()
    closeDate?: string;

    @IsOptional()
    @IsDateString()
    billingDate?: string;
}

/**
 * DTO para agregar / actualizar un ítem de propuesta.
 */
export class CreateProposalItemDto {
    @IsEnum(ItemType)
    itemType: ItemType;

    @IsString()
    @MaxLength(300)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    brand?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    partNumber?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    unitCost?: number;

    @IsOptional()
    @IsNumber()
    marginPct?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    unitPrice?: number;

    @IsOptional()
    @IsBoolean()
    isTaxable?: boolean;

    @IsOptional()
    @IsObject()
    technicalSpecs?: Record<string, string>;

    @IsOptional()
    @IsObject()
    internalCosts?: Record<string, unknown>;
}

/**
 * DTO para actualización parcial de un ítem.
 */
export class UpdateProposalItemDto {
    @IsOptional()
    @IsEnum(ItemType)
    itemType?: ItemType;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsString()
    partNumber?: string;

    @IsOptional()
    @IsNumber()
    quantity?: number;

    @IsOptional()
    @IsNumber()
    unitCost?: number;

    @IsOptional()
    @IsNumber()
    marginPct?: number;

    @IsOptional()
    @IsNumber()
    unitPrice?: number;

    @IsOptional()
    @IsBoolean()
    isTaxable?: boolean;

    @IsOptional()
    @IsObject()
    technicalSpecs?: Record<string, string>;

    @IsOptional()
    @IsObject()
    internalCosts?: Record<string, unknown>;
}

/**
 * DTO para crear un nuevo escenario.
 */
export class CreateScenarioDto {
    @IsString()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

/**
 * DTO para actualizar un escenario.
 */
export class UpdateScenarioDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

/**
 * DTO para agregar un ítem a un escenario.
 */
export class AddScenarioItemDto {
    @IsString()
    itemId: string;

    @IsOptional()
    @IsString()
    parentId?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    marginPct?: number;
}

/**
 * DTO para actualizar un ítem de escenario.
 */
export class UpdateScenarioItemDto {
    @IsOptional()
    @IsNumber()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsNumber()
    marginPct?: number;
}

/**
 * DTO para aplicar margen global a un escenario.
 */
export class ApplyMarginDto {
    @IsNumber()
    marginPct: number;
}

/**
 * DTO para clonar una propuesta.
 */
export class CloneProposalDto {
    @IsIn(['NEW_VERSION', 'NEW_PROPOSAL'])
    cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL';
}
