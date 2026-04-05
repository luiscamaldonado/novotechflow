import { IsString, IsOptional, IsArray, IsObject, IsBoolean, IsNumber } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  templateType: string;

  @IsOptional() @IsNumber()
  sortOrder?: number;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsNumber()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ReorderTemplatesDto {
  @IsArray()
  templateIds: string[];
}

export class CreateTemplateBlockDto {
  @IsString()
  blockType: string;

  @IsOptional() @IsObject()
  content?: object;
}

export class UpdateTemplateBlockDto {
  @IsObject()
  content: object;
}
