# Walkthrough: Multi-Currency Items + TRM Conversion per Scenario

## Summary
Implemented per-item cost currency (`COP`/`USD`) and per-scenario `conversionTrm` so the pricing engine auto-converts item costs to the scenario's currency before calculating landed costs, dilution, margins, and totals.

---

## PARTE 1 — Backend Changes

### [schema.prisma](file:///d:/novotechflow/apps/api/prisma/schema.prisma)

```diff:schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  COMMERCIAL
}

enum ProposalStatus {
  ELABORACION
  PROPUESTA
  GANADA
  PERDIDA
  PENDIENTE_FACTURAR
  FACTURADA
}

enum ItemType {
  PCS
  ACCESSORIES
  PC_SERVICES
  SOFTWARE
  INFRASTRUCTURE
  INFRA_SERVICES
}

enum PageType {
  COVER
  PRESENTATION
  COMPANY_INFO
  INDEX
  TERMS
  CUSTOM
}

enum BlockType {
  RICH_TEXT
  IMAGE
}

enum SyncStatus {
  SYNCED
  PENDING
  ERROR
}

enum AcquisitionType {
  VENTA
  DAAS
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(100)
  email        String   @unique @db.VarChar(150)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         Role
  nomenclature String   @unique @db.VarChar(10)
  signatureUrl String?  @map("signature_url") @db.VarChar(500)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  proposals          Proposal[]
  pdfTemplates       PdfTemplate[]
  syncedFiles        SyncedFile[]
  EmailLog           EmailLog[]
  billingProjections BillingProjection[]

  @@map("users")
}

model Proposal {
  id             String         @id @default(uuid()) @db.Uuid
  proposalCode   String?        @unique @map("proposal_code") @db.VarChar(20)
  userId         String         @map("user_id") @db.Uuid
  clientId       String?        @map("client_id") @db.Uuid
  clientName     String         @map("client_name") @db.VarChar(200)
  subject        String         @db.Text
  issueDate      DateTime       @map("issue_date") @db.Date
  validityDays   Int?           @map("validity_days")
  validityDate   DateTime?      @map("validity_date") @db.Date
  status         ProposalStatus @default(ELABORACION)
  currentVersion Int            @default(1) @map("current_version")
  isLocked       Boolean        @default(false) @map("is_locked")
  closeDate      DateTime?      @map("close_date") @db.Date
  billingDate    DateTime?      @map("billing_date") @db.Date
  acquisitionType AcquisitionType? @map("acquisition_type")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  user             User              @relation(fields: [userId], references: [id])
  client           Client?           @relation(fields: [clientId], references: [id])
  proposalVersions ProposalVersion[]
  proposalItems    ProposalItem[]
  pages            ProposalPage[]
  scenarios        Scenario[]
  syncedFiles      SyncedFile[]
  emailLogs        EmailLog[]

  @@index([userId])
  @@index([status])
  @@index([clientId])
  @@index([createdAt])
  @@map("proposals")
}

model ProposalVersion {
  id            String   @id @default(uuid()) @db.Uuid
  proposalId    String   @map("proposal_id") @db.Uuid
  versionNumber Int      @map("version_number")
  snapshotData  Json     @map("snapshot_data") @db.JsonB
  pdfUrl        String?  @map("pdf_url") @db.VarChar(500)
  isLocked      Boolean  @default(true) @map("is_locked")
  createdAt     DateTime @default(now()) @map("created_at")

  proposal  Proposal   @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  emailLogs EmailLog[]

  @@index([proposalId])
  @@map("proposal_versions")
}

model ProposalPage {
  id         String   @id @default(uuid()) @db.Uuid
  proposalId String   @map("proposal_id") @db.Uuid
  pageType   PageType @map("page_type")
  title      String?  @db.VarChar(200)
  variables  Json?    @db.JsonB
  isLocked   Boolean  @default(false) @map("is_locked")
  sortOrder  Int      @default(0) @map("sort_order")
  createdAt  DateTime @default(now()) @map("created_at")

  proposal      Proposal           @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  blocks        ProposalPageBlock[]
  proposalItems ProposalItem[]

  @@index([proposalId])
  @@map("proposal_pages")
}

model ProposalPageBlock {
  id        String    @id @default(uuid()) @db.Uuid
  pageId    String    @map("page_id") @db.Uuid
  blockType BlockType @map("block_type")
  content   Json?     @db.JsonB
  sortOrder Int       @default(0) @map("sort_order")
  createdAt DateTime  @default(now()) @map("created_at")

  page ProposalPage @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId])
  @@map("proposal_page_blocks")
}

model ProposalItem {
  id          String   @id @default(uuid()) @db.Uuid
  proposalId  String   @map("proposal_id") @db.Uuid
  pageId      String?  @map("page_id") @db.Uuid
  itemType    ItemType @map("item_type")
  name        String   @db.VarChar(300)
  description String?  @db.Text
  brand       String?  @db.VarChar(50)
  partNumber  String?  @map("part_number") @db.VarChar(50)
  quantity    Int      @default(1)

  // Future-proofing detailed cost tracking
  unitCost      Decimal  @map("unit_cost") @db.Decimal(15, 2)
  internalCosts Json?    @map("internal_costs") @db.JsonB // Additional flexible cost fields
  marginPct     Decimal? @map("margin_pct") @db.Decimal(5, 2)
  unitPrice     Decimal? @map("unit_price") @db.Decimal(15, 2)

  isTaxable      Boolean  @default(true) @map("is_taxable")
  sortOrder      Int      @default(0) @map("sort_order")
  technicalSpecs Json?    @map("technical_specs")
  createdAt      DateTime @default(now()) @map("created_at")

  proposal      Proposal         @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  page          ProposalPage?    @relation(fields: [pageId], references: [id])
  scenarioItems ScenarioItem[]

  @@index([proposalId])
  @@map("proposal_items")
}

model Scenario {
  id          String  @id @default(uuid()) @db.Uuid
  proposalId  String  @map("proposal_id") @db.Uuid
  name        String  @db.VarChar(100)
  currency    String  @default("COP") @db.VarChar(5)
  description String? @db.Text
  sortOrder   Int     @default(0) @map("sort_order")

  proposal      Proposal       @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  scenarioItems ScenarioItem[]

  @@index([proposalId])
  @@map("scenarios")
}

model ScenarioItem {
  id                String   @id @default(uuid()) @db.Uuid
  scenarioId        String   @map("scenario_id") @db.Uuid
  itemId            String   @map("item_id") @db.Uuid
  parentId          String?  @map("parent_id") @db.Uuid
  quantity          Int      @default(1)
  unitCostOverride  Decimal? @map("unit_cost_override") @db.Decimal(15, 2)
  marginPctOverride Decimal? @map("margin_pct_override") @db.Decimal(5, 2)
  unitPriceOverride Decimal? @map("unit_price_override") @db.Decimal(15, 2)
  isDilpidate       Boolean  @default(false) @map("is_dilpidate")

  scenario Scenario      @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  item     ProposalItem  @relation(fields: [itemId], references: [id])
  parent   ScenarioItem? @relation("ScenarioItemChildren", fields: [parentId], references: [id])
  children ScenarioItem[] @relation("ScenarioItemChildren")

  @@index([scenarioId])
  @@index([itemId])
  @@index([parentId])
  @@map("scenario_items")
}

model PdfTemplate {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(100)
  templateType PageType @map("template_type")
  content      Json     @db.JsonB
  sortOrder    Int      @default(0) @map("sort_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdBy    String   @map("created_by") @db.Uuid

  author User @relation(fields: [createdBy], references: [id])

  @@map("pdf_templates")
}

model SyncedFile {
  id         String     @id @default(uuid()) @db.Uuid
  userId     String     @map("user_id") @db.Uuid
  proposalId String?    @map("proposal_id") @db.Uuid
  fileName   String     @map("file_name") @db.VarChar(255)
  filePath   String     @map("file_path") @db.VarChar(500)
  localPath  String?    @map("local_path") @db.VarChar(500)
  fileSize   BigInt?    @map("file_size")
  checksum   String?    @db.VarChar(64)
  syncStatus SyncStatus @default(SYNCED) @map("sync_status")
  syncedAt   DateTime   @default(now()) @map("synced_at")

  user     User      @relation(fields: [userId], references: [id])
  proposal Proposal? @relation(fields: [proposalId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([proposalId])
  @@map("synced_files")
}

model EmailLog {
  id                String  @id @default(uuid()) @db.Uuid
  userId            String  @map("user_id") @db.Uuid
  proposalId        String  @map("proposal_id") @db.Uuid
  proposalVersionId String? @map("proposal_version_id") @db.Uuid
  outlookMessageId  String? @map("outlook_message_id") @db.VarChar(255) // Graph API ID

  toEmail String   @map("to_email") @db.VarChar(255)
  ccEmail String?  @map("cc_email") @db.VarChar(500)
  subject String   @db.VarChar(500)
  body    String   @db.Text
  sentAt  DateTime @default(now()) @map("sent_at")

  hasAttachment Boolean @default(false) @map("has_attachment")

  user            User             @relation(fields: [userId], references: [id])
  proposal        Proposal         @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  proposalVersion ProposalVersion? @relation(fields: [proposalVersionId], references: [id])

  @@index([userId])
  @@index([proposalId])
  @@map("email_logs")
}

model Client {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique @db.VarChar(200)
  nit       String?  @db.VarChar(20)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  proposals Proposal[]
  @@map("clients")
}

model Catalog {
  id        String   @id @default(uuid()) @db.Uuid
  category  String   @db.VarChar(50) // e.g., "FABRICANTE", "PROCESADOR"
  value     String   @db.VarChar(200)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([category, value])
  @@map("catalogs")
}

model BillingProjection {
  id             String         @id @default(uuid()) @db.Uuid
  userId         String         @map("user_id") @db.Uuid
  projectionCode String         @unique @map("projection_code") @db.VarChar(20)
  clientName     String         @map("client_name") @db.VarChar(200)
  subtotal       Decimal        @db.Decimal(15, 2)
  currency       String         @default("COP") @db.VarChar(5)
  status         ProposalStatus @default(PENDIENTE_FACTURAR)
  billingDate    DateTime?      @map("billing_date") @db.Date
  acquisitionType AcquisitionType? @map("acquisition_type")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("billing_projections")
}
===
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  COMMERCIAL
}

enum ProposalStatus {
  ELABORACION
  PROPUESTA
  GANADA
  PERDIDA
  PENDIENTE_FACTURAR
  FACTURADA
}

enum ItemType {
  PCS
  ACCESSORIES
  PC_SERVICES
  SOFTWARE
  INFRASTRUCTURE
  INFRA_SERVICES
}

enum PageType {
  COVER
  PRESENTATION
  COMPANY_INFO
  INDEX
  TERMS
  CUSTOM
}

enum BlockType {
  RICH_TEXT
  IMAGE
}

enum SyncStatus {
  SYNCED
  PENDING
  ERROR
}

enum AcquisitionType {
  VENTA
  DAAS
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(100)
  email        String   @unique @db.VarChar(150)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         Role
  nomenclature String   @unique @db.VarChar(10)
  signatureUrl String?  @map("signature_url") @db.VarChar(500)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  proposals          Proposal[]
  pdfTemplates       PdfTemplate[]
  syncedFiles        SyncedFile[]
  EmailLog           EmailLog[]
  billingProjections BillingProjection[]

  @@map("users")
}

model Proposal {
  id             String         @id @default(uuid()) @db.Uuid
  proposalCode   String?        @unique @map("proposal_code") @db.VarChar(20)
  userId         String         @map("user_id") @db.Uuid
  clientId       String?        @map("client_id") @db.Uuid
  clientName     String         @map("client_name") @db.VarChar(200)
  subject        String         @db.Text
  issueDate      DateTime       @map("issue_date") @db.Date
  validityDays   Int?           @map("validity_days")
  validityDate   DateTime?      @map("validity_date") @db.Date
  status         ProposalStatus @default(ELABORACION)
  currentVersion Int            @default(1) @map("current_version")
  isLocked       Boolean        @default(false) @map("is_locked")
  closeDate      DateTime?      @map("close_date") @db.Date
  billingDate    DateTime?      @map("billing_date") @db.Date
  acquisitionType AcquisitionType? @map("acquisition_type")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  user             User              @relation(fields: [userId], references: [id])
  client           Client?           @relation(fields: [clientId], references: [id])
  proposalVersions ProposalVersion[]
  proposalItems    ProposalItem[]
  pages            ProposalPage[]
  scenarios        Scenario[]
  syncedFiles      SyncedFile[]
  emailLogs        EmailLog[]

  @@index([userId])
  @@index([status])
  @@index([clientId])
  @@index([createdAt])
  @@map("proposals")
}

model ProposalVersion {
  id            String   @id @default(uuid()) @db.Uuid
  proposalId    String   @map("proposal_id") @db.Uuid
  versionNumber Int      @map("version_number")
  snapshotData  Json     @map("snapshot_data") @db.JsonB
  pdfUrl        String?  @map("pdf_url") @db.VarChar(500)
  isLocked      Boolean  @default(true) @map("is_locked")
  createdAt     DateTime @default(now()) @map("created_at")

  proposal  Proposal   @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  emailLogs EmailLog[]

  @@index([proposalId])
  @@map("proposal_versions")
}

model ProposalPage {
  id         String   @id @default(uuid()) @db.Uuid
  proposalId String   @map("proposal_id") @db.Uuid
  pageType   PageType @map("page_type")
  title      String?  @db.VarChar(200)
  variables  Json?    @db.JsonB
  isLocked   Boolean  @default(false) @map("is_locked")
  sortOrder  Int      @default(0) @map("sort_order")
  createdAt  DateTime @default(now()) @map("created_at")

  proposal      Proposal           @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  blocks        ProposalPageBlock[]
  proposalItems ProposalItem[]

  @@index([proposalId])
  @@map("proposal_pages")
}

model ProposalPageBlock {
  id        String    @id @default(uuid()) @db.Uuid
  pageId    String    @map("page_id") @db.Uuid
  blockType BlockType @map("block_type")
  content   Json?     @db.JsonB
  sortOrder Int       @default(0) @map("sort_order")
  createdAt DateTime  @default(now()) @map("created_at")

  page ProposalPage @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId])
  @@map("proposal_page_blocks")
}

model ProposalItem {
  id          String   @id @default(uuid()) @db.Uuid
  proposalId  String   @map("proposal_id") @db.Uuid
  pageId      String?  @map("page_id") @db.Uuid
  itemType    ItemType @map("item_type")
  name        String   @db.VarChar(300)
  description String?  @db.Text
  brand       String?  @db.VarChar(50)
  partNumber  String?  @map("part_number") @db.VarChar(50)
  quantity    Int      @default(1)

  // Future-proofing detailed cost tracking
  unitCost      Decimal  @map("unit_cost") @db.Decimal(15, 2)
  costCurrency  String   @default("COP") @map("cost_currency") @db.VarChar(5)
  internalCosts Json?    @map("internal_costs") @db.JsonB // Additional flexible cost fields
  marginPct     Decimal? @map("margin_pct") @db.Decimal(5, 2)
  unitPrice     Decimal? @map("unit_price") @db.Decimal(15, 2)

  isTaxable      Boolean  @default(true) @map("is_taxable")
  sortOrder      Int      @default(0) @map("sort_order")
  technicalSpecs Json?    @map("technical_specs")
  createdAt      DateTime @default(now()) @map("created_at")

  proposal      Proposal         @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  page          ProposalPage?    @relation(fields: [pageId], references: [id])
  scenarioItems ScenarioItem[]

  @@index([proposalId])
  @@map("proposal_items")
}

model Scenario {
  id          String  @id @default(uuid()) @db.Uuid
  proposalId  String  @map("proposal_id") @db.Uuid
  name        String  @db.VarChar(100)
  currency      String  @default("COP") @db.VarChar(5)
  conversionTrm Float?  @map("conversion_trm")
  description   String? @db.Text
  sortOrder     Int     @default(0) @map("sort_order")

  proposal      Proposal       @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  scenarioItems ScenarioItem[]

  @@index([proposalId])
  @@map("scenarios")
}

model ScenarioItem {
  id                String   @id @default(uuid()) @db.Uuid
  scenarioId        String   @map("scenario_id") @db.Uuid
  itemId            String   @map("item_id") @db.Uuid
  parentId          String?  @map("parent_id") @db.Uuid
  quantity          Int      @default(1)
  unitCostOverride  Decimal? @map("unit_cost_override") @db.Decimal(15, 2)
  marginPctOverride Decimal? @map("margin_pct_override") @db.Decimal(5, 2)
  unitPriceOverride Decimal? @map("unit_price_override") @db.Decimal(15, 2)
  isDilpidate       Boolean  @default(false) @map("is_dilpidate")

  scenario Scenario      @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  item     ProposalItem  @relation(fields: [itemId], references: [id])
  parent   ScenarioItem? @relation("ScenarioItemChildren", fields: [parentId], references: [id])
  children ScenarioItem[] @relation("ScenarioItemChildren")

  @@index([scenarioId])
  @@index([itemId])
  @@index([parentId])
  @@map("scenario_items")
}

model PdfTemplate {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(100)
  templateType PageType @map("template_type")
  content      Json     @db.JsonB
  sortOrder    Int      @default(0) @map("sort_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdBy    String   @map("created_by") @db.Uuid

  author User @relation(fields: [createdBy], references: [id])

  @@map("pdf_templates")
}

model SyncedFile {
  id         String     @id @default(uuid()) @db.Uuid
  userId     String     @map("user_id") @db.Uuid
  proposalId String?    @map("proposal_id") @db.Uuid
  fileName   String     @map("file_name") @db.VarChar(255)
  filePath   String     @map("file_path") @db.VarChar(500)
  localPath  String?    @map("local_path") @db.VarChar(500)
  fileSize   BigInt?    @map("file_size")
  checksum   String?    @db.VarChar(64)
  syncStatus SyncStatus @default(SYNCED) @map("sync_status")
  syncedAt   DateTime   @default(now()) @map("synced_at")

  user     User      @relation(fields: [userId], references: [id])
  proposal Proposal? @relation(fields: [proposalId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([proposalId])
  @@map("synced_files")
}

model EmailLog {
  id                String  @id @default(uuid()) @db.Uuid
  userId            String  @map("user_id") @db.Uuid
  proposalId        String  @map("proposal_id") @db.Uuid
  proposalVersionId String? @map("proposal_version_id") @db.Uuid
  outlookMessageId  String? @map("outlook_message_id") @db.VarChar(255) // Graph API ID

  toEmail String   @map("to_email") @db.VarChar(255)
  ccEmail String?  @map("cc_email") @db.VarChar(500)
  subject String   @db.VarChar(500)
  body    String   @db.Text
  sentAt  DateTime @default(now()) @map("sent_at")

  hasAttachment Boolean @default(false) @map("has_attachment")

  user            User             @relation(fields: [userId], references: [id])
  proposal        Proposal         @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  proposalVersion ProposalVersion? @relation(fields: [proposalVersionId], references: [id])

  @@index([userId])
  @@index([proposalId])
  @@map("email_logs")
}

model Client {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique @db.VarChar(200)
  nit       String?  @db.VarChar(20)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  proposals Proposal[]
  @@map("clients")
}

model Catalog {
  id        String   @id @default(uuid()) @db.Uuid
  category  String   @db.VarChar(50) // e.g., "FABRICANTE", "PROCESADOR"
  value     String   @db.VarChar(200)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([category, value])
  @@map("catalogs")
}

model BillingProjection {
  id             String         @id @default(uuid()) @db.Uuid
  userId         String         @map("user_id") @db.Uuid
  projectionCode String         @unique @map("projection_code") @db.VarChar(20)
  clientName     String         @map("client_name") @db.VarChar(200)
  subtotal       Decimal        @db.Decimal(15, 2)
  currency       String         @default("COP") @db.VarChar(5)
  status         ProposalStatus @default(PENDIENTE_FACTURAR)
  billingDate    DateTime?      @map("billing_date") @db.Date
  acquisitionType AcquisitionType? @map("acquisition_type")
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("billing_projections")
}
```

- `ProposalItem.costCurrency` — `String @default("COP") @db.VarChar(5)`
- `Scenario.conversionTrm` — `Float?`

### [proposals.dto.ts](file:///d:/novotechflow/apps/api/src/proposals/dto/proposals.dto.ts)

```diff:proposals.dto.ts
import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsEnum, IsDateString, Min, MaxLength, IsObject, IsIn } from 'class-validator';
import { ItemType, ProposalStatus, AcquisitionType } from '@prisma/client';

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

    @IsOptional()
    @IsEnum(AcquisitionType)
    acquisitionType?: AcquisitionType;
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

    @IsOptional()
    @IsBoolean()
    isDilpidate?: boolean;
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

// ── Proposal Pages DTOs ──────────────────────────────────────

/**
 * DTO para crear una nueva página personalizada.
 */
export class CreatePageDto {
    @IsString()
    @MaxLength(200)
    title: string;
}

/**
 * DTO para actualizar una página.
 */
export class UpdatePageDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @IsOptional()
    @IsObject()
    variables?: Record<string, unknown>;
}

/**
 * DTO para reordenar páginas.
 */
export class ReorderPagesDto {
    @IsString({ each: true })
    pageIds: string[];
}

// ── Proposal Page Blocks DTOs ────────────────────────────────

/**
 * DTO para crear un bloque dentro de una página.
 */
export class CreateBlockDto {
    @IsIn(['RICH_TEXT', 'IMAGE'])
    blockType: 'RICH_TEXT' | 'IMAGE';

    @IsOptional()
    @IsObject()
    content?: Record<string, unknown>;
}

/**
 * DTO para actualizar un bloque.
 */
export class UpdateBlockDto {
    @IsOptional()
    @IsObject()
    content?: Record<string, unknown>;
}

/**
 * DTO para reordenar bloques.
 */
export class ReorderBlocksDto {
    @IsString({ each: true })
    blockIds: string[];
}
===
import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsEnum, IsDateString, Min, MaxLength, IsObject, IsIn } from 'class-validator';
import { ItemType, ProposalStatus, AcquisitionType } from '@prisma/client';

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

    @IsOptional()
    @IsEnum(AcquisitionType)
    acquisitionType?: AcquisitionType;
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

    @IsOptional()
    @IsString()
    costCurrency?: string;
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

    @IsOptional()
    @IsString()
    costCurrency?: string;
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

    @IsOptional()
    @IsNumber()
    conversionTrm?: number;
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

    @IsOptional()
    @IsNumber()
    conversionTrm?: number;
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

    @IsOptional()
    @IsBoolean()
    isDilpidate?: boolean;
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

// ── Proposal Pages DTOs ──────────────────────────────────────

/**
 * DTO para crear una nueva página personalizada.
 */
export class CreatePageDto {
    @IsString()
    @MaxLength(200)
    title: string;
}

/**
 * DTO para actualizar una página.
 */
export class UpdatePageDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @IsOptional()
    @IsObject()
    variables?: Record<string, unknown>;
}

/**
 * DTO para reordenar páginas.
 */
export class ReorderPagesDto {
    @IsString({ each: true })
    pageIds: string[];
}

// ── Proposal Page Blocks DTOs ────────────────────────────────

/**
 * DTO para crear un bloque dentro de una página.
 */
export class CreateBlockDto {
    @IsIn(['RICH_TEXT', 'IMAGE'])
    blockType: 'RICH_TEXT' | 'IMAGE';

    @IsOptional()
    @IsObject()
    content?: Record<string, unknown>;
}

/**
 * DTO para actualizar un bloque.
 */
export class UpdateBlockDto {
    @IsOptional()
    @IsObject()
    content?: Record<string, unknown>;
}

/**
 * DTO para reordenar bloques.
 */
export class ReorderBlocksDto {
    @IsString({ each: true })
    blockIds: string[];
}
```

- `CreateProposalItemDto.costCurrency` — `@IsOptional() @IsString()`
- `UpdateProposalItemDto.costCurrency` — `@IsOptional() @IsString()`
- `CreateScenarioDto.conversionTrm` — `@IsOptional() @IsNumber()`
- `UpdateScenarioDto.conversionTrm` — `@IsOptional() @IsNumber()`

### [proposals.service.ts](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts)

```diff:proposals.service.ts
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizePlainText } from '../common/sanitize';
import {
    CreateProposalDto,
    UpdateProposalDto,
    CreateProposalItemDto,
    UpdateProposalItemDto,
} from './dto/proposals.dto';


@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica que el usuario tenga acceso a la propuesta.
   * ADMIN accede a todas; COMMERCIAL solo a las propias.
   * Público para que ScenariosService y PagesService lo importen.
   */
  async verifyProposalOwnership(proposalId: string, user: AuthenticatedUser) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
    if (user.role !== 'ADMIN' && proposal.userId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta propuesta.');
    }
    return proposal;
  }

  /**
   * Busca propuestas recientes que coincidan con el término de búsqueda.
   * NOTA DE SEGURIDAD: Este endpoint muestra propuestas de TODOS los usuarios
   * intencionalmente. Su propósito es detectar cruces de cuenta entre comerciales
   * antes de crear una nueva propuesta para el mismo cliente.
   * Revisado en auditoría de seguridad 2026-04-05 — comportamiento aceptado.
   */
  async findPotentialConflicts(query: string): Promise<any[]> {
    const normalizedQuery = query?.trim();

    // Early return si no hay suficiente información para buscar
    if (!normalizedQuery || normalizedQuery.length < 3) {
      return [];
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return this.prisma.proposal.findMany({
      where: {
        OR: [
          { clientName: { contains: normalizedQuery, mode: 'insensitive' } },
          { subject: { contains: normalizedQuery, mode: 'insensitive' } }
        ],
        createdAt: { gte: oneYearAgo },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Limitamos para evitar sobrecarga visual
    });
  }

  /**
   * Orquesta la creación de una nueva propuesta comercial.
   * 
   * @param {string} userId - ID del usuario comercial que crea la oferta.
   * @param {ICreateProposalInput} data - Payload con la información de la propuesta.
   * @throws {NotFoundException} Si el usuario no existe.
   */
  async createProposal(userId: string, data: CreateProposalDto) {
    try {
      const user = await this.validateUserAccess(userId);
      const clientId = await this.ensureClientExists(data.clientName, data.clientId);
      const proposalCode = await this.generateProposalCode(user.nomenclature, userId);

      return await this.prisma.proposal.create({
        data: {
          proposalCode,
          userId,
          clientId,
          clientName: sanitizePlainText(data.clientName.trim().toUpperCase()),
          subject: sanitizePlainText(data.subject),
          issueDate: new Date(data.issueDate),
          validityDays: typeof data.validityDays === 'string' ? parseInt(data.validityDays, 10) : data.validityDays,
          validityDate: new Date(data.validityDate),
          status: ProposalStatus.ELABORACION,
        },
      });
    } catch (error) {
      this.logger.error(`Falla al crear propuesta para usuario ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Valida la existencia del usuario y su capacidad para crear propuestas.
   * @private
   */
  private async validateUserAccess(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // Early return pattern para validación
    if (!user) {
      throw new NotFoundException(`El usuario con ID ${userId} no fue encontrado en el sistema.`);
    }
    
    return user;
  }

  /**
   * Garantiza que el cliente esté registrado en la base de datos centralizada (Master Data).
   * Implementa un patrón Upsert para evitar duplicidad de nombres normalizados.
   * @private
   */
  private async ensureClientExists(name: string, existingId?: string): Promise<string> {
    const normalizedName = name.trim().toUpperCase();
    
    // Si ya tenemos un ID verificado, lo usamos directamente (OCP)
    if (existingId) return existingId;

    // Si no, realizamos un registro automático
    const client = await this.prisma.client.upsert({
      where: { name: normalizedName },
      update: {}, 
      create: {
        name: normalizedName,
        isActive: true
      }
    });

    return client.id;
  }

  /**
   * Genera un código de propuesta único siguiendo el estándar corporativo COT-[NOMENCLATURA][SECUENCIAL]-[VERSION].
   * @private
   */
  private async generateProposalCode(nomenclature: string, userId: string): Promise<string> {
    const prefix = nomenclature || 'XX';
    
    // Buscamos la última propuesta de este usuario para obtener el número secuencial más alto
    const lastProposal = await this.prisma.proposal.findFirst({
      where: { userId },
      orderBy: { proposalCode: 'desc' },
      select: { proposalCode: true }
    });
    
    let nextNumber = 1;
    
    if (lastProposal?.proposalCode) {
      // Extraemos el número del formato COT-PREFIX0001-1 usando regex
      // El patrón busca dígitos antes del guion de la versión final
      const match = lastProposal.proposalCode.match(/(\d+)-\d+$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const sequential = nextNumber.toString().padStart(4, '0');
    
    // El "-1" representa la versión inicial del borrador
    return `COT-${prefix}${sequential}-1`;
  }

  /**
   * Recupera una propuesta con sus ítems asociados para edición.
   */
  async getProposalById(id: string, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: { orderBy: { sortOrder: 'asc' } }
      }
    });
  }

  /**
   * Actualiza los datos generales de una propuesta existente.
   * 
   * @param {string} id - UUID de la propuesta.
   * @param {any} data - Nuevos datos (asunto, fechas, etc).
   */
  async updateProposal(id: string, data: UpdateProposalDto, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.update({
      where: { id },
      data: {
        subject: data.subject ? sanitizePlainText(data.subject) : undefined,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        validityDays: data.validityDays ?? undefined,
        validityDate: data.validityDate ? new Date(data.validityDate) : undefined,
        status: data.status ?? undefined,
        closeDate: data.closeDate ? new Date(data.closeDate) : data.closeDate === null ? null : undefined,
        billingDate: data.billingDate ? new Date(data.billingDate) : data.billingDate === null ? null : undefined,
        acquisitionType: data.acquisitionType ?? undefined,
      },
    });
  }

  /**
   * Añade un nuevo ítem (producto/servicio) a la propuesta.
   * Gestiona el correlativo de orden (sortOrder) automáticamente.
   */
  async addProposalItem(proposalId: string, data: CreateProposalItemDto, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(proposalId, user);
    const aggregate = await this.prisma.proposalItem.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalItem.create({
      data: {
        proposalId,
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity || 1,
        unitCost: data.unitCost || 0,
        marginPct: data.marginPct || 0,
        unitPrice: data.unitPrice || 0,
        isTaxable: data.isTaxable ?? true,
        technicalSpecs: (data.technicalSpecs || {}) as object,
        internalCosts: (data.internalCosts || {}) as object,
        sortOrder: nextOrder,
      }
    });
  }

  /**
   * Elimina un ítem específico de una propuesta.
   */
  async removeProposalItem(itemId: string, user: AuthenticatedUser) {
    const item = await this.prisma.proposalItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ítem no encontrado.');
    await this.verifyProposalOwnership(item.proposalId, user);
    return this.prisma.proposalItem.delete({
      where: { id: itemId }
    });
  }

  /**
   * Actualiza un ítem específico de una propuesta.
   */
  async updateProposalItem(itemId: string, data: UpdateProposalItemDto, user: AuthenticatedUser) {
    const item = await this.prisma.proposalItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ítem no encontrado.');
    await this.verifyProposalOwnership(item.proposalId, user);
    return this.prisma.proposalItem.update({
      where: { id: itemId },
      data: {
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity,
        unitCost: data.unitCost,
        marginPct: data.marginPct,
        unitPrice: data.unitPrice,
        isTaxable: data.isTaxable,
        technicalSpecs: data.technicalSpecs as object | undefined,
        internalCosts: data.internalCosts as object | undefined,
      }
    });
  }

  /**
   * Lista propuestas filtradas por control de acceso basado en rol (RBAC).
   * ADMIN tiene visibilidad total; COMERCIAL solo ve las propias.
   *
   * @param {any} user - Objeto del usuario autenticado (proviene del JWT payload).
   * @returns Lista de propuestas con datos del comercial asociado.
   */
  async findAll(user: AuthenticatedUser) {
    const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };

    return this.prisma.proposal.findMany({
      where: accessFilter,
      include: {
        user: { select: { name: true, nomenclature: true } },
        scenarios: {
          include: {
            scenarioItems: {
              where: { parentId: null },
              include: {
                item: true,
                children: { include: { item: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Clona una propuesta existente incluyendo ítems y escenarios.
   * NEW_VERSION: incrementa la versión (COT-LM0001-1 → COT-LM0001-2)
   * NEW_PROPOSAL: genera nuevo código secuencial (COT-LM0002-1)
   */
  async cloneProposal(id: string, userId: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL', user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    const original = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: true,
        scenarios: {
          include: {
            scenarioItems: {
              include: { children: true },
            },
          },
        },
      },
    });

    if (!original) throw new NotFoundException('Propuesta no encontrada.');

    let newCode: string;

    if (cloneType === 'NEW_VERSION') {
      // Increment version: COT-LM0001-1 → COT-LM0001-2
      const baseParts = original.proposalCode?.match(/^(.+)-(\d+)$/);
      if (baseParts) {
        const nextVersion = parseInt(baseParts[2], 10) + 1;
        newCode = `${baseParts[1]}-${nextVersion}`;
      } else {
        newCode = `${original.proposalCode}-2`;
      }
    } else {
      // NEW_PROPOSAL: Generate new sequential code
      const user = await this.validateUserAccess(userId);
      newCode = await this.generateProposalCode(user.nomenclature, userId);
    }

    // Create the new proposal
    const cloned = await this.prisma.proposal.create({
      data: {
        proposalCode: newCode,
        userId,
        clientId: original.clientId,
        clientName: original.clientName,
        subject: original.subject,
        issueDate: new Date(),
        validityDays: original.validityDays,
        validityDate: original.validityDate,
        status: ProposalStatus.ELABORACION,
      },
    });

    // Clone proposal items, mapping old IDs to new IDs
    const itemIdMap = new Map<string, string>();
    for (const item of original.proposalItems) {
      const newItem = await this.prisma.proposalItem.create({
        data: {
          proposalId: cloned.id,
          itemType: item.itemType,
          name: item.name,
          description: item.description,
          brand: item.brand,
          partNumber: item.partNumber,
          quantity: item.quantity,
          unitCost: item.unitCost,
          marginPct: item.marginPct,
          unitPrice: item.unitPrice,
          isTaxable: item.isTaxable,
          technicalSpecs: item.technicalSpecs as object | undefined,
          internalCosts: item.internalCosts as object | undefined,
          sortOrder: item.sortOrder,
        },
      });
      itemIdMap.set(item.id, newItem.id);
    }

    // Clone scenarios with items
    for (const scenario of original.scenarios) {
      const newScenario = await this.prisma.scenario.create({
        data: {
          proposalId: cloned.id,
          name: scenario.name,
          currency: scenario.currency,
          description: scenario.description,
          sortOrder: scenario.sortOrder,
        },
      });

      // Clone root scenario items (parentId = null)
      const rootItems = scenario.scenarioItems.filter(si => !si.parentId);
      const scenarioItemIdMap = new Map<string, string>();

      for (const si of rootItems) {
        const newItemId = itemIdMap.get(si.itemId) || si.itemId;
        const newSi = await this.prisma.scenarioItem.create({
          data: {
            scenarioId: newScenario.id,
            itemId: newItemId,
            quantity: si.quantity,
            marginPctOverride: si.marginPctOverride,
          },
        });
        scenarioItemIdMap.set(si.id, newSi.id);
      }

      // Clone child scenario items
      const childItems = scenario.scenarioItems.filter(si => si.parentId);
      for (const child of childItems) {
        const newParentId = scenarioItemIdMap.get(child.parentId!) || child.parentId;
        const newItemId = itemIdMap.get(child.itemId) || child.itemId;
        await this.prisma.scenarioItem.create({
          data: {
            scenarioId: newScenario.id,
            itemId: newItemId,
            parentId: newParentId,
            quantity: child.quantity,
            marginPctOverride: child.marginPctOverride,
          },
        });
      }
    }

    return cloned;
  }

  /**
   * Elimina una propuesta completa y sus dependencias.
   * Las cascadas en el schema (onDelete: Cascade) eliminan automáticamente:
   * pages, blocks, items, scenarios, scenarioItems, versions, emailLogs.
   * SyncedFiles se desvinculan (onDelete: SetNull).
   */
  async deleteProposal(id: string, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.delete({ where: { id } });
  }
}
===
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizePlainText } from '../common/sanitize';
import {
    CreateProposalDto,
    UpdateProposalDto,
    CreateProposalItemDto,
    UpdateProposalItemDto,
} from './dto/proposals.dto';


@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica que el usuario tenga acceso a la propuesta.
   * ADMIN accede a todas; COMMERCIAL solo a las propias.
   * Público para que ScenariosService y PagesService lo importen.
   */
  async verifyProposalOwnership(proposalId: string, user: AuthenticatedUser) {
    const proposal = await this.prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
    if (user.role !== 'ADMIN' && proposal.userId !== user.id) {
      throw new ForbiddenException('No tienes acceso a esta propuesta.');
    }
    return proposal;
  }

  /**
   * Busca propuestas recientes que coincidan con el término de búsqueda.
   * NOTA DE SEGURIDAD: Este endpoint muestra propuestas de TODOS los usuarios
   * intencionalmente. Su propósito es detectar cruces de cuenta entre comerciales
   * antes de crear una nueva propuesta para el mismo cliente.
   * Revisado en auditoría de seguridad 2026-04-05 — comportamiento aceptado.
   */
  async findPotentialConflicts(query: string): Promise<any[]> {
    const normalizedQuery = query?.trim();

    // Early return si no hay suficiente información para buscar
    if (!normalizedQuery || normalizedQuery.length < 3) {
      return [];
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return this.prisma.proposal.findMany({
      where: {
        OR: [
          { clientName: { contains: normalizedQuery, mode: 'insensitive' } },
          { subject: { contains: normalizedQuery, mode: 'insensitive' } }
        ],
        createdAt: { gte: oneYearAgo },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Limitamos para evitar sobrecarga visual
    });
  }

  /**
   * Orquesta la creación de una nueva propuesta comercial.
   * 
   * @param {string} userId - ID del usuario comercial que crea la oferta.
   * @param {ICreateProposalInput} data - Payload con la información de la propuesta.
   * @throws {NotFoundException} Si el usuario no existe.
   */
  async createProposal(userId: string, data: CreateProposalDto) {
    try {
      const user = await this.validateUserAccess(userId);
      const clientId = await this.ensureClientExists(data.clientName, data.clientId);
      const proposalCode = await this.generateProposalCode(user.nomenclature, userId);

      return await this.prisma.proposal.create({
        data: {
          proposalCode,
          userId,
          clientId,
          clientName: sanitizePlainText(data.clientName.trim().toUpperCase()),
          subject: sanitizePlainText(data.subject),
          issueDate: new Date(data.issueDate),
          validityDays: typeof data.validityDays === 'string' ? parseInt(data.validityDays, 10) : data.validityDays,
          validityDate: new Date(data.validityDate),
          status: ProposalStatus.ELABORACION,
        },
      });
    } catch (error) {
      this.logger.error(`Falla al crear propuesta para usuario ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Valida la existencia del usuario y su capacidad para crear propuestas.
   * @private
   */
  private async validateUserAccess(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // Early return pattern para validación
    if (!user) {
      throw new NotFoundException(`El usuario con ID ${userId} no fue encontrado en el sistema.`);
    }
    
    return user;
  }

  /**
   * Garantiza que el cliente esté registrado en la base de datos centralizada (Master Data).
   * Implementa un patrón Upsert para evitar duplicidad de nombres normalizados.
   * @private
   */
  private async ensureClientExists(name: string, existingId?: string): Promise<string> {
    const normalizedName = name.trim().toUpperCase();
    
    // Si ya tenemos un ID verificado, lo usamos directamente (OCP)
    if (existingId) return existingId;

    // Si no, realizamos un registro automático
    const client = await this.prisma.client.upsert({
      where: { name: normalizedName },
      update: {}, 
      create: {
        name: normalizedName,
        isActive: true
      }
    });

    return client.id;
  }

  /**
   * Genera un código de propuesta único siguiendo el estándar corporativo COT-[NOMENCLATURA][SECUENCIAL]-[VERSION].
   * @private
   */
  private async generateProposalCode(nomenclature: string, userId: string): Promise<string> {
    const prefix = nomenclature || 'XX';
    
    // Buscamos la última propuesta de este usuario para obtener el número secuencial más alto
    const lastProposal = await this.prisma.proposal.findFirst({
      where: { userId },
      orderBy: { proposalCode: 'desc' },
      select: { proposalCode: true }
    });
    
    let nextNumber = 1;
    
    if (lastProposal?.proposalCode) {
      // Extraemos el número del formato COT-PREFIX0001-1 usando regex
      // El patrón busca dígitos antes del guion de la versión final
      const match = lastProposal.proposalCode.match(/(\d+)-\d+$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const sequential = nextNumber.toString().padStart(4, '0');
    
    // El "-1" representa la versión inicial del borrador
    return `COT-${prefix}${sequential}-1`;
  }

  /**
   * Recupera una propuesta con sus ítems asociados para edición.
   */
  async getProposalById(id: string, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: { orderBy: { sortOrder: 'asc' } }
      }
    });
  }

  /**
   * Actualiza los datos generales de una propuesta existente.
   * 
   * @param {string} id - UUID de la propuesta.
   * @param {any} data - Nuevos datos (asunto, fechas, etc).
   */
  async updateProposal(id: string, data: UpdateProposalDto, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.update({
      where: { id },
      data: {
        subject: data.subject ? sanitizePlainText(data.subject) : undefined,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        validityDays: data.validityDays ?? undefined,
        validityDate: data.validityDate ? new Date(data.validityDate) : undefined,
        status: data.status ?? undefined,
        closeDate: data.closeDate ? new Date(data.closeDate) : data.closeDate === null ? null : undefined,
        billingDate: data.billingDate ? new Date(data.billingDate) : data.billingDate === null ? null : undefined,
        acquisitionType: data.acquisitionType ?? undefined,
      },
    });
  }

  /**
   * Añade un nuevo ítem (producto/servicio) a la propuesta.
   * Gestiona el correlativo de orden (sortOrder) automáticamente.
   */
  async addProposalItem(proposalId: string, data: CreateProposalItemDto, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(proposalId, user);
    const aggregate = await this.prisma.proposalItem.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalItem.create({
      data: {
        proposalId,
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity || 1,
        unitCost: data.unitCost || 0,
        costCurrency: data.costCurrency || 'COP',
        marginPct: data.marginPct || 0,
        unitPrice: data.unitPrice || 0,
        isTaxable: data.isTaxable ?? true,
        technicalSpecs: (data.technicalSpecs || {}) as object,
        internalCosts: (data.internalCosts || {}) as object,
        sortOrder: nextOrder,
      }
    });
  }

  /**
   * Elimina un ítem específico de una propuesta.
   */
  async removeProposalItem(itemId: string, user: AuthenticatedUser) {
    const item = await this.prisma.proposalItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ítem no encontrado.');
    await this.verifyProposalOwnership(item.proposalId, user);
    return this.prisma.proposalItem.delete({
      where: { id: itemId }
    });
  }

  /**
   * Actualiza un ítem específico de una propuesta.
   */
  async updateProposalItem(itemId: string, data: UpdateProposalItemDto, user: AuthenticatedUser) {
    const item = await this.prisma.proposalItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Ítem no encontrado.');
    await this.verifyProposalOwnership(item.proposalId, user);
    return this.prisma.proposalItem.update({
      where: { id: itemId },
      data: {
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: data.quantity,
        unitCost: data.unitCost,
        costCurrency: data.costCurrency,
        marginPct: data.marginPct,
        unitPrice: data.unitPrice,
        isTaxable: data.isTaxable,
        technicalSpecs: data.technicalSpecs as object | undefined,
        internalCosts: data.internalCosts as object | undefined,
      }
    });
  }

  /**
   * Lista propuestas filtradas por control de acceso basado en rol (RBAC).
   * ADMIN tiene visibilidad total; COMERCIAL solo ve las propias.
   *
   * @param {any} user - Objeto del usuario autenticado (proviene del JWT payload).
   * @returns Lista de propuestas con datos del comercial asociado.
   */
  async findAll(user: AuthenticatedUser) {
    const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };

    return this.prisma.proposal.findMany({
      where: accessFilter,
      include: {
        user: { select: { name: true, nomenclature: true } },
        scenarios: {
          include: {
            scenarioItems: {
              where: { parentId: null },
              include: {
                item: true,
                children: { include: { item: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Clona una propuesta existente incluyendo ítems y escenarios.
   * NEW_VERSION: incrementa la versión (COT-LM0001-1 → COT-LM0001-2)
   * NEW_PROPOSAL: genera nuevo código secuencial (COT-LM0002-1)
   */
  async cloneProposal(id: string, userId: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL', user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    const original = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: true,
        scenarios: {
          include: {
            scenarioItems: {
              include: { children: true },
            },
          },
        },
      },
    });

    if (!original) throw new NotFoundException('Propuesta no encontrada.');

    let newCode: string;

    if (cloneType === 'NEW_VERSION') {
      // Increment version: COT-LM0001-1 → COT-LM0001-2
      const baseParts = original.proposalCode?.match(/^(.+)-(\d+)$/);
      if (baseParts) {
        const nextVersion = parseInt(baseParts[2], 10) + 1;
        newCode = `${baseParts[1]}-${nextVersion}`;
      } else {
        newCode = `${original.proposalCode}-2`;
      }
    } else {
      // NEW_PROPOSAL: Generate new sequential code
      const user = await this.validateUserAccess(userId);
      newCode = await this.generateProposalCode(user.nomenclature, userId);
    }

    // Create the new proposal
    const cloned = await this.prisma.proposal.create({
      data: {
        proposalCode: newCode,
        userId,
        clientId: original.clientId,
        clientName: original.clientName,
        subject: original.subject,
        issueDate: new Date(),
        validityDays: original.validityDays,
        validityDate: original.validityDate,
        status: ProposalStatus.ELABORACION,
      },
    });

    // Clone proposal items, mapping old IDs to new IDs
    const itemIdMap = new Map<string, string>();
    for (const item of original.proposalItems) {
      const newItem = await this.prisma.proposalItem.create({
        data: {
          proposalId: cloned.id,
          itemType: item.itemType,
          name: item.name,
          description: item.description,
          brand: item.brand,
          partNumber: item.partNumber,
          quantity: item.quantity,
          unitCost: item.unitCost,
          costCurrency: item.costCurrency,
          marginPct: item.marginPct,
          unitPrice: item.unitPrice,
          isTaxable: item.isTaxable,
          technicalSpecs: item.technicalSpecs as object | undefined,
          internalCosts: item.internalCosts as object | undefined,
          sortOrder: item.sortOrder,
        },
      });
      itemIdMap.set(item.id, newItem.id);
    }

    // Clone scenarios with items
    for (const scenario of original.scenarios) {
      const newScenario = await this.prisma.scenario.create({
        data: {
          proposalId: cloned.id,
          name: scenario.name,
          currency: scenario.currency,
          description: scenario.description,
          sortOrder: scenario.sortOrder,
        },
      });

      // Clone root scenario items (parentId = null)
      const rootItems = scenario.scenarioItems.filter(si => !si.parentId);
      const scenarioItemIdMap = new Map<string, string>();

      for (const si of rootItems) {
        const newItemId = itemIdMap.get(si.itemId) || si.itemId;
        const newSi = await this.prisma.scenarioItem.create({
          data: {
            scenarioId: newScenario.id,
            itemId: newItemId,
            quantity: si.quantity,
            marginPctOverride: si.marginPctOverride,
          },
        });
        scenarioItemIdMap.set(si.id, newSi.id);
      }

      // Clone child scenario items
      const childItems = scenario.scenarioItems.filter(si => si.parentId);
      for (const child of childItems) {
        const newParentId = scenarioItemIdMap.get(child.parentId!) || child.parentId;
        const newItemId = itemIdMap.get(child.itemId) || child.itemId;
        await this.prisma.scenarioItem.create({
          data: {
            scenarioId: newScenario.id,
            itemId: newItemId,
            parentId: newParentId,
            quantity: child.quantity,
            marginPctOverride: child.marginPctOverride,
          },
        });
      }
    }

    return cloned;
  }

  /**
   * Elimina una propuesta completa y sus dependencias.
   * Las cascadas en el schema (onDelete: Cascade) eliminan automáticamente:
   * pages, blocks, items, scenarios, scenarioItems, versions, emailLogs.
   * SyncedFiles se desvinculan (onDelete: SetNull).
   */
  async deleteProposal(id: string, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.proposal.delete({ where: { id } });
  }
}
```

- `addProposalItem` → includes `costCurrency`
- `updateProposalItem` → includes `costCurrency`
- `cloneProposal` → copies `costCurrency` per item

### [scenarios.service.ts](file:///d:/novotechflow/apps/api/src/proposals/scenarios.service.ts)

```diff:scenarios.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizePlainText } from '../common/sanitize';
import {
    CreateScenarioDto,
    UpdateScenarioDto,
    AddScenarioItemDto,
    UpdateScenarioItemDto,
} from './dto/proposals.dto';


@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Verifica ownership a través de un escenario.
   * Busca el scenario → obtiene proposalId → verifica ownership.
   */
  private async verifyScenarioOwnership(scenarioId: string, user: AuthenticatedUser) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Escenario no encontrado.');
    await this.proposalsService.verifyProposalOwnership(scenario.proposalId, user);
    return scenario;
  }

  /**
   * Recupera todos los escenarios para una propuesta con sus ítems asociados.
   */
  async getScenariosByProposalId(proposalId: string, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    return this.prisma.scenario.findMany({
      where: { proposalId },
      include: {
        scenarioItems: {
          where: { parentId: null },
          include: {
            item: true,
            children: {
              include: { item: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea un nuevo escenario para una propuesta.
   */
  async createScenario(proposalId: string, data: CreateScenarioDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    const aggregate = await this.prisma.scenario.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.scenario.create({
      data: {
        proposalId,
        name: data.name,
        currency: data.currency || 'COP',
        description: data.description ? sanitizePlainText(data.description) : undefined,
        sortOrder: nextOrder
      }
    });
  }

  /**
   * Actualiza un escenario existente.
   */
  async updateScenario(id: string, data: UpdateScenarioDto, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(id, user);
    return this.prisma.scenario.update({
      where: { id },
      data: {
        name: data.name,
        currency: data.currency,
        description: data.description ? sanitizePlainText(data.description) : data.description
      }
    });
  }

  /**
   * Elimina un escenario.
   * La cascada (onDelete: Cascade) elimina automáticamente los scenarioItems.
   */
  async deleteScenario(id: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(id, user);
    return this.prisma.scenario.delete({ where: { id } });
  }

  /**
   * Clona un escenario existente con todos sus ítems y sub-ítems.
   */
  async cloneScenario(scenarioId: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    const original = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        scenarioItems: {
          include: { children: true },
        },
      },
    });

    if (!original) throw new NotFoundException('Escenario no encontrado.');

    const aggregate = await this.prisma.scenario.aggregate({
      where: { proposalId: original.proposalId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    const cloned = await this.prisma.scenario.create({
      data: {
        proposalId: original.proposalId,
        name: `${original.name} (Copia)`,
        currency: original.currency,
        description: original.description,
        sortOrder: nextOrder,
      },
    });

    // Clone root items (parentId = null)
    const rootItems = original.scenarioItems.filter(si => !si.parentId);
    const siIdMap = new Map<string, string>();

    for (const si of rootItems) {
      const newSi = await this.prisma.scenarioItem.create({
        data: {
          scenarioId: cloned.id,
          itemId: si.itemId,
          quantity: si.quantity,
          marginPctOverride: si.marginPctOverride,
          isDilpidate: si.isDilpidate,
        },
      });
      siIdMap.set(si.id, newSi.id);
    }

    // Clone child items
    const childItems = original.scenarioItems.filter(si => si.parentId);
    for (const child of childItems) {
      const newParentId = siIdMap.get(child.parentId!) || child.parentId;
      await this.prisma.scenarioItem.create({
        data: {
          scenarioId: cloned.id,
          itemId: child.itemId,
          parentId: newParentId,
          quantity: child.quantity,
          marginPctOverride: child.marginPctOverride,
          isDilpidate: child.isDilpidate,
        },
      });
    }

    // Return the full cloned scenario with items
    return this.prisma.scenario.findUnique({
      where: { id: cloned.id },
      include: {
        scenarioItems: {
          where: { parentId: null },
          include: {
            item: true,
            children: { include: { item: true } },
          },
        },
      },
    });
  }

  /**
   * Vincula un item de propuesta a un escenario.
   */
  async addScenarioItem(scenarioId: string, data: AddScenarioItemDto, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    return this.prisma.scenarioItem.create({
      data: {
        scenarioId,
        itemId: data.itemId,
        parentId: data.parentId ?? undefined,
        quantity: data.quantity || 1,
        marginPctOverride: data.marginPct ?? undefined,
      },
      include: {
        item: true,
        children: { include: { item: true } },
      },
    });
  }

  /**
   * Actualiza un ítem dentro de un escenario.
   */
  async updateScenarioItem(id: string, data: UpdateScenarioItemDto, user: AuthenticatedUser) {
    const scenarioItem = await this.prisma.scenarioItem.findUnique({ where: { id } });
    if (!scenarioItem) throw new NotFoundException('Ítem de escenario no encontrado.');
    await this.verifyScenarioOwnership(scenarioItem.scenarioId, user);
    return this.prisma.scenarioItem.update({
      where: { id },
      data: {
        quantity: data.quantity,
        marginPctOverride: data.marginPct,
        isDilpidate: data.isDilpidate,
      }
    });
  }

  /**
   * Elimina un ítem específico de un escenario.
   */
  async removeScenarioItem(id: string, user: AuthenticatedUser) {
    const scenarioItem = await this.prisma.scenarioItem.findUnique({ where: { id } });
    if (!scenarioItem) throw new NotFoundException('Ítem de escenario no encontrado.');
    await this.verifyScenarioOwnership(scenarioItem.scenarioId, user);
    // Cascade: delete children first, then the item itself
    await this.prisma.scenarioItem.deleteMany({ where: { parentId: id } });
    return this.prisma.scenarioItem.delete({ where: { id } });
  }

  /**
   * Aplica un margen global a todos los ítems de un escenario específico.
   * Esto sobreescribe cualquier margen individual previo.
   */
  async applyMarginToEntireScenario(scenarioId: string, marginPct: number, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    return this.prisma.scenarioItem.updateMany({
      where: { scenarioId },
      data: {
        marginPctOverride: marginPct
      }
    });
  }
}
===
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizePlainText } from '../common/sanitize';
import {
    CreateScenarioDto,
    UpdateScenarioDto,
    AddScenarioItemDto,
    UpdateScenarioItemDto,
} from './dto/proposals.dto';


@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Verifica ownership a través de un escenario.
   * Busca el scenario → obtiene proposalId → verifica ownership.
   */
  private async verifyScenarioOwnership(scenarioId: string, user: AuthenticatedUser) {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException('Escenario no encontrado.');
    await this.proposalsService.verifyProposalOwnership(scenario.proposalId, user);
    return scenario;
  }

  /**
   * Recupera todos los escenarios para una propuesta con sus ítems asociados.
   */
  async getScenariosByProposalId(proposalId: string, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    return this.prisma.scenario.findMany({
      where: { proposalId },
      include: {
        scenarioItems: {
          where: { parentId: null },
          include: {
            item: true,
            children: {
              include: { item: true },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea un nuevo escenario para una propuesta.
   */
  async createScenario(proposalId: string, data: CreateScenarioDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    const aggregate = await this.prisma.scenario.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.scenario.create({
      data: {
        proposalId,
        name: data.name,
        currency: data.currency || 'COP',
        conversionTrm: data.conversionTrm ?? undefined,
        description: data.description ? sanitizePlainText(data.description) : undefined,
        sortOrder: nextOrder
      }
    });
  }

  /**
   * Actualiza un escenario existente.
   */
  async updateScenario(id: string, data: UpdateScenarioDto, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(id, user);
    return this.prisma.scenario.update({
      where: { id },
      data: {
        name: data.name,
        currency: data.currency,
        conversionTrm: data.conversionTrm,
        description: data.description ? sanitizePlainText(data.description) : data.description
      }
    });
  }

  /**
   * Elimina un escenario.
   * La cascada (onDelete: Cascade) elimina automáticamente los scenarioItems.
   */
  async deleteScenario(id: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(id, user);
    return this.prisma.scenario.delete({ where: { id } });
  }

  /**
   * Clona un escenario existente con todos sus ítems y sub-ítems.
   */
  async cloneScenario(scenarioId: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    const original = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        scenarioItems: {
          include: { children: true },
        },
      },
    });

    if (!original) throw new NotFoundException('Escenario no encontrado.');

    const aggregate = await this.prisma.scenario.aggregate({
      where: { proposalId: original.proposalId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    const cloned = await this.prisma.scenario.create({
      data: {
        proposalId: original.proposalId,
        name: `${original.name} (Copia)`,
        currency: original.currency,
        conversionTrm: original.conversionTrm,
        description: original.description,
        sortOrder: nextOrder,
      },
    });

    // Clone root items (parentId = null)
    const rootItems = original.scenarioItems.filter(si => !si.parentId);
    const siIdMap = new Map<string, string>();

    for (const si of rootItems) {
      const newSi = await this.prisma.scenarioItem.create({
        data: {
          scenarioId: cloned.id,
          itemId: si.itemId,
          quantity: si.quantity,
          marginPctOverride: si.marginPctOverride,
          isDilpidate: si.isDilpidate,
        },
      });
      siIdMap.set(si.id, newSi.id);
    }

    // Clone child items
    const childItems = original.scenarioItems.filter(si => si.parentId);
    for (const child of childItems) {
      const newParentId = siIdMap.get(child.parentId!) || child.parentId;
      await this.prisma.scenarioItem.create({
        data: {
          scenarioId: cloned.id,
          itemId: child.itemId,
          parentId: newParentId,
          quantity: child.quantity,
          marginPctOverride: child.marginPctOverride,
          isDilpidate: child.isDilpidate,
        },
      });
    }

    // Return the full cloned scenario with items
    return this.prisma.scenario.findUnique({
      where: { id: cloned.id },
      include: {
        scenarioItems: {
          where: { parentId: null },
          include: {
            item: true,
            children: { include: { item: true } },
          },
        },
      },
    });
  }

  /**
   * Vincula un item de propuesta a un escenario.
   */
  async addScenarioItem(scenarioId: string, data: AddScenarioItemDto, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    return this.prisma.scenarioItem.create({
      data: {
        scenarioId,
        itemId: data.itemId,
        parentId: data.parentId ?? undefined,
        quantity: data.quantity || 1,
        marginPctOverride: data.marginPct ?? undefined,
      },
      include: {
        item: true,
        children: { include: { item: true } },
      },
    });
  }

  /**
   * Actualiza un ítem dentro de un escenario.
   */
  async updateScenarioItem(id: string, data: UpdateScenarioItemDto, user: AuthenticatedUser) {
    const scenarioItem = await this.prisma.scenarioItem.findUnique({ where: { id } });
    if (!scenarioItem) throw new NotFoundException('Ítem de escenario no encontrado.');
    await this.verifyScenarioOwnership(scenarioItem.scenarioId, user);
    return this.prisma.scenarioItem.update({
      where: { id },
      data: {
        quantity: data.quantity,
        marginPctOverride: data.marginPct,
        isDilpidate: data.isDilpidate,
      }
    });
  }

  /**
   * Elimina un ítem específico de un escenario.
   */
  async removeScenarioItem(id: string, user: AuthenticatedUser) {
    const scenarioItem = await this.prisma.scenarioItem.findUnique({ where: { id } });
    if (!scenarioItem) throw new NotFoundException('Ítem de escenario no encontrado.');
    await this.verifyScenarioOwnership(scenarioItem.scenarioId, user);
    // Cascade: delete children first, then the item itself
    await this.prisma.scenarioItem.deleteMany({ where: { parentId: id } });
    return this.prisma.scenarioItem.delete({ where: { id } });
  }

  /**
   * Aplica un margen global a todos los ítems de un escenario específico.
   * Esto sobreescribe cualquier margen individual previo.
   */
  async applyMarginToEntireScenario(scenarioId: string, marginPct: number, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(scenarioId, user);
    return this.prisma.scenarioItem.updateMany({
      where: { scenarioId },
      data: {
        marginPctOverride: marginPct
      }
    });
  }
}
```

- `createScenario` → includes `conversionTrm`
- `updateScenario` → includes `conversionTrm`
- `cloneScenario` → copies `conversionTrm`

---

## PARTE 2 — Pricing Engine

### [pricing-engine.ts](file:///d:/novotechflow/apps/web/src/lib/pricing-engine.ts)

```diff:pricing-engine.ts
// ──────────────────────────────────────────────────────────
// Pricing Engine — Single source of truth for financial calcs
// Pure functions, zero React/state dependencies
// ──────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────
export const IVA_RATE = 0.19;
export const MAX_MARGIN = 100;

// ── Types ────────────────────────────────────────────────
export interface PricingItem {
    unitCost: number;
    internalCosts?: { fletePct?: number | string };
    marginPct: number;
    isTaxable: boolean;
}

export interface PricingScenarioItem {
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: PricingItem;
    children?: PricingScenarioItem[];
}

export interface ScenarioTotals {
    beforeVat: number;
    nonTaxed: number;
    subtotal: number;
    vat: number;
    total: number;
    globalMarginPct: number;
}

// ── Pure calculation functions ───────────────────────────

/**
 * Landed cost of a parent item = unitCost × (1 + fletePct / 100)
 */
export function calculateParentLandedCost(unitCost: number, fletePct: number): number {
    return unitCost * (1 + fletePct / 100);
}

/**
 * Sum of (childLanded × childQuantity) across all children.
 * Returns the TOTAL children cost (not per-parent-unit).
 */
export function calculateChildrenCostPerUnit(children: PricingScenarioItem[]): number {
    let total = 0;
    for (const child of children) {
        const cCost = Number(child.item.unitCost);
        const cFlete = Number(child.item.internalCosts?.fletePct || 0);
        total += cCost * (1 + cFlete / 100) * child.quantity;
    }
    return total;
}

/**
 * Base landed cost per parent unit = parentLanded + (childrenTotal / parentQuantity)
 */
export function calculateBaseLandedCost(
    parentLandedCost: number,
    childrenCostPerUnit: number,
    quantity: number,
): number {
    return parentLandedCost + (childrenCostPerUnit / quantity);
}

/**
 * Total cost of all diluted items: Σ(unitCost × quantity) for isDilpidate=true.
 */
export function calculateTotalDilutedCost(items: PricingScenarioItem[]): number {
    let total = 0;
    for (const si of items) {
        if (si.isDilpidate) {
            total += Number(si.item.unitCost) * si.quantity;
        }
    }
    return total;
}

/**
 * Total normal subtotal: Σ(unitCost × quantity) for isDilpidate=false.
 * Used as the weight denominator for dilution distribution.
 */
export function calculateTotalNormalSubtotal(items: PricingScenarioItem[]): number {
    let total = 0;
    for (const si of items) {
        if (!si.isDilpidate) {
            total += Number(si.item.unitCost) * si.quantity;
        }
    }
    return total;
}

/**
 * Dilution share per unit for a normal item, based on weight-proportional distribution.
 * Weight = (itemCost × itemQuantity) / totalNormalSubtotal
 * dilutionPerUnit = (weight × totalDilutedCost) / itemQuantity
 */
export function calculateDilutionPerUnit(
    itemCost: number,
    itemQuantity: number,
    totalNormalSubtotal: number,
    totalDilutedCost: number,
): number {
    if (totalNormalSubtotal <= 0 || totalDilutedCost <= 0 || itemQuantity <= 0) return 0;
    const itemWeight = (itemCost * itemQuantity) / totalNormalSubtotal;
    return (itemWeight * totalDilutedCost) / itemQuantity;
}

/**
 * Effective landed cost = baseLandedCost + dilutionPerUnit
 */
export function calculateEffectiveLandedCost(
    baseLandedCost: number,
    dilutionPerUnit: number,
): number {
    return baseLandedCost + dilutionPerUnit;
}

/**
 * Resolve the effective margin for a scenario item.
 * Override takes priority unless null/undefined. Always returns a number.
 */
export function resolveMargin(
    marginPctOverride: number | string | null | undefined,
    itemMarginPct: number | string,
): number {
    const override = marginPctOverride ?? undefined;
    return override !== undefined ? Number(override) : Number(itemMarginPct);
}

/**
 * Unit sale price = effectiveLandedCost / (1 - margin/100).
 * Returns 0 if margin >= MAX_MARGIN (avoids division by zero or negative price).
 */
export function calculateUnitPrice(effectiveLandedCost: number, margin: number): number {
    if (margin >= MAX_MARGIN) return 0;
    return effectiveLandedCost / (1 - margin / 100);
}

/**
 * Line total = unitPrice × quantity.
 */
export function calculateLineTotal(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
}

/**
 * Inverse calculation: derive margin from a given sale price.
 * margin = ((unitPrice - effectiveLandedCost) / unitPrice) × 100
 */
export function calculateMarginFromPrice(
    unitPrice: number,
    effectiveLandedCost: number,
): number {
    if (unitPrice <= 0) return 0;
    return ((unitPrice - effectiveLandedCost) / unitPrice) * 100;
}

// ── Display values for a single item ─────────────────────

export interface ItemDisplayValues {
    parentLandedCost: number;
    childrenCostPerUnit: number;
    baseLandedCost: number;
    dilutionPerUnit: number;
    effectiveLandedCost: number;
    margin: number;
    unitPrice: number;
    lineTotal: number;
}

/**
 * Computes all display values for a single scenario item,
 * considering the full list of items for dilution distribution.
 */
export function calculateItemDisplayValues(
    si: PricingScenarioItem,
    allItems: PricingScenarioItem[],
): ItemDisplayValues {
    const cost = Number(si.item.unitCost);
    const flete = Number(si.item.internalCosts?.fletePct || 0);
    const parentLanded = calculateParentLandedCost(cost, flete);

    const children = si.children || [];
    const childrenCost = calculateChildrenCostPerUnit(children);
    const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

    // Dilution (only for non-diluted items)
    let dilution = 0;
    if (!si.isDilpidate) {
        const totalDilutedCost = calculateTotalDilutedCost(allItems);
        const totalNormalSub = calculateTotalNormalSubtotal(allItems);
        dilution = calculateDilutionPerUnit(cost, si.quantity, totalNormalSub, totalDilutedCost);

        // ── DEBUG (temporary) ──────────────────────────────────
        console.log(`[PRICING-ENGINE DEBUG] item="${si.item.unitCost}" qty=${si.quantity} isDilpidate=${si.isDilpidate}`);
        console.log(`  raw types → unitCost=${typeof si.item.unitCost}, marginPct=${typeof si.item.marginPct}, marginPctOverride=${typeof si.marginPctOverride} val=${si.marginPctOverride}`);
        console.log(`  cost=${cost}, flete=${flete}`);
        console.log(`  parentLandedCost=${parentLanded}`);
        console.log(`  childrenCostPerUnit=${childrenCost}, baseLandedCost=${baseLanded}`);
        console.log(`  totalDilutedCost=${totalDilutedCost}, totalNormalSubtotal=${totalNormalSub}`);
        console.log(`  dilutionPerUnit=${dilution}`);
        // ── END DEBUG ──────────────────────────────────────────
    }

    const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
    const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);

    let unitPrice = 0;
    if (!si.isDilpidate) {
        unitPrice = calculateUnitPrice(effectiveLanded, margin);
    }

    const lineTotal = calculateLineTotal(unitPrice, si.quantity);

    // ── DEBUG (temporary) ──────────────────────────────────
    console.log(`  effectiveLandedCost=${effectiveLanded}`);
    console.log(`  margin=${margin} (override=${si.marginPctOverride}, item=${si.item.marginPct})`);
    console.log(`  unitPrice=${unitPrice}, lineTotal=${lineTotal}`);
    console.log(`  ─────────────────────────────`);
    // ── END DEBUG ──────────────────────────────────────────

    return {
        parentLandedCost: parentLanded,
        childrenCostPerUnit: childrenCost,
        baseLandedCost: baseLanded,
        dilutionPerUnit: dilution,
        effectiveLandedCost: effectiveLanded,
        margin,
        unitPrice,
        lineTotal,
    };
}

// ── Scenario-level totals ────────────────────────────────

/**
 * Calculate full financial totals for a scenario.
 * Includes dilution, taxable/non-taxable split, IVA, and global margin.
 */
export function calculateScenarioTotals(scenarioItems: PricingScenarioItem[]): ScenarioTotals {
    let beforeVat = 0;
    let nonTaxed = 0;
    let totalCost = 0;

    // Pre-compute dilution aggregates
    const totalDilutedCost = calculateTotalDilutedCost(scenarioItems);
    const totalNormalSubtotal = calculateTotalNormalSubtotal(scenarioItems);

    const normalItems = scenarioItems.filter(si => !si.isDilpidate);

    for (const si of normalItems) {
        const cost = Number(si.item.unitCost);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);

        const children = si.children || [];
        const childrenCost = calculateChildrenCostPerUnit(children);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        const dilution = calculateDilutionPerUnit(
            cost, si.quantity, totalNormalSubtotal, totalDilutedCost,
        );
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);

        const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
        const unitPrice = calculateUnitPrice(effectiveLanded, margin);
        const lineTotal = calculateLineTotal(unitPrice, si.quantity);

        totalCost += effectiveLanded * si.quantity;

        if (si.item.isTaxable) {
            beforeVat += lineTotal;
        } else {
            nonTaxed += lineTotal;
        }
    }

    const totalPrice = beforeVat + nonTaxed;
    const globalMarginPct = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;
    const subtotal = beforeVat + nonTaxed;
    const vat = beforeVat * IVA_RATE;
    const total = beforeVat + vat + nonTaxed;

    return { beforeVat, nonTaxed, subtotal, vat, total, globalMarginPct };
}
===
// ──────────────────────────────────────────────────────────
// Pricing Engine — Single source of truth for financial calcs
// Pure functions, zero React/state dependencies
// ──────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────
export const IVA_RATE = 0.19;
export const MAX_MARGIN = 100;

/**
 * Convierte un costo de una moneda a otra usando la TRM.
 * Si las monedas son iguales o no hay TRM, retorna el costo sin cambios.
 */
export function convertCost(
    unitCost: number,
    itemCurrency: string,
    scenarioCurrency: string,
    trm: number | null | undefined,
): number {
    if (itemCurrency === scenarioCurrency || !trm || trm <= 0) return unitCost;
    if (itemCurrency === 'USD' && scenarioCurrency === 'COP') return unitCost * trm;
    if (itemCurrency === 'COP' && scenarioCurrency === 'USD') return unitCost / trm;
    return unitCost;
}

// ── Types ────────────────────────────────────────────────
export interface PricingItem {
    unitCost: number;
    costCurrency?: string;
    internalCosts?: { fletePct?: number | string };
    marginPct: number;
    isTaxable: boolean;
}

export interface PricingScenarioItem {
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: PricingItem;
    children?: PricingScenarioItem[];
}

export interface ScenarioTotals {
    beforeVat: number;
    nonTaxed: number;
    subtotal: number;
    vat: number;
    total: number;
    globalMarginPct: number;
}

// ── Pure calculation functions ───────────────────────────

/**
 * Landed cost of a parent item = unitCost × (1 + fletePct / 100)
 */
export function calculateParentLandedCost(unitCost: number, fletePct: number): number {
    return unitCost * (1 + fletePct / 100);
}

/**
 * Sum of (childLanded × childQuantity) across all children.
 * Returns the TOTAL children cost (not per-parent-unit).
 */
export function calculateChildrenCostPerUnit(
    children: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const child of children) {
        const rawCost = Number(child.item.unitCost);
        const cCost = convertCost(rawCost, child.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
        const cFlete = Number(child.item.internalCosts?.fletePct || 0);
        total += cCost * (1 + cFlete / 100) * child.quantity;
    }
    return total;
}

/**
 * Base landed cost per parent unit = parentLanded + (childrenTotal / parentQuantity)
 */
export function calculateBaseLandedCost(
    parentLandedCost: number,
    childrenCostPerUnit: number,
    quantity: number,
): number {
    return parentLandedCost + (childrenCostPerUnit / quantity);
}

/**
 * Total cost of all diluted items: Σ(unitCost × quantity) for isDilpidate=true.
 */
export function calculateTotalDilutedCost(
    items: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const si of items) {
        if (si.isDilpidate) {
            const rawCost = Number(si.item.unitCost);
            const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
            total += cost * si.quantity;
        }
    }
    return total;
}

/**
 * Total normal subtotal: Σ(unitCost × quantity) for isDilpidate=false.
 * Used as the weight denominator for dilution distribution.
 */
export function calculateTotalNormalSubtotal(
    items: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): number {
    let total = 0;
    for (const si of items) {
        if (!si.isDilpidate) {
            const rawCost = Number(si.item.unitCost);
            const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
            total += cost * si.quantity;
        }
    }
    return total;
}

/**
 * Dilution share per unit for a normal item, based on weight-proportional distribution.
 * Weight = (itemCost × itemQuantity) / totalNormalSubtotal
 * dilutionPerUnit = (weight × totalDilutedCost) / itemQuantity
 */
export function calculateDilutionPerUnit(
    itemCost: number,
    itemQuantity: number,
    totalNormalSubtotal: number,
    totalDilutedCost: number,
): number {
    if (totalNormalSubtotal <= 0 || totalDilutedCost <= 0 || itemQuantity <= 0) return 0;
    const itemWeight = (itemCost * itemQuantity) / totalNormalSubtotal;
    return (itemWeight * totalDilutedCost) / itemQuantity;
}

/**
 * Effective landed cost = baseLandedCost + dilutionPerUnit
 */
export function calculateEffectiveLandedCost(
    baseLandedCost: number,
    dilutionPerUnit: number,
): number {
    return baseLandedCost + dilutionPerUnit;
}

/**
 * Resolve the effective margin for a scenario item.
 * Override takes priority unless null/undefined. Always returns a number.
 */
export function resolveMargin(
    marginPctOverride: number | string | null | undefined,
    itemMarginPct: number | string,
): number {
    const override = marginPctOverride ?? undefined;
    return override !== undefined ? Number(override) : Number(itemMarginPct);
}

/**
 * Unit sale price = effectiveLandedCost / (1 - margin/100).
 * Returns 0 if margin >= MAX_MARGIN (avoids division by zero or negative price).
 */
export function calculateUnitPrice(effectiveLandedCost: number, margin: number): number {
    if (margin >= MAX_MARGIN) return 0;
    return effectiveLandedCost / (1 - margin / 100);
}

/**
 * Line total = unitPrice × quantity.
 */
export function calculateLineTotal(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
}

/**
 * Inverse calculation: derive margin from a given sale price.
 * margin = ((unitPrice - effectiveLandedCost) / unitPrice) × 100
 */
export function calculateMarginFromPrice(
    unitPrice: number,
    effectiveLandedCost: number,
): number {
    if (unitPrice <= 0) return 0;
    return ((unitPrice - effectiveLandedCost) / unitPrice) * 100;
}

// ── Display values for a single item ─────────────────────

export interface ItemDisplayValues {
    parentLandedCost: number;
    childrenCostPerUnit: number;
    baseLandedCost: number;
    dilutionPerUnit: number;
    effectiveLandedCost: number;
    margin: number;
    unitPrice: number;
    lineTotal: number;
}

/**
 * Computes all display values for a single scenario item,
 * considering the full list of items for dilution distribution.
 */
export function calculateItemDisplayValues(
    si: PricingScenarioItem,
    allItems: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): ItemDisplayValues {
    const rawCost = Number(si.item.unitCost);
    const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
    const flete = Number(si.item.internalCosts?.fletePct || 0);
    const parentLanded = calculateParentLandedCost(cost, flete);

    const children = si.children || [];
    const childrenCost = calculateChildrenCostPerUnit(children, scenarioCurrency, conversionTrm);
    const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

    // Dilution (only for non-diluted items)
    let dilution = 0;
    if (!si.isDilpidate) {
        const totalDilutedCost = calculateTotalDilutedCost(allItems, scenarioCurrency, conversionTrm);
        const totalNormalSub = calculateTotalNormalSubtotal(allItems, scenarioCurrency, conversionTrm);
        dilution = calculateDilutionPerUnit(cost, si.quantity, totalNormalSub, totalDilutedCost);
    }

    const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
    const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);

    let unitPrice = 0;
    if (!si.isDilpidate) {
        unitPrice = calculateUnitPrice(effectiveLanded, margin);
    }

    const lineTotal = calculateLineTotal(unitPrice, si.quantity);

    return {
        parentLandedCost: parentLanded,
        childrenCostPerUnit: childrenCost,
        baseLandedCost: baseLanded,
        dilutionPerUnit: dilution,
        effectiveLandedCost: effectiveLanded,
        margin,
        unitPrice,
        lineTotal,
    };
}

// ── Scenario-level totals ────────────────────────────────

/**
 * Calculate full financial totals for a scenario.
 * Includes dilution, taxable/non-taxable split, IVA, and global margin.
 */
export function calculateScenarioTotals(
    scenarioItems: PricingScenarioItem[],
    scenarioCurrency?: string,
    conversionTrm?: number | null,
): ScenarioTotals {
    let beforeVat = 0;
    let nonTaxed = 0;
    let totalCost = 0;

    // Pre-compute dilution aggregates
    const totalDilutedCost = calculateTotalDilutedCost(scenarioItems, scenarioCurrency, conversionTrm);
    const totalNormalSubtotal = calculateTotalNormalSubtotal(scenarioItems, scenarioCurrency, conversionTrm);

    const normalItems = scenarioItems.filter(si => !si.isDilpidate);

    for (const si of normalItems) {
        const rawCost = Number(si.item.unitCost);
        const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenarioCurrency || 'COP', conversionTrm);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);

        const children = si.children || [];
        const childrenCost = calculateChildrenCostPerUnit(children, scenarioCurrency, conversionTrm);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        const dilution = calculateDilutionPerUnit(
            cost, si.quantity, totalNormalSubtotal, totalDilutedCost,
        );
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);

        const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
        const unitPrice = calculateUnitPrice(effectiveLanded, margin);
        const lineTotal = calculateLineTotal(unitPrice, si.quantity);

        totalCost += effectiveLanded * si.quantity;

        if (si.item.isTaxable) {
            beforeVat += lineTotal;
        } else {
            nonTaxed += lineTotal;
        }
    }

    const totalPrice = beforeVat + nonTaxed;
    const globalMarginPct = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;
    const subtotal = beforeVat + nonTaxed;
    const vat = beforeVat * IVA_RATE;
    const total = beforeVat + vat + nonTaxed;

    return { beforeVat, nonTaxed, subtotal, vat, total, globalMarginPct };
}
```

**New function:**
- `convertCost(unitCost, itemCurrency, scenarioCurrency, trm)` — converts USD↔COP using TRM

**Modified interfaces:**
- `PricingItem` — added `costCurrency?: string`

**Modified functions (all now accept `scenarioCurrency?`, `conversionTrm?`):**
- `calculateChildrenCostPerUnit` — converts child costs before summing
- `calculateTotalDilutedCost` — converts diluted item costs
- `calculateTotalNormalSubtotal` — converts normal item costs
- `calculateItemDisplayValues` — converts before landed cost calculation
- `calculateScenarioTotals` — converts before aggregation

**Bonus:** Removed all `console.log` DEBUG blocks that were left from previous development.

---

## PARTE 3 — Frontend

### [types.ts](file:///d:/novotechflow/apps/web/src/lib/types.ts)

```diff:types.ts
// ──────────────────────────────────────────────────────────
// Tipos compartidos del dominio NovoTechFlow
// Todas las interfaces que atraviesan múltiples módulos/páginas
// ──────────────────────────────────────────────────────────

/** Roles de usuario en el sistema. */
export type UserRole = 'ADMIN' | 'COMMERCIAL';

/** Posibles estados de una propuesta. */
export type ProposalStatus = 'ELABORACION' | 'PROPUESTA' | 'GANADA' | 'PERDIDA' | 'PENDIENTE_FACTURAR' | 'FACTURADA';

/** Tipos de adquisición. */
export type AcquisitionType = 'VENTA' | 'DAAS';

/** Categorías de ítems permitidas. */
export type ItemType = 'PCS' | 'ACCESSORIES' | 'PC_SERVICES' | 'SOFTWARE' | 'INFRASTRUCTURE' | 'INFRA_SERVICES';

// ──────────────────────────────────────────────────────────
// Entidades del dominio
// ──────────────────────────────────────────────────────────

/** Usuario autenticado (payload mínimo del JWT/store). */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    nomenclature: string;
    signatureUrl?: string;
}

/** Resumen de propuesta (listado / Dashboard). */
export interface ProposalSummary {
    id: string;
    proposalCode: string;
    clientName: string;
    subject: string;
    issueDate: string;
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    scenarios?: Array<{
        id: string;
        name: string;
        currency: string;
        scenarioItems: Array<{
            id: string;
            itemId: string;
            quantity: number;
            marginPctOverride?: number;
            item: ProposalItemFromApi;
            children?: Array<{
                id: string;
                itemId: string;
                quantity: number;
                item: ProposalItemFromApi;
            }>;
        }>;
    }>;
}

/** Ficha técnica genérica de un ítem (PCs, Software, Infra, etc.). */
export interface TechnicalSpecs {
    formato?: string;
    fabricante?: string;
    modelo?: string;
    procesador?: string;
    sistemaOperativo?: string;
    graficos?: string;
    memoriaRam?: string;
    almacenamiento?: string;
    pantalla?: string;
    network?: string;
    seguridad?: string;
    garantiaBateria?: string;
    garantiaEquipo?: string;
    tipo?: string;
    garantia?: string;
    responsable?: string;
    unidadMedida?: string;
}

/** Costos internos asociados a un ítem. */
export interface InternalCosts {
    proveedor?: string;
    fletePct?: number | string;
}

/** Ítem dentro de una propuesta (edición completa). */
export interface ProposalItem {
    id?: string;
    itemType: ItemType;
    name: string;
    description: string;
    brand: string;
    partNumber: string;
    quantity: number | string;
    unitCost: number | string;
    marginPct: number | string;
    unitPrice: number | string;
    technicalSpecs?: TechnicalSpecs;
    isTaxable?: boolean;
    internalCosts?: InternalCosts;
}

/** Ítem de propuesta tal como llega del backend (campos numéricos como number). */
export interface ProposalItemFromApi {
    id: string;
    name: string;
    itemType: string;
    brand: string;
    partNumber?: string;
    unitCost: number;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    internalCosts?: InternalCosts;
    technicalSpecs?: TechnicalSpecs;
}

/** Propuesta completa (detalle / edición). */
export interface ProposalDetail {
    id: string;
    proposalCode: string;
    clientName: string;
    subject: string;
    issueDate: string;
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
    proposalItems: ProposalItemFromApi[];
    user?: { name: string; nomenclature: string };
}

// ──────────────────────────────────────────────────────────
// Escenarios
// ──────────────────────────────────────────────────────────

/** Ítem vinculado a un escenario con posibles overrides. */
export interface ScenarioItem {
    id?: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: ProposalItemFromApi;
    children?: ScenarioItem[];
}

/** Escenario de cálculos financieros. */
export interface Scenario {
    id: string;
    name: string;
    currency: string;
    description?: string;
    scenarioItems: ScenarioItem[];
}

/** Totales calculados para un escenario. */
export interface ScenarioTotals {
    beforeVat: number;
    nonTaxed: number;
    subtotal: number;
    vat: number;
    total: number;
    globalMarginPct: number;
}

// ──────────────────────────────────────────────────────────
// TRM
// ──────────────────────────────────────────────────────────

/** Datos de la TRM oficial (dolarapi). */
export interface TrmData {
    valor: number;
    fechaActualizacion: string;
}

/** Datos extra de TRM (SET-ICAP / Wilkinson). */
export interface ExtraTrmData {
    setIcapAverage: number | null;
    wilkinsonSpot: number | null;
}

// ──────────────────────────────────────────────────────────
// Proyecciones de Facturación
// ──────────────────────────────────────────────────────────

/** Entrada de proyección de facturación (no es una propuesta completa). */
export interface BillingProjection {
    id: string;
    projectionCode: string;
    clientName: string;
    subtotal: number | string;
    currency?: string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    createdAt: string;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
}

===
// ──────────────────────────────────────────────────────────
// Tipos compartidos del dominio NovoTechFlow
// Todas las interfaces que atraviesan múltiples módulos/páginas
// ──────────────────────────────────────────────────────────

/** Roles de usuario en el sistema. */
export type UserRole = 'ADMIN' | 'COMMERCIAL';

/** Posibles estados de una propuesta. */
export type ProposalStatus = 'ELABORACION' | 'PROPUESTA' | 'GANADA' | 'PERDIDA' | 'PENDIENTE_FACTURAR' | 'FACTURADA';

/** Tipos de adquisición. */
export type AcquisitionType = 'VENTA' | 'DAAS';

/** Categorías de ítems permitidas. */
export type ItemType = 'PCS' | 'ACCESSORIES' | 'PC_SERVICES' | 'SOFTWARE' | 'INFRASTRUCTURE' | 'INFRA_SERVICES';

// ──────────────────────────────────────────────────────────
// Entidades del dominio
// ──────────────────────────────────────────────────────────

/** Usuario autenticado (payload mínimo del JWT/store). */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    nomenclature: string;
    signatureUrl?: string;
}

/** Resumen de propuesta (listado / Dashboard). */
export interface ProposalSummary {
    id: string;
    proposalCode: string;
    clientName: string;
    subject: string;
    issueDate: string;
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    scenarios?: Array<{
        id: string;
        name: string;
        currency: string;
        conversionTrm?: number | null;
        scenarioItems: Array<{
            id: string;
            itemId: string;
            quantity: number;
            marginPctOverride?: number;
            item: ProposalItemFromApi;
            children?: Array<{
                id: string;
                itemId: string;
                quantity: number;
                item: ProposalItemFromApi;
            }>;
        }>;
    }>;
}

/** Ficha técnica genérica de un ítem (PCs, Software, Infra, etc.). */
export interface TechnicalSpecs {
    formato?: string;
    fabricante?: string;
    modelo?: string;
    procesador?: string;
    sistemaOperativo?: string;
    graficos?: string;
    memoriaRam?: string;
    almacenamiento?: string;
    pantalla?: string;
    network?: string;
    seguridad?: string;
    garantiaBateria?: string;
    garantiaEquipo?: string;
    tipo?: string;
    garantia?: string;
    responsable?: string;
    unidadMedida?: string;
}

/** Costos internos asociados a un ítem. */
export interface InternalCosts {
    proveedor?: string;
    fletePct?: number | string;
}

/** Ítem dentro de una propuesta (edición completa). */
export interface ProposalItem {
    id?: string;
    itemType: ItemType;
    name: string;
    description: string;
    brand: string;
    partNumber: string;
    quantity: number | string;
    unitCost: number | string;
    costCurrency?: string;
    marginPct: number | string;
    unitPrice: number | string;
    technicalSpecs?: TechnicalSpecs;
    isTaxable?: boolean;
    internalCosts?: InternalCosts;
}

/** Ítem de propuesta tal como llega del backend (campos numéricos como number). */
export interface ProposalItemFromApi {
    id: string;
    name: string;
    itemType: string;
    brand: string;
    partNumber?: string;
    unitCost: number;
    costCurrency?: string;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    internalCosts?: InternalCosts;
    technicalSpecs?: TechnicalSpecs;
}

/** Propuesta completa (detalle / edición). */
export interface ProposalDetail {
    id: string;
    proposalCode: string;
    clientName: string;
    subject: string;
    issueDate: string;
    validityDays: number;
    validityDate: string;
    status: ProposalStatus;
    proposalItems: ProposalItemFromApi[];
    user?: { name: string; nomenclature: string };
}

// ──────────────────────────────────────────────────────────
// Escenarios
// ──────────────────────────────────────────────────────────

/** Ítem vinculado a un escenario con posibles overrides. */
export interface ScenarioItem {
    id?: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number | null;
    isDilpidate?: boolean;
    item: ProposalItemFromApi;
    children?: ScenarioItem[];
}

/** Escenario de cálculos financieros. */
export interface Scenario {
    id: string;
    name: string;
    currency: string;
    conversionTrm?: number | null;
    description?: string;
    scenarioItems: ScenarioItem[];
}

/** Totales calculados para un escenario. */
export interface ScenarioTotals {
    beforeVat: number;
    nonTaxed: number;
    subtotal: number;
    vat: number;
    total: number;
    globalMarginPct: number;
}

// ──────────────────────────────────────────────────────────
// TRM
// ──────────────────────────────────────────────────────────

/** Datos de la TRM oficial (dolarapi). */
export interface TrmData {
    valor: number;
    fechaActualizacion: string;
}

/** Datos extra de TRM (SET-ICAP / Wilkinson). */
export interface ExtraTrmData {
    setIcapAverage: number | null;
    wilkinsonSpot: number | null;
}

// ──────────────────────────────────────────────────────────
// Proyecciones de Facturación
// ──────────────────────────────────────────────────────────

/** Entrada de proyección de facturación (no es una propuesta completa). */
export interface BillingProjection {
    id: string;
    projectionCode: string;
    clientName: string;
    subtotal: number | string;
    currency?: string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    createdAt: string;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
}

```

- `ProposalItem` — added `costCurrency?: string`
- `ProposalItemFromApi` — added `costCurrency?: string`
- `ProposalSummary.scenarios[]` — added `conversionTrm?: number | null`
- `Scenario` — added `conversionTrm?: number | null`

### [useProposalBuilder.ts](file:///d:/novotechflow/apps/web/src/hooks/useProposalBuilder.ts)

```diff:useProposalBuilder.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ProposalItem, ProposalDetail } from '../lib/types';
import { MAYORISTA_FLETE_PCT, PROVEEDOR_MAYORISTA } from '../lib/constants';

/** Estado y lógica del builder de propuestas (carga de datos + CRUD de items). */
export function useProposalBuilder(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [catalogs, setCatalogs] = useState<Record<string, string[]>>({});
    const [proposal, setProposal] = useState<ProposalDetail | null>(null);
    const [items, setItems] = useState<ProposalItem[]>([]);

    const initialItemForm: ProposalItem = {
        itemType: 'PCS',
        name: '',
        description: '',
        brand: '',
        partNumber: '',
        quantity: 1,
        unitCost: '',
        marginPct: 20,
        unitPrice: '',
        technicalSpecs: {},
        isTaxable: true,
        internalCosts: {
            proveedor: PROVEEDOR_MAYORISTA,
            fletePct: MAYORISTA_FLETE_PCT,
        },
    };

    const loadProposalData = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${proposalId}`);
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];
            setProposal(data);
            setItems(data.proposalItems || []);
        } catch (error) {
            console.error(error);
            alert('No se pudo cargar la propuesta');
        } finally {
            setLoading(false);
        }
    }, [proposalId]);

    const loadCatalogs = useCallback(async () => {
        try {
            const res = await api.get('/catalogs/pc-specs');
            setCatalogs(res.data);
        } catch (error) {
            console.error('Error cargando catálogos', error);
        }
    }, []);

    useEffect(() => {
        loadProposalData();
        loadCatalogs();
    }, [loadProposalData, loadCatalogs]);

    /** Guardar/actualizar un item (POST si nuevo, PATCH si edición). */
    const saveItem = async (itemForm: ProposalItem, editingItemId: string | null) => {
        setSaving(true);
        try {
            // Normalizar tipos: los inputs HTML siempre devuelven strings,
            // pero el backend DTO espera números.
            // Only send fields accepted by CreateProposalItemDto / UpdateProposalItemDto
            const payload = {
                itemType: itemForm.itemType,
                name: itemForm.name,
                description: itemForm.description,
                brand: itemForm.brand,
                partNumber: itemForm.partNumber,
                quantity: Number(itemForm.quantity) || 1,
                unitCost: Number(itemForm.unitCost) || 0,
                marginPct: Number(itemForm.marginPct) || 0,
                unitPrice: Number(itemForm.unitPrice) || 0,
                isTaxable: itemForm.isTaxable,
                technicalSpecs: itemForm.technicalSpecs,
                internalCosts: itemForm.internalCosts,
            };

            if (editingItemId) {
                const res = await api.patch(`/proposals/items/${editingItemId}`, payload);
                setItems(prev => prev.map(i => i.id === editingItemId ? res.data : i));
            } else {
                const res = await api.post(`/proposals/${proposalId}/items`, payload);
                setItems(prev => [...prev, res.data]);
            }
            return true;
        } catch (error) {
            console.error(error);
            alert(`Error al ${editingItemId ? 'actualizar' : 'agregar'} artículo.`);
            return false;
        } finally {
            setSaving(false);
        }
    };

    /** Eliminar un item por ID. */
    const deleteItem = async (itemId: string) => {
        if (!window.confirm('¿Segura que deseas eliminar este item?')) return;
        try {
            await api.delete(`/proposals/items/${itemId}`);
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el item.');
        }
    };

    /** Actualizar campos de la propuesta (asunto, fechas). */
    const updateProposal = async (data: Partial<ProposalDetail>) => {
        if (!proposal) return;
        setSaving(true);
        try {
            // Only send fields accepted by UpdateProposalDto
            const allowed = [
                'subject', 'issueDate', 'validityDays', 'validityDate',
                'status', 'closeDate', 'billingDate', 'acquisitionType',
            ];
            const cleanData: Record<string, unknown> = {};
            const anyData = data as Record<string, unknown>;
            for (const key of allowed) {
                if (key in anyData) cleanData[key] = anyData[key];
            }
            await api.patch(`/proposals/${proposalId}`, cleanData);
        } catch (error) {
            console.error(error);
            alert('Error al actualizar la propuesta.');
        } finally {
            setSaving(false);
        }
    };

    return {
        loading,
        saving,
        catalogs,
        proposal,
        setProposal,
        items,
        initialItemForm,
        saveItem,
        deleteItem,
        updateProposal,
    };
}
===
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ProposalItem, ProposalDetail } from '../lib/types';
import { MAYORISTA_FLETE_PCT, PROVEEDOR_MAYORISTA } from '../lib/constants';

/** Estado y lógica del builder de propuestas (carga de datos + CRUD de items). */
export function useProposalBuilder(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [catalogs, setCatalogs] = useState<Record<string, string[]>>({});
    const [proposal, setProposal] = useState<ProposalDetail | null>(null);
    const [items, setItems] = useState<ProposalItem[]>([]);

    const initialItemForm: ProposalItem = {
        itemType: 'PCS',
        name: '',
        description: '',
        brand: '',
        partNumber: '',
        quantity: 1,
        unitCost: '',
        costCurrency: 'COP',
        marginPct: 20,
        unitPrice: '',
        technicalSpecs: {},
        isTaxable: true,
        internalCosts: {
            proveedor: PROVEEDOR_MAYORISTA,
            fletePct: MAYORISTA_FLETE_PCT,
        },
    };

    const loadProposalData = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${proposalId}`);
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];
            setProposal(data);
            setItems(data.proposalItems || []);
        } catch (error) {
            console.error(error);
            alert('No se pudo cargar la propuesta');
        } finally {
            setLoading(false);
        }
    }, [proposalId]);

    const loadCatalogs = useCallback(async () => {
        try {
            const res = await api.get('/catalogs/pc-specs');
            setCatalogs(res.data);
        } catch (error) {
            console.error('Error cargando catálogos', error);
        }
    }, []);

    useEffect(() => {
        loadProposalData();
        loadCatalogs();
    }, [loadProposalData, loadCatalogs]);

    /** Guardar/actualizar un item (POST si nuevo, PATCH si edición). */
    const saveItem = async (itemForm: ProposalItem, editingItemId: string | null) => {
        setSaving(true);
        try {
            // Normalizar tipos: los inputs HTML siempre devuelven strings,
            // pero el backend DTO espera números.
            // Only send fields accepted by CreateProposalItemDto / UpdateProposalItemDto
            const payload = {
                itemType: itemForm.itemType,
                name: itemForm.name,
                description: itemForm.description,
                brand: itemForm.brand,
                partNumber: itemForm.partNumber,
                quantity: Number(itemForm.quantity) || 1,
                unitCost: Number(itemForm.unitCost) || 0,
                costCurrency: itemForm.costCurrency || 'COP',
                marginPct: Number(itemForm.marginPct) || 0,
                unitPrice: Number(itemForm.unitPrice) || 0,
                isTaxable: itemForm.isTaxable,
                technicalSpecs: itemForm.technicalSpecs,
                internalCosts: itemForm.internalCosts,
            };

            if (editingItemId) {
                const res = await api.patch(`/proposals/items/${editingItemId}`, payload);
                setItems(prev => prev.map(i => i.id === editingItemId ? res.data : i));
            } else {
                const res = await api.post(`/proposals/${proposalId}/items`, payload);
                setItems(prev => [...prev, res.data]);
            }
            return true;
        } catch (error) {
            console.error(error);
            alert(`Error al ${editingItemId ? 'actualizar' : 'agregar'} artículo.`);
            return false;
        } finally {
            setSaving(false);
        }
    };

    /** Eliminar un item por ID. */
    const deleteItem = async (itemId: string) => {
        if (!window.confirm('¿Segura que deseas eliminar este item?')) return;
        try {
            await api.delete(`/proposals/items/${itemId}`);
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el item.');
        }
    };

    /** Actualizar campos de la propuesta (asunto, fechas). */
    const updateProposal = async (data: Partial<ProposalDetail>) => {
        if (!proposal) return;
        setSaving(true);
        try {
            // Only send fields accepted by UpdateProposalDto
            const allowed = [
                'subject', 'issueDate', 'validityDays', 'validityDate',
                'status', 'closeDate', 'billingDate', 'acquisitionType',
            ];
            const cleanData: Record<string, unknown> = {};
            const anyData = data as Record<string, unknown>;
            for (const key of allowed) {
                if (key in anyData) cleanData[key] = anyData[key];
            }
            await api.patch(`/proposals/${proposalId}`, cleanData);
        } catch (error) {
            console.error(error);
            alert('Error al actualizar la propuesta.');
        } finally {
            setSaving(false);
        }
    };

    return {
        loading,
        saving,
        catalogs,
        proposal,
        setProposal,
        items,
        initialItemForm,
        saveItem,
        deleteItem,
        updateProposal,
    };
}
```

- `initialItemForm` — `costCurrency: 'COP'` default
- `saveItem` payload — includes `costCurrency`

### [ProposalItemsBuilder.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalItemsBuilder.tsx)

```diff:ProposalItemsBuilder.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, Save, Loader2, ArrowRight,
    Plus, Trash2, Lock,
    Calendar, Clock, FileText, ChevronRight, Edit2, Copy,
    Cpu
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProposalItem, ProposalDetail } from '../../lib/types';
import { ITEM_TYPE_LABELS, MAYORISTA_FLETE_PCT, PROVEEDOR_MAYORISTA } from '../../lib/constants';
import SpecFieldsSection from '../../components/proposals/SpecFieldsSection';
import { useProposalBuilder } from '../../hooks/useProposalBuilder';

export default function ProposalItemsBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, catalogs, proposal, setProposal, items,
        initialItemForm, saveItem, deleteItem, updateProposal,
    } = useProposalBuilder(id);

    // UI state
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [itemForm, setItemForm] = useState<ProposalItem>(initialItemForm);

    const handleUpdateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proposal) return;
        await updateProposal({
            subject: proposal.subject,
            issueDate: proposal.issueDate,
            validityDays: proposal.validityDays,
            validityDate: proposal.validityDate,
        });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProposal((prev) => {
            if (!prev) return prev;
            const next = { ...prev, [name]: value } as ProposalDetail & Record<string, unknown>;
            if (name === 'validityDays') {
                const days = parseInt(value, 10) || 0;
                const d = new Date(String(next.issueDate));
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
                next.validityDays = days;
            } else if (name === 'validityDate') {
                const start = new Date(String(next.issueDate));
                const end = new Date(value);
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                next.validityDays = diffDays > 0 ? diffDays : 0;
            } else if (name === 'issueDate') {
                const days = next.validityDays || 0;
                const d = new Date(value);
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
            }
            return next;
        });
    };


    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target;

        // Convertir coma a punto y dejar solo números y un punto
        if (['unitCost', 'marginPct', 'unitPrice', 'internal.fletePct', 'quantity'].includes(name)) {
            value = value.replace(/,/g, '.');
            value = value.replace(/[^\d.]/g, '');
            const parts = value.split('.');
            // Asegurar 1 solo punto
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            // Limitar a 2 decimales (Excepto cantidad que puede ser un entero o ignorar)
            if (name !== 'quantity') {
                const decParts = value.split('.');
                if (decParts.length === 2 && decParts[1].length > 2) {
                    value = decParts[0] + '.' + decParts[1].substring(0, 2);
                }
            }
        }

        setItemForm(prev => {
            let next = { ...prev };
            
            if (name.startsWith('spec.')) {
                const specField = name.split('.')[1];
                next.technicalSpecs = { ...prev.technicalSpecs, [specField]: value };
            } else if (name.startsWith('internal.')) {
                const internalField = name.split('.')[1];


                // Dependencia directa de proveedor a flete
                if (internalField === 'proveedor') {
                    next.internalCosts = { 
                        ...prev.internalCosts, 
                        proveedor: value,
                        fletePct: value === PROVEEDOR_MAYORISTA ? MAYORISTA_FLETE_PCT : 0 
                    };
                } else {
                    next.internalCosts = {
                        ...prev.internalCosts,
                        [internalField]: value
                    };
                }
            } else {
                (next as Record<string, unknown>)[name] = value;
            }

            // Lógica de cálculo automático con Costo Landed (Márgen sobre costo + flete)
            const cost = ['unitCost'].includes(name) ? Number(value) : Number(next.unitCost || 0);
            const margin = ['marginPct'].includes(name) ? Number(value) : Number(next.marginPct || 0);
            
            let fleteValue = Number(next.internalCosts?.fletePct || 0);
            if (name === 'internal.proveedor') {
                fleteValue = value === PROVEEDOR_MAYORISTA ? MAYORISTA_FLETE_PCT : 0;
            } else if (name === 'internal.fletePct') {
                fleteValue = Number(value);
            }
            const flete = fleteValue;
            
            const landedCost = cost * (1 + (flete / 100));

            // Disparar cálculos bidireccionales de manera robusta
            if (name === 'unitCost' || name === 'marginPct' || name === 'internal.fletePct' || name === 'internal.proveedor') {
                if (margin < 100 && landedCost > 0) {
                    const priceVal = landedCost / (1 - (margin / 100));
                    next.unitPrice = priceVal.toFixed(2);
                } else if (landedCost === 0) {
                    next.unitPrice = ''; // En caso de que no haya costo, limpiamos
                }
            } else if (name === 'unitPrice') {
                const price = Number(value);
                if (price > 0 && landedCost > 0) {
                    // Calculamos margen en base a qué tan grande es el precio vs landed cost
                    const marginVal = ((price - landedCost) / price) * 100;
                    next.marginPct = marginVal.toFixed(2);
                } else if (price > 0 && landedCost === 0) {
                    // Si ya le puso precio de venta y no hay costo, el margen teóricamente es 100%
                    next.marginPct = '100.00';
                }
            }

            return next;
        });
    };

    const selectSuggestion = (field: string, value: string) => {
        setItemForm(prev => ({
            ...prev,
            technicalSpecs: {
                ...prev.technicalSpecs,
                [field]: value
            }
        }));
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await saveItem(itemForm, editingItemId);
        if (success) {
            setIsAddingItem(false);
            setEditingItemId(null);
            setItemForm(initialItemForm);
        }
    };

    const editItem = (item: ProposalItem) => {
        setItemForm(item);
        setEditingItemId(item.id || null);
        setIsAddingItem(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const duplicateItem = (item: ProposalItem) => {
        const newItem = { ...item };
        delete newItem.id;
        setItemForm(newItem);
        setEditingItemId(null);
        setIsAddingItem(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    // Se ha removido la totalización por petición del usuario

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            {/* Header del Asistente */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                        <Package className="h-8 w-8 mr-3 text-indigo-600" />
                        Constructor de Propuesta
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Arquitectura de Oferta y Estructura de Costos</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Referencia Única</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* SECCIÓN SUPERIOR: Ajustes y Datos del Cliente (Horizontal) */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
                {/* Info Cliente */}
                <div className="lg:col-span-3 bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Lock className="h-12 w-12" />
                    </div>
                    <div className="space-y-1 relative z-10">
                        <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Cliente / Empresa</p>
                        <p className="text-xl font-black leading-tight tracking-tight">{proposal.clientName}</p>
                        <div className="flex items-center space-x-2 mt-2">
                             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Sesión Activa</span>
                        </div>
                    </div>
                </div>

                {/* Ajustes Horizontales */}
                <div className="lg:col-span-9 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6">
                    <form onSubmit={handleUpdateProposal} className="flex flex-col gap-6">
                        <div className="w-full space-y-2">
                            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                <FileText className="h-3 w-3 mr-1.5" /> Asunto
                            </label>
                            <textarea 
                                name="subject" 
                                value={proposal.subject} 
                                onChange={handleDateChange} 
                                className="block w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 font-bold text-slate-700 min-h-[96px] resize-none leading-relaxed" 
                                placeholder="Especifique el asunto del requerimiento..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3 mr-1.5" /> Emisión
                                </label>
                                <input type="date" name="issueDate" value={proposal.issueDate} onChange={handleDateChange} className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 text-slate-700 font-black min-w-[150px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Clock className="h-3 w-3 mr-1.5" /> Días Validez
                                </label>
                                <input type="number" name="validityDays" value={proposal.validityDays} onChange={handleDateChange} className="block w-full px-4 py-3 bg-indigo-50 border-none rounded-2xl text-sm text-center focus:ring-2 focus:ring-indigo-600/20 font-black text-indigo-600" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3 mr-1.5" /> Fecha Validez
                                </label>
                                <input type="date" name="validityDate" value={proposal.validityDate} onChange={handleDateChange} className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 text-slate-700 font-black min-w-[150px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-500">
                                    <Save className="h-3 w-3 mr-1.5" /> Acción
                                </label>
                                <button type="submit" disabled={saving} className="w-full flex justify-center items-center h-[46px] px-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACTUALIZAR"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </motion.div>

            {/* ÁREA PRINCIPAL: CONSTRUCTOR */}
            <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
                    
                    {/* Status bar & Add Trigger */}
                    <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                                <Cpu className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
                                    ITEMS_ARCHITECT
                                    <span className="ml-3 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-md font-black">v2.0</span>
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">Configuración técnica de componentes y servicios.</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {isAddingItem ? (
                                <button onClick={() => setIsAddingItem(false)} className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 transition-colors px-5 py-3.5 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-sm">
                                     <ChevronRight className="h-4 w-4 -rotate-90" />
                                     <span>CONTRAER</span>
                                </button>
                            ) : (
                                <>
                                    {(itemForm.name !== '' || editingItemId) && (
                                        <button onClick={() => setIsAddingItem(true)} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors px-6 py-4 font-black text-xs uppercase tracking-widest border-2 border-indigo-200 rounded-2xl bg-indigo-50 hover:bg-indigo-100 shadow-sm">
                                             <ChevronRight className="h-5 w-5 rotate-90" />
                                             <span>EXPANDIR</span>
                                        </button>
                                    )}
                                    <button onClick={() => { setItemForm(initialItemForm); setEditingItemId(null); setIsAddingItem(true); }} className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-95 text-xs font-black uppercase tracking-widest">
                                        <Plus className="h-5 w-5" />
                                        <span>NUEVO ITEM</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Formulario de Configuración Dinámica */}
                    <AnimatePresence>
                        {isAddingItem && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-indigo-50/20 overflow-hidden border-b border-indigo-100">
                                <form onSubmit={handleSaveItem} className="p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        {/* ITEM # (Solo lectura) */}
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">ITEM #</label>
                                            <div className="w-full px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 text-sm font-black text-slate-400 flex items-center justify-center">
                                                {editingItemId 
                                                    ? items.findIndex(i => i.id === editingItemId) + 1 
                                                    : items.length + 1}
                                            </div>
                                        </div>

                                        {/* Selector de Tipo */}
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Elegible Categoría</label>
                                            <select name="itemType" value={itemForm.itemType} onChange={handleItemChange} className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 appearance-none shadow-sm cursor-pointer hover:border-indigo-200 transition-colors">
                                                {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Nombre del Item */}
                                        <div className="md:col-span-7 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre de Item</label>
                                            <input type="text" name="name" value={itemForm.name} onChange={handleItemChange} required placeholder="Ej. Laptops Dell Vostro 3400..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 shadow-sm placeholder:text-slate-300 transition-all" />
                                        </div>

                                        {/* SECCIÓN DE ESPECIFICACIONES TÉCNICAS (data-driven) */}
                                        <SpecFieldsSection
                                            itemType={itemForm.itemType}
                                            technicalSpecs={itemForm.technicalSpecs || {}}
                                            catalogs={catalogs}
                                            onChange={handleItemChange}
                                            onSelectSuggestion={selectSuggestion}
                                        />

                                        {/* Descripción General */}
                                        <div className="md:col-span-12 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notas Técnicas Complementarias</label>
                                            <textarea name="description" value={itemForm.description} onChange={handleItemChange} rows={3} placeholder="Ingrese detalles específicos no contemplados en la ficha técnica..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-medium text-slate-700 resize-none shadow-sm transition-all" />
                                        </div>

                                        {/* Estructura Comercial */}
                                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl">
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen (Prov)</label>
                                                <select name="internal.proveedor" value={itemForm.internalCosts?.proveedor || 'MAYORISTA'} onChange={handleItemChange} className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 focus:ring-2 focus:ring-slate-700 appearance-none">
                                                    <option value="MAYORISTA">MAYORISTA</option>
                                                    <option value="FABRICANTE">FABRICANTE</option>
                                                    <option value="NOVOTECHNO">NOVOTECHNO</option>
                                                    <option value="OTROS">OTROS</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flete (%)</label>
                                                <input type="text" inputMode="decimal" name="internal.fletePct" value={itemForm.internalCosts?.fletePct !== undefined ? itemForm.internalCosts.fletePct : 1.5} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 text-center focus:ring-2 focus:ring-slate-700" />
                                            </div>
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                                                <input type="text" inputMode="decimal" name="unitCost" value={itemForm.unitCost !== undefined ? itemForm.unitCost : ''} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-emerald-400 text-right focus:ring-2 focus:ring-emerald-500/20" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-amber-300 uppercase tracking-widest ml-1">Nuevo Costo Unitario ($)</label>
                                                <div className="w-full px-5 py-4 rounded-2xl bg-amber-600/20 border-2 border-amber-500/30 text-sm font-black text-amber-300 text-right">
                                                    {(() => {
                                                        const cost = Number(itemForm.unitCost || 0);
                                                        const flete = Number(itemForm.internalCosts?.fletePct || 0);
                                                        const nuevoCosto = cost * (1 + (flete / 100));
                                                        return nuevoCosto > 0 ? `$${nuevoCosto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">IVA (%)</label>
                                                <select 
                                                    name="isTaxable" 
                                                    value={itemForm.isTaxable ? "true" : "false"} 
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, isTaxable: e.target.value === "true" }))}
                                                    className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 focus:ring-2 focus:ring-slate-700 appearance-none shadow-xl"
                                                >
                                                    <option value="true">19%</option>
                                                    <option value="false">0%</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-4 pt-4">
                                        <button type="button" onClick={() => { setIsAddingItem(false); setEditingItemId(null); setItemForm(initialItemForm); }} className="px-10 py-5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                                            Descartar
                                        </button>
                                        <button type="submit" disabled={saving} className="px-14 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 flex items-center">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-3" /> : (
                                                <>
                                                    <Save className="h-4 w-4 mr-3" />
                                                    {editingItemId ? 'GUARDAR_CAMBIOS' : 'INSERTAR_VALORES'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Listado de Items en Propuesta */}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoría</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nuevo Costo Unitario ($)</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ctrl</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-32 text-center">
                                            <div className="max-w-xs mx-auto space-y-4 grayscale opacity-40">
                                                <Cpu className="h-20 w-20 mx-auto text-indigo-300" />
                                                <p className="text-sm font-bold text-slate-400">Su arquitectura aún no tiene componentes definidos.</p>
                                                <button onClick={() => { setItemForm(initialItemForm); setEditingItemId(null); setIsAddingItem(true); }} className="px-6 py-2 border-2 border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase tracking-widest transition-all">Añadir PRIMER ITEM</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((i, idx) => (
                                        <tr key={i.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-8 py-8 font-black text-slate-300 text-xs">Item {idx + 1}</td>
                                            <td className="px-4 py-8">
                                                <div className={cn(
                                                    "inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase shadow-sm",
                                                    i.itemType === 'PCS' ? "bg-indigo-600 text-white" :
                                                    i.itemType === 'SOFTWARE' ? "bg-purple-500 text-white" :
                                                    "bg-slate-800 text-white"
                                                )}>
                                                    {ITEM_TYPE_LABELS[i.itemType]}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-base mb-1 tracking-tight">{i.name}</span>
                                                    {i.description && <span className="text-[11px] text-slate-400 font-bold mb-2 italic">"{i.description}"</span>}
                                                    {i.itemType === 'PCS' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.modelo && <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-rose-100/50">{i.technicalSpecs.modelo}</span>}
                                                            {i.technicalSpecs.procesador && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.procesador}</span>}
                                                            {i.technicalSpecs.memoriaRam && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.memoriaRam}</span>}
                                                            {i.technicalSpecs.almacenamiento && <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-amber-100/50">{i.technicalSpecs.almacenamiento}</span>}
                                                            {i.technicalSpecs.garantiaEquipo && <span className="px-2.5 py-1 bg-cyan-50 text-cyan-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-cyan-100/50">{i.technicalSpecs.garantiaEquipo}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'ACCESSORIES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.garantia && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.garantia}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'PC_SERVICES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.responsable && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.responsable}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-amber-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'SOFTWARE' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-purple-100/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'INFRASTRUCTURE' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.garantia && <span className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-orange-100/50">{i.technicalSpecs.garantia}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'INFRA_SERVICES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.responsable && <span className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{i.technicalSpecs.responsable}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8 text-right font-mono text-[13px] text-slate-400 tracking-tighter">${(Number(i.unitCost) * (1 + Number(i.internalCosts?.fletePct || 0) / 100)).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-8 py-8 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button onClick={() => editItem(i)} title="Editar" className="p-2 sm:p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-lg hover:shadow-indigo-100 rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                                                        <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <button onClick={() => duplicateItem(i)} title="Duplicar" className="p-2 sm:p-3 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-100 rounded-2xl transition-all border border-transparent hover:border-emerald-100">
                                                        <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <button onClick={() => i.id && deleteItem(i.id)} title="Eliminar" className="p-2 sm:p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 hover:shadow-lg hover:shadow-red-100 rounded-2xl transition-all border border-transparent hover:border-red-100">
                                                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                    <button 
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span>Volver a Cabecera</span>
                    </button>
                    <button
                        disabled={items.length === 0}
                        onClick={() => navigate(`/proposals/${id}/calculations`)}
                        className="flex items-center space-x-4 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white px-16 py-6 rounded-[2rem] transition-all font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 group active:scale-95"
                    >
                        <span>Ir a Ventana de Cálculos</span>
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-3 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
===
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Package, Save, Loader2, ArrowRight,
    Plus, Trash2, Lock,
    Calendar, Clock, FileText, ChevronRight, Edit2, Copy,
    Cpu
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProposalItem, ProposalDetail } from '../../lib/types';
import { ITEM_TYPE_LABELS, MAYORISTA_FLETE_PCT, PROVEEDOR_MAYORISTA } from '../../lib/constants';
import SpecFieldsSection from '../../components/proposals/SpecFieldsSection';
import { useProposalBuilder } from '../../hooks/useProposalBuilder';

export default function ProposalItemsBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, catalogs, proposal, setProposal, items,
        initialItemForm, saveItem, deleteItem, updateProposal,
    } = useProposalBuilder(id);

    // UI state
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [itemForm, setItemForm] = useState<ProposalItem>(initialItemForm);

    const handleUpdateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!proposal) return;
        await updateProposal({
            subject: proposal.subject,
            issueDate: proposal.issueDate,
            validityDays: proposal.validityDays,
            validityDate: proposal.validityDate,
        });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProposal((prev) => {
            if (!prev) return prev;
            const next = { ...prev, [name]: value } as ProposalDetail & Record<string, unknown>;
            if (name === 'validityDays') {
                const days = parseInt(value, 10) || 0;
                const d = new Date(String(next.issueDate));
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
                next.validityDays = days;
            } else if (name === 'validityDate') {
                const start = new Date(String(next.issueDate));
                const end = new Date(value);
                const diffTime = end.getTime() - start.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                next.validityDays = diffDays > 0 ? diffDays : 0;
            } else if (name === 'issueDate') {
                const days = next.validityDays || 0;
                const d = new Date(value);
                d.setDate(d.getDate() + days);
                next.validityDate = d.toISOString().split('T')[0];
            }
            return next;
        });
    };


    const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target;

        // Convertir coma a punto y dejar solo números y un punto
        if (['unitCost', 'marginPct', 'unitPrice', 'internal.fletePct', 'quantity'].includes(name)) {
            value = value.replace(/,/g, '.');
            value = value.replace(/[^\d.]/g, '');
            const parts = value.split('.');
            // Asegurar 1 solo punto
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            // Limitar a 2 decimales (Excepto cantidad que puede ser un entero o ignorar)
            if (name !== 'quantity') {
                const decParts = value.split('.');
                if (decParts.length === 2 && decParts[1].length > 2) {
                    value = decParts[0] + '.' + decParts[1].substring(0, 2);
                }
            }
        }

        setItemForm(prev => {
            let next = { ...prev };
            
            if (name.startsWith('spec.')) {
                const specField = name.split('.')[1];
                next.technicalSpecs = { ...prev.technicalSpecs, [specField]: value };
            } else if (name.startsWith('internal.')) {
                const internalField = name.split('.')[1];


                // Dependencia directa de proveedor a flete
                if (internalField === 'proveedor') {
                    next.internalCosts = { 
                        ...prev.internalCosts, 
                        proveedor: value,
                        fletePct: value === PROVEEDOR_MAYORISTA ? MAYORISTA_FLETE_PCT : 0 
                    };
                } else {
                    next.internalCosts = {
                        ...prev.internalCosts,
                        [internalField]: value
                    };
                }
            } else {
                (next as Record<string, unknown>)[name] = value;
            }

            // Lógica de cálculo automático con Costo Landed (Márgen sobre costo + flete)
            const cost = ['unitCost'].includes(name) ? Number(value) : Number(next.unitCost || 0);
            const margin = ['marginPct'].includes(name) ? Number(value) : Number(next.marginPct || 0);
            
            let fleteValue = Number(next.internalCosts?.fletePct || 0);
            if (name === 'internal.proveedor') {
                fleteValue = value === PROVEEDOR_MAYORISTA ? MAYORISTA_FLETE_PCT : 0;
            } else if (name === 'internal.fletePct') {
                fleteValue = Number(value);
            }
            const flete = fleteValue;
            
            const landedCost = cost * (1 + (flete / 100));

            // Disparar cálculos bidireccionales de manera robusta
            if (name === 'unitCost' || name === 'marginPct' || name === 'internal.fletePct' || name === 'internal.proveedor') {
                if (margin < 100 && landedCost > 0) {
                    const priceVal = landedCost / (1 - (margin / 100));
                    next.unitPrice = priceVal.toFixed(2);
                } else if (landedCost === 0) {
                    next.unitPrice = ''; // En caso de que no haya costo, limpiamos
                }
            } else if (name === 'unitPrice') {
                const price = Number(value);
                if (price > 0 && landedCost > 0) {
                    // Calculamos margen en base a qué tan grande es el precio vs landed cost
                    const marginVal = ((price - landedCost) / price) * 100;
                    next.marginPct = marginVal.toFixed(2);
                } else if (price > 0 && landedCost === 0) {
                    // Si ya le puso precio de venta y no hay costo, el margen teóricamente es 100%
                    next.marginPct = '100.00';
                }
            }

            return next;
        });
    };

    const selectSuggestion = (field: string, value: string) => {
        setItemForm(prev => ({
            ...prev,
            technicalSpecs: {
                ...prev.technicalSpecs,
                [field]: value
            }
        }));
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await saveItem(itemForm, editingItemId);
        if (success) {
            setIsAddingItem(false);
            setEditingItemId(null);
            setItemForm(initialItemForm);
        }
    };

    const editItem = (item: ProposalItem) => {
        setItemForm(item);
        setEditingItemId(item.id || null);
        setIsAddingItem(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const duplicateItem = (item: ProposalItem) => {
        const newItem = { ...item };
        delete newItem.id;
        setItemForm(newItem);
        setEditingItemId(null);
        setIsAddingItem(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    // Se ha removido la totalización por petición del usuario

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            {/* Header del Asistente */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                        <Package className="h-8 w-8 mr-3 text-indigo-600" />
                        Constructor de Propuesta
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Arquitectura de Oferta y Estructura de Costos</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Referencia Única</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* SECCIÓN SUPERIOR: Ajustes y Datos del Cliente (Horizontal) */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
                {/* Info Cliente */}
                <div className="lg:col-span-3 bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-200 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Lock className="h-12 w-12" />
                    </div>
                    <div className="space-y-1 relative z-10">
                        <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Cliente / Empresa</p>
                        <p className="text-xl font-black leading-tight tracking-tight">{proposal.clientName}</p>
                        <div className="flex items-center space-x-2 mt-2">
                             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Sesión Activa</span>
                        </div>
                    </div>
                </div>

                {/* Ajustes Horizontales */}
                <div className="lg:col-span-9 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6">
                    <form onSubmit={handleUpdateProposal} className="flex flex-col gap-6">
                        <div className="w-full space-y-2">
                            <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                <FileText className="h-3 w-3 mr-1.5" /> Asunto
                            </label>
                            <textarea 
                                name="subject" 
                                value={proposal.subject} 
                                onChange={handleDateChange} 
                                className="block w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 font-bold text-slate-700 min-h-[96px] resize-none leading-relaxed" 
                                placeholder="Especifique el asunto del requerimiento..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3 mr-1.5" /> Emisión
                                </label>
                                <input type="date" name="issueDate" value={proposal.issueDate} onChange={handleDateChange} className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 text-slate-700 font-black min-w-[150px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Clock className="h-3 w-3 mr-1.5" /> Días Validez
                                </label>
                                <input type="number" name="validityDays" value={proposal.validityDays} onChange={handleDateChange} className="block w-full px-4 py-3 bg-indigo-50 border-none rounded-2xl text-sm text-center focus:ring-2 focus:ring-indigo-600/20 font-black text-indigo-600" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Calendar className="h-3 w-3 mr-1.5" /> Fecha Validez
                                </label>
                                <input type="date" name="validityDate" value={proposal.validityDate} onChange={handleDateChange} className="block w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-600/20 text-slate-700 font-black min-w-[150px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-emerald-500">
                                    <Save className="h-3 w-3 mr-1.5" /> Acción
                                </label>
                                <button type="submit" disabled={saving} className="w-full flex justify-center items-center h-[46px] px-6 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACTUALIZAR"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </motion.div>

            {/* ÁREA PRINCIPAL: CONSTRUCTOR */}
            <div className="space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
                    
                    {/* Status bar & Add Trigger */}
                    <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                                <Cpu className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
                                    ITEMS_ARCHITECT
                                    <span className="ml-3 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-md font-black">v2.0</span>
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">Configuración técnica de componentes y servicios.</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {isAddingItem ? (
                                <button onClick={() => setIsAddingItem(false)} className="flex items-center space-x-2 text-slate-500 hover:text-slate-700 transition-colors px-5 py-3.5 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-sm">
                                     <ChevronRight className="h-4 w-4 -rotate-90" />
                                     <span>CONTRAER</span>
                                </button>
                            ) : (
                                <>
                                    {(itemForm.name !== '' || editingItemId) && (
                                        <button onClick={() => setIsAddingItem(true)} className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800 transition-colors px-6 py-4 font-black text-xs uppercase tracking-widest border-2 border-indigo-200 rounded-2xl bg-indigo-50 hover:bg-indigo-100 shadow-sm">
                                             <ChevronRight className="h-5 w-5 rotate-90" />
                                             <span>EXPANDIR</span>
                                        </button>
                                    )}
                                    <button onClick={() => { setItemForm(initialItemForm); setEditingItemId(null); setIsAddingItem(true); }} className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all transform active:scale-95 text-xs font-black uppercase tracking-widest">
                                        <Plus className="h-5 w-5" />
                                        <span>NUEVO ITEM</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Formulario de Configuración Dinámica */}
                    <AnimatePresence>
                        {isAddingItem && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-indigo-50/20 overflow-hidden border-b border-indigo-100">
                                <form onSubmit={handleSaveItem} className="p-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        {/* ITEM # (Solo lectura) */}
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">ITEM #</label>
                                            <div className="w-full px-5 py-4 rounded-2xl bg-slate-100 border-2 border-slate-200 text-sm font-black text-slate-400 flex items-center justify-center">
                                                {editingItemId 
                                                    ? items.findIndex(i => i.id === editingItemId) + 1 
                                                    : items.length + 1}
                                            </div>
                                        </div>

                                        {/* Selector de Tipo */}
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Elegible Categoría</label>
                                            <select name="itemType" value={itemForm.itemType} onChange={handleItemChange} className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 appearance-none shadow-sm cursor-pointer hover:border-indigo-200 transition-colors">
                                                {Object.entries(ITEM_TYPE_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Nombre del Item */}
                                        <div className="md:col-span-7 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre de Item</label>
                                            <input type="text" name="name" value={itemForm.name} onChange={handleItemChange} required placeholder="Ej. Laptops Dell Vostro 3400..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-black text-slate-800 shadow-sm placeholder:text-slate-300 transition-all" />
                                        </div>

                                        {/* SECCIÓN DE ESPECIFICACIONES TÉCNICAS (data-driven) */}
                                        <SpecFieldsSection
                                            itemType={itemForm.itemType}
                                            technicalSpecs={itemForm.technicalSpecs || {}}
                                            catalogs={catalogs}
                                            onChange={handleItemChange}
                                            onSelectSuggestion={selectSuggestion}
                                        />

                                        {/* Descripción General */}
                                        <div className="md:col-span-12 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notas Técnicas Complementarias</label>
                                            <textarea name="description" value={itemForm.description} onChange={handleItemChange} rows={3} placeholder="Ingrese detalles específicos no contemplados en la ficha técnica..." className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-indigo-100 focus:border-indigo-600 focus:ring-0 text-sm font-medium text-slate-700 resize-none shadow-sm transition-all" />
                                        </div>

                                        {/* Estructura Comercial */}
                                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl">
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origen (Prov)</label>
                                                <select name="internal.proveedor" value={itemForm.internalCosts?.proveedor || 'MAYORISTA'} onChange={handleItemChange} className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 focus:ring-2 focus:ring-slate-700 appearance-none">
                                                    <option value="MAYORISTA">MAYORISTA</option>
                                                    <option value="FABRICANTE">FABRICANTE</option>
                                                    <option value="NOVOTECHNO">NOVOTECHNO</option>
                                                    <option value="OTROS">OTROS</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Flete (%)</label>
                                                <input type="text" inputMode="decimal" name="internal.fletePct" value={itemForm.internalCosts?.fletePct !== undefined ? itemForm.internalCosts.fletePct : 1.5} onChange={handleItemChange} required className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 text-center focus:ring-2 focus:ring-slate-700" />
                                            </div>
                                             <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                                                <div className="flex items-stretch gap-0">
                                                    <input type="text" inputMode="decimal" name="unitCost" value={itemForm.unitCost !== undefined ? itemForm.unitCost : ''} onChange={handleItemChange} required className="flex-1 min-w-0 px-5 py-4 rounded-l-2xl bg-slate-800 border-none text-sm font-black text-emerald-400 text-right focus:ring-2 focus:ring-emerald-500/20" />
                                                    <div className="flex flex-col">
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemForm(prev => ({ ...prev, costCurrency: 'COP' }))}
                                                            className={`flex-1 px-3 text-[9px] font-black tracking-wider rounded-tr-2xl transition-all ${
                                                                (itemForm.costCurrency || 'COP') === 'COP'
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                                            }`}
                                                        >COP</button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemForm(prev => ({ ...prev, costCurrency: 'USD' }))}
                                                            className={`flex-1 px-3 text-[9px] font-black tracking-wider rounded-br-2xl transition-all ${
                                                                itemForm.costCurrency === 'USD'
                                                                    ? 'bg-indigo-500 text-white'
                                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                                            }`}
                                                        >USD</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-amber-300 uppercase tracking-widest ml-1">Nuevo Costo Unitario ($)</label>
                                                <div className="w-full px-5 py-4 rounded-2xl bg-amber-600/20 border-2 border-amber-500/30 text-sm font-black text-amber-300 text-right">
                                                    {(() => {
                                                        const cost = Number(itemForm.unitCost || 0);
                                                        const flete = Number(itemForm.internalCosts?.fletePct || 0);
                                                        const nuevoCosto = cost * (1 + (flete / 100));
                                                        return nuevoCosto > 0 ? `$${nuevoCosto.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest ml-1">IVA (%)</label>
                                                <select 
                                                    name="isTaxable" 
                                                    value={itemForm.isTaxable ? "true" : "false"} 
                                                    onChange={(e) => setItemForm(prev => ({ ...prev, isTaxable: e.target.value === "true" }))}
                                                    className="w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 focus:ring-2 focus:ring-slate-700 appearance-none shadow-xl"
                                                >
                                                    <option value="true">19%</option>
                                                    <option value="false">0%</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end space-x-4 pt-4">
                                        <button type="button" onClick={() => { setIsAddingItem(false); setEditingItemId(null); setItemForm(initialItemForm); }} className="px-10 py-5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                                            Descartar
                                        </button>
                                        <button type="submit" disabled={saving} className="px-14 py-5 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-100 disabled:opacity-50 flex items-center">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-3" /> : (
                                                <>
                                                    <Save className="h-4 w-4 mr-3" />
                                                    {editingItemId ? 'GUARDAR_CAMBIOS' : 'INSERTAR_VALORES'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Listado de Items en Propuesta */}
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-y border-slate-100">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoría</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                    <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Nuevo Costo Unitario ($)</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ctrl</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-32 text-center">
                                            <div className="max-w-xs mx-auto space-y-4 grayscale opacity-40">
                                                <Cpu className="h-20 w-20 mx-auto text-indigo-300" />
                                                <p className="text-sm font-bold text-slate-400">Su arquitectura aún no tiene componentes definidos.</p>
                                                <button onClick={() => { setItemForm(initialItemForm); setEditingItemId(null); setIsAddingItem(true); }} className="px-6 py-2 border-2 border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase tracking-widest transition-all">Añadir PRIMER ITEM</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((i, idx) => (
                                        <tr key={i.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-8 py-8 font-black text-slate-300 text-xs">Item {idx + 1}</td>
                                            <td className="px-4 py-8">
                                                <div className={cn(
                                                    "inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase shadow-sm",
                                                    i.itemType === 'PCS' ? "bg-indigo-600 text-white" :
                                                    i.itemType === 'SOFTWARE' ? "bg-purple-500 text-white" :
                                                    "bg-slate-800 text-white"
                                                )}>
                                                    {ITEM_TYPE_LABELS[i.itemType]}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-base mb-1 tracking-tight">{i.name}</span>
                                                    {i.description && <span className="text-[11px] text-slate-400 font-bold mb-2 italic">"{i.description}"</span>}
                                                    {i.itemType === 'PCS' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.modelo && <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-rose-100/50">{i.technicalSpecs.modelo}</span>}
                                                            {i.technicalSpecs.procesador && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.procesador}</span>}
                                                            {i.technicalSpecs.memoriaRam && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.memoriaRam}</span>}
                                                            {i.technicalSpecs.almacenamiento && <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-amber-100/50">{i.technicalSpecs.almacenamiento}</span>}
                                                            {i.technicalSpecs.garantiaEquipo && <span className="px-2.5 py-1 bg-cyan-50 text-cyan-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-cyan-100/50">{i.technicalSpecs.garantiaEquipo}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'ACCESSORIES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.garantia && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.garantia}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'PC_SERVICES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.responsable && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-indigo-100/50">{i.technicalSpecs.responsable}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-amber-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'SOFTWARE' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-purple-100/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'INFRASTRUCTURE' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.fabricante && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.fabricante}</span>}
                                                            {i.technicalSpecs.garantia && <span className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-orange-100/50">{i.technicalSpecs.garantia}</span>}
                                                        </div>
                                                    )}
                                                    {i.itemType === 'INFRA_SERVICES' && i.technicalSpecs && (
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {i.technicalSpecs.tipo && <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-slate-200/50">{i.technicalSpecs.tipo}</span>}
                                                            {i.technicalSpecs.responsable && <span className="px-2.5 py-1 bg-slate-800 text-white rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm">{i.technicalSpecs.responsable}</span>}
                                                            {i.technicalSpecs.unidadMedida && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tighter shadow-sm border border-emerald-100/50">{i.technicalSpecs.unidadMedida}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-8 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider ${
                                                        i.costCurrency === 'USD'
                                                            ? 'bg-indigo-100 text-indigo-600'
                                                            : 'bg-slate-100 text-slate-500'
                                                    }`}>{i.costCurrency || 'COP'}</span>
                                                    <span className="font-mono text-[13px] text-slate-400 tracking-tighter">${(Number(i.unitCost) * (1 + Number(i.internalCosts?.fletePct || 0) / 100)).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button onClick={() => editItem(i)} title="Editar" className="p-2 sm:p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-lg hover:shadow-indigo-100 rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                                                        <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <button onClick={() => duplicateItem(i)} title="Duplicar" className="p-2 sm:p-3 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-100 rounded-2xl transition-all border border-transparent hover:border-emerald-100">
                                                        <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                    <button onClick={() => i.id && deleteItem(i.id)} title="Eliminar" className="p-2 sm:p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 hover:shadow-lg hover:shadow-red-100 rounded-2xl transition-all border border-transparent hover:border-red-100">
                                                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-8 border-t border-slate-100">
                    <button 
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span>Volver a Cabecera</span>
                    </button>
                    <button
                        disabled={items.length === 0}
                        onClick={() => navigate(`/proposals/${id}/calculations`)}
                        className="flex items-center space-x-4 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-200 text-white px-16 py-6 rounded-[2rem] transition-all font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 group active:scale-95"
                    >
                        <span>Ir a Ventana de Cálculos</span>
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-3 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- **Form:** COP/USD mini-toggle buttons beside the unit cost input
- **Table:** Currency badge (`COP` / `USD`) displayed before the cost value

### [useScenarios.ts](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts)

```diff:useScenarios.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
    calculateScenarioTotals,
    calculateParentLandedCost,
    calculateChildrenCostPerUnit,
    calculateBaseLandedCost,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    calculateMarginFromPrice,
    type ScenarioTotals,
} from '../lib/pricing-engine';

// ── Tipos ────────────────────────────────────────────────────
// ProposalCalcItem is kept here for backward-compat with consumers
// that import it from this file (ItemPickerModal, ProposalCalculations, etc.)
export interface ProposalCalcItem {
    id: string;
    name: string;
    itemType: string;
    unitCost: number;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    description?: string;
    internalCosts?: {
        fletePct?: number;
        proveedor?: string;
    };
    technicalSpecs?: Record<string, string | undefined>;
}

export interface ScenarioItem {
    id?: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number;
    isDilpidate?: boolean;
    item: ProposalCalcItem;
    children?: ScenarioItem[];
}

export interface Scenario {
    id: string;
    name: string;
    currency: string;
    description?: string;
    scenarioItems: ScenarioItem[];
}

// Re-export ScenarioTotals from pricing-engine for consumers
export type { ScenarioTotals };

// ── Hook ─────────────────────────────────────────────────────
export function useScenarios(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [proposal, setProposal] = useState<any>(null);
    const [proposalItems, setProposalItems] = useState<ProposalCalcItem[]>([]);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [trm, setTrm] = useState<{ valor: number; fechaActualizacion: string } | null>(null);
    const [extraTrm, setExtraTrm] = useState<{ setIcapAverage: number | null; wilkinsonSpot: number | null } | null>(null);

    const loadData = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const [propRes, scenariosRes] = await Promise.all([
                api.get(`/proposals/${proposalId}`),
                api.get(`/proposals/${proposalId}/scenarios`),
            ]);

            setProposal(propRes.data);
            setProposalItems(propRes.data.proposalItems || []);
            setScenarios(scenariosRes.data || []);

            if (scenariosRes.data?.length > 0 && !activeScenarioId) {
                setActiveScenarioId(scenariosRes.data[0].id);
            }
        } catch (error) {
            console.error('Error loading calculations data', error);
        } finally {
            setLoading(false);
        }

        // TRM oficial
        try {
            const trmRes = await fetch('https://co.dolarapi.com/v1/trm');
            const trmData = await trmRes.json();
            setTrm({ valor: trmData.valor, fechaActualizacion: trmData.fechaActualizacion });
        } catch (error) {
            console.error('Error fetching TRM', error);
        }

        // TRM extras (SET-ICAP & Wilkinson)
        try {
            const extraRes = await api.get('/proposals/trm-extra');
            setExtraTrm(extraRes.data);
        } catch (error) {
            console.error('Error fetching extra TRM', error);
        }
    }, [proposalId, activeScenarioId]);

    useEffect(() => {
        loadData();
    }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Escenarios CRUD ──────────────────────────────────────
    const createScenario = async (name: string) => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await api.post(`/proposals/${proposalId}/scenarios`, {
                name,
                description: '',
            });
            setScenarios(prev => [...prev, { ...res.data, scenarioItems: [] }]);
            setActiveScenarioId(res.data.id);
            return true;
        } catch (error) {
            console.error(error);
            alert('No se pudo crear el escenario');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteScenario = async (sid: string) => {
        if (!confirm('¿Eliminar este escenario?')) return;
        try {
            await api.delete(`/proposals/scenarios/${sid}`);
            setScenarios(prev => prev.filter(s => s.id !== sid));
            if (activeScenarioId === sid) setActiveScenarioId(null);
        } catch (error) {
            console.error(error);
        }
    };

    // ── Items en escenario ───────────────────────────────────
    const addItemToScenario = async (itemId: string) => {
        if (!activeScenarioId) return;
        const item = proposalItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId,
                quantity: Number(item.quantity) || 1,
                marginPct: Number(item.marginPct) || 0,
            });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: [...s.scenarioItems, { ...res.data, item }] }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const removeItemFromScenario = async (siId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${siId}`);
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: s.scenarioItems.filter(si => si.id !== siId) }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const addChildItem = async (parentScenarioItemId: string, proposalItemId: string) => {
        if (!activeScenarioId) return;
        const item = proposalItems.find(i => i.id === proposalItemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId: proposalItemId,
                parentId: parentScenarioItemId,
                quantity: Number(item.quantity) || 1,
                marginPct: Number(item.marginPct) || 0,
            });
            const newChild: ScenarioItem = { ...res.data, item };
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentScenarioItemId
                                      ? { ...si, children: [...(si.children || []), newChild] }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const removeChildItem = async (parentScenarioItemId: string, childId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${childId}`);
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentScenarioItemId
                                      ? { ...si, children: (si.children || []).filter(c => c.id !== childId) }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateChildQuantity = async (parentSiId: string, childId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val) || val < 0) return;
        try {
            await api.patch(`/proposals/scenarios/items/${childId}`, { quantity: val });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentSiId
                                      ? {
                                            ...si,
                                            children: (si.children || []).map(c =>
                                                c.id === childId ? { ...c, quantity: val } : c,
                                            ),
                                        }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const changeCurrency = async (currency: string) => {
        if (!activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}`, { currency });
            setScenarios(prev => prev.map(s => (s.id === activeScenarioId ? { ...s, currency } : s)));
        } catch (error) {
            console.error(error);
        }
    };

    const renameScenario = async (scenarioId: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            await api.patch(`/proposals/scenarios/${scenarioId}`, { name: trimmed });
            setScenarios(prev => prev.map(s => (s.id === scenarioId ? { ...s, name: trimmed } : s)));
        } catch (error) {
            console.error(error);
        }
    };

    const cloneScenario = async (scenarioId: string) => {
        try {
            setSaving(true);
            const res = await api.post(`/proposals/scenarios/${scenarioId}/clone`);
            setScenarios(prev => [...prev, res.data]);
            setActiveScenarioId(res.data.id);
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar el escenario');
        } finally {
            setSaving(false);
        }
    };

    const updateMargin = async (siId: string, margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val)) return;
        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: val });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(si => (si.id === siId ? { ...si, marginPctOverride: val } : si)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateQuantity = async (siId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val)) return;
        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { quantity: val });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(si => (si.id === siId ? { ...si, quantity: val } : si)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const toggleDilpidate = async (siId: string) => {
        const scenario = scenarios.find(s => s.scenarioItems.some(si => si.id === siId));
        if (!scenario) return;
        const si = scenario.scenarioItems.find(i => i.id === siId);
        if (!si) return;
        const newVal = !si.isDilpidate;
        try {
            // When enabling dilute, force margin to 0
            const patchData: Record<string, unknown> = { isDilpidate: newVal };
            if (newVal) patchData.marginPct = 0;
            await api.patch(`/proposals/scenarios/items/${siId}`, patchData);
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(item =>
                        item.id === siId
                            ? { ...item, isDilpidate: newVal, ...(newVal ? { marginPctOverride: 0 } : {}) }
                            : item,
                    ),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateUnitPrice = async (siId: string, price: string) => {
        const val = parseFloat(price.replace(',', '.'));
        if (isNaN(val) || val <= 0) return;

        const scenario = scenarios.find(s => s.scenarioItems.some(si => si.id === siId));
        if (!scenario) return;
        const si = scenario.scenarioItems.find(i => i.id === siId);
        if (!si) return;

        const cost = Number(si.item.unitCost);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);
        const childrenCost = calculateChildrenCostPerUnit(si.children || []);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        // Include dilution in effective cost for accurate margin reverse-calc
        const totalDilutedCost = calculateTotalDilutedCost(scenario.scenarioItems);
        const totalNormalSub = calculateTotalNormalSubtotal(scenario.scenarioItems);
        const dilution = calculateDilutionPerUnit(cost, si.quantity, totalNormalSub, totalDilutedCost);
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
        const newMargin = calculateMarginFromPrice(val, effectiveLanded);

        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: newMargin });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(i => (i.id === siId ? { ...i, marginPctOverride: newMargin } : i)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateGlobalMargin = async (margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val) || !activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}/apply-margin`, { marginPct: val });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: s.scenarioItems.map(si => ({ ...si, marginPctOverride: val })) }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
            alert('No se pudo aplicar el margen global.');
        }
    };

    // ── Cálculos (delegated to pricing-engine) ────────────────
    const calculateTotals = (scenario: Scenario): ScenarioTotals => {
        return calculateScenarioTotals(scenario.scenarioItems);
    };

    const activeScenario = scenarios.find(s => s.id === activeScenarioId) ?? null;
    const totals: ScenarioTotals = activeScenario
        ? calculateTotals(activeScenario)
        : { beforeVat: 0, nonTaxed: 0, subtotal: 0, vat: 0, total: 0, globalMarginPct: 0 };

    return {
        loading,
        saving,
        proposal,
        proposalItems,
        scenarios,
        activeScenarioId,
        setActiveScenarioId,
        activeScenario,
        totals,
        trm,
        extraTrm,
        loadData,
        createScenario,
        deleteScenario,
        addItemToScenario,
        removeItemFromScenario,
        addChildItem,
        removeChildItem,
        updateChildQuantity,
        changeCurrency,
        updateMargin,
        updateQuantity,
        updateUnitPrice,
        updateGlobalMargin,
        toggleDilpidate,
        renameScenario,
        cloneScenario,
    };
}
===
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
    calculateScenarioTotals,
    calculateParentLandedCost,
    calculateChildrenCostPerUnit,
    calculateBaseLandedCost,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    calculateMarginFromPrice,
    convertCost,
    type ScenarioTotals,
} from '../lib/pricing-engine';

// ── Tipos ────────────────────────────────────────────────────
// ProposalCalcItem is kept here for backward-compat with consumers
// that import it from this file (ItemPickerModal, ProposalCalculations, etc.)
export interface ProposalCalcItem {
    id: string;
    name: string;
    itemType: string;
    unitCost: number;
    costCurrency?: string;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    description?: string;
    internalCosts?: {
        fletePct?: number;
        proveedor?: string;
    };
    technicalSpecs?: Record<string, string | undefined>;
}

export interface ScenarioItem {
    id?: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number;
    isDilpidate?: boolean;
    item: ProposalCalcItem;
    children?: ScenarioItem[];
}

export interface Scenario {
    id: string;
    name: string;
    currency: string;
    conversionTrm?: number | null;
    description?: string;
    scenarioItems: ScenarioItem[];
}

// Re-export ScenarioTotals from pricing-engine for consumers
export type { ScenarioTotals };

// ── Hook ─────────────────────────────────────────────────────
export function useScenarios(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [proposal, setProposal] = useState<any>(null);
    const [proposalItems, setProposalItems] = useState<ProposalCalcItem[]>([]);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [trm, setTrm] = useState<{ valor: number; fechaActualizacion: string } | null>(null);
    const [extraTrm, setExtraTrm] = useState<{ setIcapAverage: number | null; wilkinsonSpot: number | null } | null>(null);

    const loadData = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const [propRes, scenariosRes] = await Promise.all([
                api.get(`/proposals/${proposalId}`),
                api.get(`/proposals/${proposalId}/scenarios`),
            ]);

            setProposal(propRes.data);
            setProposalItems(propRes.data.proposalItems || []);
            setScenarios(scenariosRes.data || []);

            if (scenariosRes.data?.length > 0 && !activeScenarioId) {
                setActiveScenarioId(scenariosRes.data[0].id);
            }
        } catch (error) {
            console.error('Error loading calculations data', error);
        } finally {
            setLoading(false);
        }

        // TRM oficial
        try {
            const trmRes = await fetch('https://co.dolarapi.com/v1/trm');
            const trmData = await trmRes.json();
            setTrm({ valor: trmData.valor, fechaActualizacion: trmData.fechaActualizacion });
        } catch (error) {
            console.error('Error fetching TRM', error);
        }

        // TRM extras (SET-ICAP & Wilkinson)
        try {
            const extraRes = await api.get('/proposals/trm-extra');
            setExtraTrm(extraRes.data);
        } catch (error) {
            console.error('Error fetching extra TRM', error);
        }
    }, [proposalId, activeScenarioId]);

    useEffect(() => {
        loadData();
    }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Escenarios CRUD ──────────────────────────────────────
    const createScenario = async (name: string) => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await api.post(`/proposals/${proposalId}/scenarios`, {
                name,
                description: '',
            });
            setScenarios(prev => [...prev, { ...res.data, scenarioItems: [] }]);
            setActiveScenarioId(res.data.id);
            return true;
        } catch (error) {
            console.error(error);
            alert('No se pudo crear el escenario');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteScenario = async (sid: string) => {
        if (!confirm('¿Eliminar este escenario?')) return;
        try {
            await api.delete(`/proposals/scenarios/${sid}`);
            setScenarios(prev => prev.filter(s => s.id !== sid));
            if (activeScenarioId === sid) setActiveScenarioId(null);
        } catch (error) {
            console.error(error);
        }
    };

    // ── Items en escenario ───────────────────────────────────
    const addItemToScenario = async (itemId: string) => {
        if (!activeScenarioId) return;
        const item = proposalItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId,
                quantity: Number(item.quantity) || 1,
                marginPct: Number(item.marginPct) || 0,
            });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: [...s.scenarioItems, { ...res.data, item }] }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const removeItemFromScenario = async (siId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${siId}`);
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: s.scenarioItems.filter(si => si.id !== siId) }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const addChildItem = async (parentScenarioItemId: string, proposalItemId: string) => {
        if (!activeScenarioId) return;
        const item = proposalItems.find(i => i.id === proposalItemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId: proposalItemId,
                parentId: parentScenarioItemId,
                quantity: Number(item.quantity) || 1,
                marginPct: Number(item.marginPct) || 0,
            });
            const newChild: ScenarioItem = { ...res.data, item };
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentScenarioItemId
                                      ? { ...si, children: [...(si.children || []), newChild] }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const removeChildItem = async (parentScenarioItemId: string, childId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${childId}`);
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentScenarioItemId
                                      ? { ...si, children: (si.children || []).filter(c => c.id !== childId) }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateChildQuantity = async (parentSiId: string, childId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val) || val < 0) return;
        try {
            await api.patch(`/proposals/scenarios/items/${childId}`, { quantity: val });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentSiId
                                      ? {
                                            ...si,
                                            children: (si.children || []).map(c =>
                                                c.id === childId ? { ...c, quantity: val } : c,
                                            ),
                                        }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const changeCurrency = async (currency: string) => {
        if (!activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}`, { currency });
            setScenarios(prev => prev.map(s => (s.id === activeScenarioId ? { ...s, currency } : s)));
        } catch (error) {
            console.error(error);
        }
    };

    const renameScenario = async (scenarioId: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            await api.patch(`/proposals/scenarios/${scenarioId}`, { name: trimmed });
            setScenarios(prev => prev.map(s => (s.id === scenarioId ? { ...s, name: trimmed } : s)));
        } catch (error) {
            console.error(error);
        }
    };

    const cloneScenario = async (scenarioId: string) => {
        try {
            setSaving(true);
            const res = await api.post(`/proposals/scenarios/${scenarioId}/clone`);
            setScenarios(prev => [...prev, res.data]);
            setActiveScenarioId(res.data.id);
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar el escenario');
        } finally {
            setSaving(false);
        }
    };

    const updateMargin = async (siId: string, margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val)) return;
        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: val });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(si => (si.id === siId ? { ...si, marginPctOverride: val } : si)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateQuantity = async (siId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val)) return;
        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { quantity: val });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(si => (si.id === siId ? { ...si, quantity: val } : si)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const toggleDilpidate = async (siId: string) => {
        const scenario = scenarios.find(s => s.scenarioItems.some(si => si.id === siId));
        if (!scenario) return;
        const si = scenario.scenarioItems.find(i => i.id === siId);
        if (!si) return;
        const newVal = !si.isDilpidate;
        try {
            // When enabling dilute, force margin to 0
            const patchData: Record<string, unknown> = { isDilpidate: newVal };
            if (newVal) patchData.marginPct = 0;
            await api.patch(`/proposals/scenarios/items/${siId}`, patchData);
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(item =>
                        item.id === siId
                            ? { ...item, isDilpidate: newVal, ...(newVal ? { marginPctOverride: 0 } : {}) }
                            : item,
                    ),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateUnitPrice = async (siId: string, price: string) => {
        const val = parseFloat(price.replace(',', '.'));
        if (isNaN(val) || val <= 0) return;

        const scenario = scenarios.find(s => s.scenarioItems.some(si => si.id === siId));
        if (!scenario) return;
        const si = scenario.scenarioItems.find(i => i.id === siId);
        if (!si) return;

        const rawCost = Number(si.item.unitCost);
        const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenario.currency || 'COP', scenario.conversionTrm);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);
        const childrenCost = calculateChildrenCostPerUnit(si.children || [], scenario.currency, scenario.conversionTrm);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        // Include dilution in effective cost for accurate margin reverse-calc
        const totalDilutedCost = calculateTotalDilutedCost(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
        const totalNormalSub = calculateTotalNormalSubtotal(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
        const dilution = calculateDilutionPerUnit(cost, si.quantity, totalNormalSub, totalDilutedCost);
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
        const newMargin = calculateMarginFromPrice(val, effectiveLanded);

        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: newMargin });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(i => (i.id === siId ? { ...i, marginPctOverride: newMargin } : i)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateGlobalMargin = async (margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val) || !activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}/apply-margin`, { marginPct: val });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: s.scenarioItems.map(si => ({ ...si, marginPctOverride: val })) }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
            alert('No se pudo aplicar el margen global.');
        }
    };

    // ── Cálculos (delegated to pricing-engine) ────────────────
    const calculateTotals = (scenario: Scenario): ScenarioTotals => {
        return calculateScenarioTotals(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
    };

    const activeScenario = scenarios.find(s => s.id === activeScenarioId) ?? null;
    const totals: ScenarioTotals = activeScenario
        ? calculateTotals(activeScenario)
        : { beforeVat: 0, nonTaxed: 0, subtotal: 0, vat: 0, total: 0, globalMarginPct: 0 };

    return {
        loading,
        saving,
        proposal,
        proposalItems,
        scenarios,
        activeScenarioId,
        setActiveScenarioId,
        activeScenario,
        totals,
        trm,
        extraTrm,
        loadData,
        createScenario,
        deleteScenario,
        addItemToScenario,
        removeItemFromScenario,
        addChildItem,
        removeChildItem,
        updateChildQuantity,
        changeCurrency,
        updateMargin,
        updateQuantity,
        updateUnitPrice,
        updateGlobalMargin,
        toggleDilpidate,
        renameScenario,
        cloneScenario,
    };
}
```

- `ProposalCalcItem` — added `costCurrency?: string`
- `Scenario` — added `conversionTrm?: number | null`
- `calculateTotals` → passes `scenario.currency`, `scenario.conversionTrm`
- `updateUnitPrice` → uses `convertCost` for reverse margin calc

### [useDashboard.ts](file:///d:/novotechflow/apps/web/src/hooks/useDashboard.ts)

```diff:useDashboard.ts
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { calculateScenarioTotals } from '../lib/pricing-engine';
import { getTrmMonthlyAverage } from '../lib/trm-service';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType, ItemType } from '../lib/types';
import type { DateRange } from '../pages/dashboard/DashboardFilters';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
}

export interface PipelineByStatus {
    status: ProposalStatus;
    currentQuarter: number;
    nextQuarter: number;
}

type ProposalWithSubtotal = ProposalSummary & MinSubtotalResult;

export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    minSubtotalCurrency: CurrencyCode | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    originalProposal?: ProposalWithSubtotal;
    originalProjection?: BillingProjection;
}

export interface BillingCards {
    facturadoMesAnterior: number;
    facturadoMesActual: number;
    facturadoTrimestreActual: number;
    proyeccionTrimestreSiguiente: number;
    pendFactMesActual: number;
    pendFactMesSiguiente: number;
}

/** Statuses displayed in the pipeline cards. */
const PIPELINE_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA', 'GANADA', 'PERDIDA'];

/** Statuses that count towards the active forecast (not yet won/lost). */
const FORECAST_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA'];

// ── Pure helpers ─────────────────────────────────────────────

/** Find the scenario with the minimum subtotal and return its value + currency. */
function computeMinSubtotal(proposal: ProposalSummary): MinSubtotalResult {
    if (!proposal.scenarios || proposal.scenarios.length === 0) {
        return { subtotal: null, currency: null };
    }

    let minSubtotal: number | null = null;
    let minCurrency: CurrencyCode | null = null;

    for (const scenario of proposal.scenarios) {
        const totals = calculateScenarioTotals(scenario.scenarioItems);
        const sub = totals.subtotal;

        if (minSubtotal === null || sub < minSubtotal) {
            minSubtotal = sub;
            minCurrency = (scenario.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode;
        }
    }

    return { subtotal: minSubtotal, currency: minCurrency };
}

/**
 * Convert a subtotal to USD.
 * - If already in USD → return as-is.
 * - If COP and trmRate > 0 → divide.
 * - Otherwise → null.
 */
export function getSubtotalUsd(
    subtotal: number | null,
    currency: CurrencyCode | null,
    trmRate: number | null,
): number | null {
    if (subtotal === null || currency === null) return null;
    if (currency === 'USD') return subtotal;
    if (currency === 'COP' && trmRate && trmRate > 0) return subtotal / trmRate;
    return null;
}

/** Parse ISO date → { month (0-indexed), year } without timezone shift. */
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

/** Parse ISO date → { quarter (1-4), year } for pipeline grouping. */
function getQuarter(dateStr: string): { quarter: number; year: number } {
    const { month, year } = parseDate(dateStr);
    return { quarter: Math.floor(month / 3) + 1, year };
}

/** Resolve the current and next quarter numbers (1-4) and their years. */
function resolveCurrentAndNextQuarter(): {
    currentQ: number; currentQYear: number;
    nextQ: number; nextQYear: number;
} {
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    const currentQYear = now.getFullYear();
    const nextQ = currentQ === 4 ? 1 : currentQ + 1;
    const nextQYear = currentQ === 4 ? currentQYear + 1 : currentQYear;
    return { currentQ, currentQYear, nextQ, nextQYear };
}

/** Compute billing cards from already-filtered DashboardRows for one acquisition type. */
function computeBillingCards(
    rows: DashboardRow[],
    acqType: AcquisitionType,
    trmRate: number | null,
): BillingCards {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const currentQuarter = Math.floor(thisMonth / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    let facturadoMesAnterior = 0;
    let facturadoMesActual = 0;
    let facturadoTrimestreActual = 0;
    let proyeccionTrimestreSiguiente = 0;
    let pendFactMesActual = 0;
    let pendFactMesSiguiente = 0;

    const acqRows = rows.filter(r => r.acquisitionType === acqType);

    for (const row of acqRows) {
        const sub = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate) ?? 0;

        if (row.status === 'FACTURADA' && row.billingDate) {
            const { month, year } = parseDate(row.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (row.status === 'PENDIENTE_FACTURAR' && row.billingDate) {
            const { month, year } = parseDate(row.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (row.status === 'GANADA' && row.closeDate) {
            const { month, year } = parseDate(row.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
}

// ── Hook ─────────────────────────────────────────────────────

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // TRM (frontend-only, editable)
    const [trmRate, setTrmRate] = useState<number | null>(null);

    // TRM historical averages
    const [trmCurrentMonthAvg, setTrmCurrentMonthAvg] = useState<number | null>(null);
    const [trmPreviousMonthAvg, setTrmPreviousMonthAvg] = useState<number | null>(null);
    const [isLoadingTrmAverages, setIsLoadingTrmAverages] = useState(true);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());


    // Advanced filter state
    const [closeDateRange, setCloseDateRange] = useState<DateRange>({ from: '', to: '' });
    const [billingDateRange, setBillingDateRange] = useState<DateRange>({ from: '', to: '' });
    const [categoryFilter, setCategoryFilter] = useState<Set<ItemType>>(new Set());
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [subtotalUsdMin, setSubtotalUsdMin] = useState('');
    const [subtotalUsdMax, setSubtotalUsdMax] = useState('');
    const [acquisitionFilter, setAcquisitionFilter] = useState<AcquisitionType | 'ALL'>('ALL');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        fetchTrm();
        fetchTrmAverages();
    }, []);

    const loadData = async () => {
        try {
            const [proposalsRes, projectionsRes] = await Promise.all([
                api.get('/proposals'),
                api.get('/billing-projections'),
            ]);
            setProposals(proposalsRes.data);
            setProjections(projectionsRes.data);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    /** Fetch TRM once on mount as suggested default value. */
    const fetchTrm = async () => {
        try {
            const res = await fetch(TRM_API_URL);
            const data = await res.json();
            setTrmRate(data.valor ?? null);
        } catch (error) {
            console.error('Error fetching TRM:', error);
        }
    };

    /** Fetch current and previous month TRM averages in parallel. */
    const fetchTrmAverages = async () => {
        setIsLoadingTrmAverages(true);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        try {
            const [currentAvg, previousAvg] = await Promise.all([
                getTrmMonthlyAverage(currentYear, currentMonth),
                getTrmMonthlyAverage(prevYear, prevMonth),
            ]);

            setTrmCurrentMonthAvg(currentAvg);
            setTrmPreviousMonthAvg(previousAvg);
        } catch (error) {
            console.error('Error fetching TRM averages:', error);
        } finally {
            setIsLoadingTrmAverages(false);
        }
    };

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        }
    };

    // ── Computed values ──
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => {
            const { subtotal, currency } = computeMinSubtotal(p);
            return { ...p, subtotal, currency };
        });
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.subtotal,
            minSubtotalCurrency: p.currency,
            status: p.status,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            user: p.user,
            isProjection: false,
            originalProposal: p,
        }));

        const projectionRows: DashboardRow[] = projections.map(pr => ({
            id: pr.id,
            code: pr.projectionCode,
            clientName: pr.clientName,
            subject: '',
            minSubtotal: Number(pr.subtotal),
            minSubtotalCurrency: (pr.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode,
            status: pr.status as ProposalStatus,
            closeDate: null,
            billingDate: pr.billingDate,
            acquisitionType: pr.acquisitionType,
            updatedAt: pr.updatedAt,
            user: pr.user,
            isProjection: true,
            originalProjection: pr,
        }));

        return [...proposalRows, ...projectionRows];
    }, [proposalsWithSubtotals, projections]);

    /** Unique fabricante/responsable values from all proposals for autocomplete. */
    const manufacturerSuggestions = useMemo(() => {
        const values = new Set<string>();
        for (const p of proposals) {
            const scenarioItems = p.scenarios?.flatMap(s => s.scenarioItems) ?? [];
            for (const si of scenarioItems) {
                const specs = si.item.technicalSpecs;
                if (specs?.fabricante) values.add(specs.fabricante);
                if (specs?.responsable) values.add(specs.responsable);
            }
        }
        return Array.from(values).sort();
    }, [proposals]);

    const filtered = useMemo(() => {
        return allRows.filter(row => {
            // Search term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const isMatch = row.code?.toLowerCase().includes(term) ||
                    row.clientName.toLowerCase().includes(term) ||
                    row.subject.toLowerCase().includes(term);
                if (!isMatch) return false;
            }

            // Status
            if (statusFilters.size > 0 && !statusFilters.has(row.status)) return false;



            // Close date range
            if (closeDateRange.from || closeDateRange.to) {
                const raw = row.closeDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (closeDateRange.from && dateStr < closeDateRange.from) return false;
                if (closeDateRange.to && dateStr > closeDateRange.to) return false;
            }

            // Billing date range
            if (billingDateRange.from || billingDateRange.to) {
                const raw = row.billingDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (billingDateRange.from && dateStr < billingDateRange.from) return false;
                if (billingDateRange.to && dateStr > billingDateRange.to) return false;
            }

            // Category filter
            if (categoryFilter.size > 0) {
                const itemTypes = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item.itemType as ItemType) ?? [];
                const hasMatch = itemTypes.some(t => categoryFilter.has(t));
                if (!hasMatch) return false;
            }

            // Manufacturer / Responsable
            if (manufacturerFilter) {
                const term = manufacturerFilter.toLowerCase();
                const items = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item) ?? [];
                const hasMatch = items.some(item => {
                    const specs = item.technicalSpecs;
                    return specs?.fabricante?.toLowerCase().includes(term) ||
                        specs?.responsable?.toLowerCase().includes(term);
                });
                if (!hasMatch) return false;
            }

            // USD Subtotal range
            if (subtotalUsdMin || subtotalUsdMax) {
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);
                if (usd === null) return false;
                if (subtotalUsdMin && usd < parseFloat(subtotalUsdMin)) return false;
                if (subtotalUsdMax && usd > parseFloat(subtotalUsdMax)) return false;
            }

            // Acquisition type
            if (acquisitionFilter !== 'ALL' && row.acquisitionType !== acquisitionFilter) return false;

            return true;
        });
    }, [
        allRows, searchTerm, statusFilters,
        closeDateRange, billingDateRange, categoryFilter, manufacturerFilter,
        subtotalUsdMin, subtotalUsdMax, acquisitionFilter, trmRate,
    ]);

    // ── Billing summary cards per acquisition type (from filtered rows, in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(filtered, 'VENTA', trmRate),
        [filtered, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(filtered, 'DAAS', trmRate),
        [filtered, trmRate],
    );

    // ── Pipeline cards per status + forecast (from filtered rows, in USD) ──
    const { pipelineCards, forecastCurrentQuarter, forecastNextQuarter } = useMemo(() => {
        const { currentQ, currentQYear, nextQ, nextQYear } = resolveCurrentAndNextQuarter();

        const cardsByStatus: PipelineByStatus[] = PIPELINE_STATUSES.map(status => {
            let currentQuarterSum = 0;
            let nextQuarterSum = 0;

            for (const row of filtered) {
                if (row.status !== status || !row.closeDate) continue;
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate) ?? 0;
                const { quarter, year } = getQuarter(row.closeDate);

                if (quarter === currentQ && year === currentQYear) currentQuarterSum += usd;
                if (quarter === nextQ && year === nextQYear) nextQuarterSum += usd;
            }

            return { status, currentQuarter: currentQuarterSum, nextQuarter: nextQuarterSum };
        });

        const forecastCards = cardsByStatus.filter(c => FORECAST_STATUSES.includes(c.status));
        const fcCurrentQ = forecastCards.reduce((sum, c) => sum + c.currentQuarter, 0);
        const fcNextQ = forecastCards.reduce((sum, c) => sum + c.nextQuarter, 0);

        return {
            pipelineCards: cardsByStatus,
            forecastCurrentQuarter: fcCurrentQ,
            forecastNextQuarter: fcNextQ,
        };
    }, [filtered, trmRate]);

    // ── Actions ──
    const handleStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/proposals/${id}`, { status: newStatus });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = async (id: string, field: 'closeDate' | 'billingDate', value: string) => {
        try {
            await api.patch(`/proposals/${id}`, { [field]: value || null });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => {
        setCloning(id);
        try {
            await api.post(`/proposals/${id}/clone`, { cloneType });
            await loadProposals();
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloning(null);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?\n\nEsta acción no se puede deshacer. Se eliminarán todos los ítems, escenarios y datos asociados.`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    const handleAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/proposals/${id}`, { acquisitionType: value });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, acquisitionType: value } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/billing-projections/${id}`, { acquisitionType: value });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, acquisitionType: value } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/billing-projections/${id}`, { status: newStatus });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, status: newStatus as 'PENDIENTE_FACTURAR' | 'FACTURADA' } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionDateChange = async (id: string, value: string) => {
        try {
            await api.patch(`/billing-projections/${id}`, { billingDate: value || null });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, billingDate: value || null } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatusFilter = (status: ProposalStatus) => {
        setStatusFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters(new Set());
        setCloseDateRange({ from: '', to: '' });
        setBillingDateRange({ from: '', to: '' });
        setCategoryFilter(new Set());
        setManufacturerFilter('');
        setSubtotalUsdMin('');
        setSubtotalUsdMax('');
        setAcquisitionFilter('ALL');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0
        || closeDateRange.from || closeDateRange.to
        || billingDateRange.from || billingDateRange.to
        || categoryFilter.size > 0 || manufacturerFilter
        || subtotalUsdMin || subtotalUsdMax || acquisitionFilter !== 'ALL';

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
        pipelineCards,
        forecastCurrentQuarter,
        forecastNextQuarter,
        cloning,
        setProjections,
        trmRate,
        setTrmRate,
        trmCurrentMonthAvg,
        trmPreviousMonthAvg,
        isLoadingTrmAverages,

        // Filter state
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        statusFilters,
        hasActiveFilters,

        // Advanced filter state
        closeDateRange,
        setCloseDateRange,
        billingDateRange,
        setBillingDateRange,
        categoryFilter,
        setCategoryFilter,
        manufacturerFilter,
        setManufacturerFilter,
        subtotalUsdMin,
        setSubtotalUsdMin,
        subtotalUsdMax,
        setSubtotalUsdMax,
        acquisitionFilter,
        setAcquisitionFilter,
        manufacturerSuggestions,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}
===
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { calculateScenarioTotals } from '../lib/pricing-engine';
import { getTrmMonthlyAverage } from '../lib/trm-service';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType, ItemType } from '../lib/types';
import type { DateRange } from '../pages/dashboard/DashboardFilters';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
}

export interface PipelineByStatus {
    status: ProposalStatus;
    currentQuarter: number;
    nextQuarter: number;
}

type ProposalWithSubtotal = ProposalSummary & MinSubtotalResult;

export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    minSubtotalCurrency: CurrencyCode | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    originalProposal?: ProposalWithSubtotal;
    originalProjection?: BillingProjection;
}

export interface BillingCards {
    facturadoMesAnterior: number;
    facturadoMesActual: number;
    facturadoTrimestreActual: number;
    proyeccionTrimestreSiguiente: number;
    pendFactMesActual: number;
    pendFactMesSiguiente: number;
}

/** Statuses displayed in the pipeline cards. */
const PIPELINE_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA', 'GANADA', 'PERDIDA'];

/** Statuses that count towards the active forecast (not yet won/lost). */
const FORECAST_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA'];

// ── Pure helpers ─────────────────────────────────────────────

/** Find the scenario with the minimum subtotal and return its value + currency. */
function computeMinSubtotal(proposal: ProposalSummary): MinSubtotalResult {
    if (!proposal.scenarios || proposal.scenarios.length === 0) {
        return { subtotal: null, currency: null };
    }

    let minSubtotal: number | null = null;
    let minCurrency: CurrencyCode | null = null;

    for (const scenario of proposal.scenarios) {
        const totals = calculateScenarioTotals(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
        const sub = totals.subtotal;

        if (minSubtotal === null || sub < minSubtotal) {
            minSubtotal = sub;
            minCurrency = (scenario.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode;
        }
    }

    return { subtotal: minSubtotal, currency: minCurrency };
}

/**
 * Convert a subtotal to USD.
 * - If already in USD → return as-is.
 * - If COP and trmRate > 0 → divide.
 * - Otherwise → null.
 */
export function getSubtotalUsd(
    subtotal: number | null,
    currency: CurrencyCode | null,
    trmRate: number | null,
): number | null {
    if (subtotal === null || currency === null) return null;
    if (currency === 'USD') return subtotal;
    if (currency === 'COP' && trmRate && trmRate > 0) return subtotal / trmRate;
    return null;
}

/** Parse ISO date → { month (0-indexed), year } without timezone shift. */
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

/** Parse ISO date → { quarter (1-4), year } for pipeline grouping. */
function getQuarter(dateStr: string): { quarter: number; year: number } {
    const { month, year } = parseDate(dateStr);
    return { quarter: Math.floor(month / 3) + 1, year };
}

/** Resolve the current and next quarter numbers (1-4) and their years. */
function resolveCurrentAndNextQuarter(): {
    currentQ: number; currentQYear: number;
    nextQ: number; nextQYear: number;
} {
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    const currentQYear = now.getFullYear();
    const nextQ = currentQ === 4 ? 1 : currentQ + 1;
    const nextQYear = currentQ === 4 ? currentQYear + 1 : currentQYear;
    return { currentQ, currentQYear, nextQ, nextQYear };
}

/** Compute billing cards from already-filtered DashboardRows for one acquisition type. */
function computeBillingCards(
    rows: DashboardRow[],
    acqType: AcquisitionType,
    trmRate: number | null,
): BillingCards {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const currentQuarter = Math.floor(thisMonth / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    let facturadoMesAnterior = 0;
    let facturadoMesActual = 0;
    let facturadoTrimestreActual = 0;
    let proyeccionTrimestreSiguiente = 0;
    let pendFactMesActual = 0;
    let pendFactMesSiguiente = 0;

    const acqRows = rows.filter(r => r.acquisitionType === acqType);

    for (const row of acqRows) {
        const sub = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate) ?? 0;

        if (row.status === 'FACTURADA' && row.billingDate) {
            const { month, year } = parseDate(row.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (row.status === 'PENDIENTE_FACTURAR' && row.billingDate) {
            const { month, year } = parseDate(row.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (row.status === 'GANADA' && row.closeDate) {
            const { month, year } = parseDate(row.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
}

// ── Hook ─────────────────────────────────────────────────────

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // TRM (frontend-only, editable)
    const [trmRate, setTrmRate] = useState<number | null>(null);

    // TRM historical averages
    const [trmCurrentMonthAvg, setTrmCurrentMonthAvg] = useState<number | null>(null);
    const [trmPreviousMonthAvg, setTrmPreviousMonthAvg] = useState<number | null>(null);
    const [isLoadingTrmAverages, setIsLoadingTrmAverages] = useState(true);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());


    // Advanced filter state
    const [closeDateRange, setCloseDateRange] = useState<DateRange>({ from: '', to: '' });
    const [billingDateRange, setBillingDateRange] = useState<DateRange>({ from: '', to: '' });
    const [categoryFilter, setCategoryFilter] = useState<Set<ItemType>>(new Set());
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [subtotalUsdMin, setSubtotalUsdMin] = useState('');
    const [subtotalUsdMax, setSubtotalUsdMax] = useState('');
    const [acquisitionFilter, setAcquisitionFilter] = useState<AcquisitionType | 'ALL'>('ALL');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        fetchTrm();
        fetchTrmAverages();
    }, []);

    const loadData = async () => {
        try {
            const [proposalsRes, projectionsRes] = await Promise.all([
                api.get('/proposals'),
                api.get('/billing-projections'),
            ]);
            setProposals(proposalsRes.data);
            setProjections(projectionsRes.data);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    /** Fetch TRM once on mount as suggested default value. */
    const fetchTrm = async () => {
        try {
            const res = await fetch(TRM_API_URL);
            const data = await res.json();
            setTrmRate(data.valor ?? null);
        } catch (error) {
            console.error('Error fetching TRM:', error);
        }
    };

    /** Fetch current and previous month TRM averages in parallel. */
    const fetchTrmAverages = async () => {
        setIsLoadingTrmAverages(true);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        try {
            const [currentAvg, previousAvg] = await Promise.all([
                getTrmMonthlyAverage(currentYear, currentMonth),
                getTrmMonthlyAverage(prevYear, prevMonth),
            ]);

            setTrmCurrentMonthAvg(currentAvg);
            setTrmPreviousMonthAvg(previousAvg);
        } catch (error) {
            console.error('Error fetching TRM averages:', error);
        } finally {
            setIsLoadingTrmAverages(false);
        }
    };

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        }
    };

    // ── Computed values ──
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => {
            const { subtotal, currency } = computeMinSubtotal(p);
            return { ...p, subtotal, currency };
        });
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.subtotal,
            minSubtotalCurrency: p.currency,
            status: p.status,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            user: p.user,
            isProjection: false,
            originalProposal: p,
        }));

        const projectionRows: DashboardRow[] = projections.map(pr => ({
            id: pr.id,
            code: pr.projectionCode,
            clientName: pr.clientName,
            subject: '',
            minSubtotal: Number(pr.subtotal),
            minSubtotalCurrency: (pr.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode,
            status: pr.status as ProposalStatus,
            closeDate: null,
            billingDate: pr.billingDate,
            acquisitionType: pr.acquisitionType,
            updatedAt: pr.updatedAt,
            user: pr.user,
            isProjection: true,
            originalProjection: pr,
        }));

        return [...proposalRows, ...projectionRows];
    }, [proposalsWithSubtotals, projections]);

    /** Unique fabricante/responsable values from all proposals for autocomplete. */
    const manufacturerSuggestions = useMemo(() => {
        const values = new Set<string>();
        for (const p of proposals) {
            const scenarioItems = p.scenarios?.flatMap(s => s.scenarioItems) ?? [];
            for (const si of scenarioItems) {
                const specs = si.item.technicalSpecs;
                if (specs?.fabricante) values.add(specs.fabricante);
                if (specs?.responsable) values.add(specs.responsable);
            }
        }
        return Array.from(values).sort();
    }, [proposals]);

    const filtered = useMemo(() => {
        return allRows.filter(row => {
            // Search term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const isMatch = row.code?.toLowerCase().includes(term) ||
                    row.clientName.toLowerCase().includes(term) ||
                    row.subject.toLowerCase().includes(term);
                if (!isMatch) return false;
            }

            // Status
            if (statusFilters.size > 0 && !statusFilters.has(row.status)) return false;



            // Close date range
            if (closeDateRange.from || closeDateRange.to) {
                const raw = row.closeDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (closeDateRange.from && dateStr < closeDateRange.from) return false;
                if (closeDateRange.to && dateStr > closeDateRange.to) return false;
            }

            // Billing date range
            if (billingDateRange.from || billingDateRange.to) {
                const raw = row.billingDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (billingDateRange.from && dateStr < billingDateRange.from) return false;
                if (billingDateRange.to && dateStr > billingDateRange.to) return false;
            }

            // Category filter
            if (categoryFilter.size > 0) {
                const itemTypes = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item.itemType as ItemType) ?? [];
                const hasMatch = itemTypes.some(t => categoryFilter.has(t));
                if (!hasMatch) return false;
            }

            // Manufacturer / Responsable
            if (manufacturerFilter) {
                const term = manufacturerFilter.toLowerCase();
                const items = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item) ?? [];
                const hasMatch = items.some(item => {
                    const specs = item.technicalSpecs;
                    return specs?.fabricante?.toLowerCase().includes(term) ||
                        specs?.responsable?.toLowerCase().includes(term);
                });
                if (!hasMatch) return false;
            }

            // USD Subtotal range
            if (subtotalUsdMin || subtotalUsdMax) {
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);
                if (usd === null) return false;
                if (subtotalUsdMin && usd < parseFloat(subtotalUsdMin)) return false;
                if (subtotalUsdMax && usd > parseFloat(subtotalUsdMax)) return false;
            }

            // Acquisition type
            if (acquisitionFilter !== 'ALL' && row.acquisitionType !== acquisitionFilter) return false;

            return true;
        });
    }, [
        allRows, searchTerm, statusFilters,
        closeDateRange, billingDateRange, categoryFilter, manufacturerFilter,
        subtotalUsdMin, subtotalUsdMax, acquisitionFilter, trmRate,
    ]);

    // ── Billing summary cards per acquisition type (from filtered rows, in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(filtered, 'VENTA', trmRate),
        [filtered, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(filtered, 'DAAS', trmRate),
        [filtered, trmRate],
    );

    // ── Pipeline cards per status + forecast (from filtered rows, in USD) ──
    const { pipelineCards, forecastCurrentQuarter, forecastNextQuarter } = useMemo(() => {
        const { currentQ, currentQYear, nextQ, nextQYear } = resolveCurrentAndNextQuarter();

        const cardsByStatus: PipelineByStatus[] = PIPELINE_STATUSES.map(status => {
            let currentQuarterSum = 0;
            let nextQuarterSum = 0;

            for (const row of filtered) {
                if (row.status !== status || !row.closeDate) continue;
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate) ?? 0;
                const { quarter, year } = getQuarter(row.closeDate);

                if (quarter === currentQ && year === currentQYear) currentQuarterSum += usd;
                if (quarter === nextQ && year === nextQYear) nextQuarterSum += usd;
            }

            return { status, currentQuarter: currentQuarterSum, nextQuarter: nextQuarterSum };
        });

        const forecastCards = cardsByStatus.filter(c => FORECAST_STATUSES.includes(c.status));
        const fcCurrentQ = forecastCards.reduce((sum, c) => sum + c.currentQuarter, 0);
        const fcNextQ = forecastCards.reduce((sum, c) => sum + c.nextQuarter, 0);

        return {
            pipelineCards: cardsByStatus,
            forecastCurrentQuarter: fcCurrentQ,
            forecastNextQuarter: fcNextQ,
        };
    }, [filtered, trmRate]);

    // ── Actions ──
    const handleStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/proposals/${id}`, { status: newStatus });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = async (id: string, field: 'closeDate' | 'billingDate', value: string) => {
        try {
            await api.patch(`/proposals/${id}`, { [field]: value || null });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => {
        setCloning(id);
        try {
            await api.post(`/proposals/${id}/clone`, { cloneType });
            await loadProposals();
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloning(null);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?\n\nEsta acción no se puede deshacer. Se eliminarán todos los ítems, escenarios y datos asociados.`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    const handleAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/proposals/${id}`, { acquisitionType: value });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, acquisitionType: value } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/billing-projections/${id}`, { acquisitionType: value });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, acquisitionType: value } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/billing-projections/${id}`, { status: newStatus });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, status: newStatus as 'PENDIENTE_FACTURAR' | 'FACTURADA' } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionDateChange = async (id: string, value: string) => {
        try {
            await api.patch(`/billing-projections/${id}`, { billingDate: value || null });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, billingDate: value || null } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatusFilter = (status: ProposalStatus) => {
        setStatusFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters(new Set());
        setCloseDateRange({ from: '', to: '' });
        setBillingDateRange({ from: '', to: '' });
        setCategoryFilter(new Set());
        setManufacturerFilter('');
        setSubtotalUsdMin('');
        setSubtotalUsdMax('');
        setAcquisitionFilter('ALL');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0
        || closeDateRange.from || closeDateRange.to
        || billingDateRange.from || billingDateRange.to
        || categoryFilter.size > 0 || manufacturerFilter
        || subtotalUsdMin || subtotalUsdMax || acquisitionFilter !== 'ALL';

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
        pipelineCards,
        forecastCurrentQuarter,
        forecastNextQuarter,
        cloning,
        setProjections,
        trmRate,
        setTrmRate,
        trmCurrentMonthAvg,
        trmPreviousMonthAvg,
        isLoadingTrmAverages,

        // Filter state
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        statusFilters,
        hasActiveFilters,

        // Advanced filter state
        closeDateRange,
        setCloseDateRange,
        billingDateRange,
        setBillingDateRange,
        categoryFilter,
        setCategoryFilter,
        manufacturerFilter,
        setManufacturerFilter,
        subtotalUsdMin,
        setSubtotalUsdMin,
        subtotalUsdMax,
        setSubtotalUsdMax,
        acquisitionFilter,
        setAcquisitionFilter,
        manufacturerSuggestions,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}
```

- `computeMinSubtotal` → passes `scenario.currency`, `scenario.conversionTrm`

### [exportExcel.ts](file:///d:/novotechflow/apps/web/src/lib/exportExcel.ts)

```diff:exportExcel.ts
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Scenario, ProposalCalcItem } from '../hooks/useScenarios';
import { ITEM_TYPE_LABELS } from './constants';
import { calculateItemDisplayValues } from './pricing-engine';

// ── Types ──────────────────────────────────────────────
interface ExportOptions {
    proposalCode: string;
    clientName: string;
    userName: string;
    scenarios: Scenario[];
    proposalItems: ProposalCalcItem[];
    acquisitionModes: Record<string, string>;
}

// ── Brand colours matching the app ──────────────────────
const INDIGO_600 = 'FF4F46E5';
const INDIGO_50 = 'FFEEF2FF';
const SLATE_900 = 'FF0F172A';
const SLATE_50 = 'FFF8FAFC';
const EMERALD_600 = 'FF059669';
const EMERALD_50 = 'FFECFDF5';
const AMBER_600 = 'FFD97706';
const WHITE = 'FFFFFFFF';

// ── Helper: get "formato | tipo" and "fabricante | responsable" ──
function getTypeField(specs?: Record<string, string | undefined>): string {
    if (!specs) return '';
    return specs.formato || specs.tipo || '';
}

function getManufacturerField(specs?: Record<string, string | undefined>): string {
    if (!specs) return '';
    return specs.fabricante || specs.responsable || '';
}

// ── Main export function ──────────────────────────────
export async function exportToExcel(opts: ExportOptions) {
    const { proposalCode, clientName, userName, scenarios, proposalItems, acquisitionModes } = opts;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NovoTechFlow';
    wb.created = new Date();

    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
        const scenario = scenarios[sIdx];
        const sheetName = scenario.name.length > 31 ? scenario.name.substring(0, 31) : scenario.name;
        const ws = wb.addWorksheet(sheetName);

        // ── Column widths ──
        ws.columns = [
            { width: 8 },   // A - ITEM
            { width: 22 },  // B - CATEGORÍA
            { width: 35 },  // C - NOMBRE
            { width: 18 },  // D - TIPO
            { width: 18 },  // E - FABRICANTE
            { width: 40 },  // F - DESCRIPCIÓN
            { width: 10 },  // G - CANTIDAD
            { width: 18 },  // H - COSTO UNITARIO
            { width: 8 },   // I - IVA
            { width: 18 },  // J - SUBTOTAL COSTO
            { width: 20 },  // K - TOTAL COSTO + IVA
            { width: 16 },  // L - MARGEN UNITARIO
            { width: 18 },  // M - VENTA UNITARIA
            { width: 18 },  // N - SUBTOTAL VENTA
            { width: 20 },  // O - TOTAL VENTA + IVA
        ];

        // ── Acquisition mode ──
        const acqMode = acquisitionModes[scenario.id] || 'VENTA';
        const acqLabel = acqMode === 'VENTA' ? 'VENTA'
            : acqMode === 'DAAS_12' ? 'DaaS 12 Meses'
            : acqMode === 'DAAS_24' ? 'DaaS 24 Meses'
            : acqMode === 'DAAS_36' ? 'DaaS 36 Meses'
            : acqMode === 'DAAS_48' ? 'DaaS 48 Meses'
            : acqMode === 'DAAS_60' ? 'DaaS 60 Meses'
            : 'VENTA';

        // ── Header info rows ──
        const headerRows = [
            [scenario.name.toUpperCase(), ''],
            ['USUARIO', userName],
            ['COTIZACIÓN', proposalCode],
            ['CLIENTE', clientName],
            ['ADQUISICIÓN', acqLabel],
            ['MONEDA', scenario.currency || 'COP'],
        ];

        for (let r = 0; r < headerRows.length; r++) {
            const row = ws.addRow([headerRows[r][0], headerRows[r][1]]);
            const labelCell = row.getCell(1);
            const valueCell = row.getCell(2);

            labelCell.font = { bold: true, size: r === 0 ? 14 : 11, color: { argb: r === 0 ? INDIGO_600 : SLATE_900 } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 0 ? INDIGO_50 : SLATE_50 } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

            valueCell.font = { bold: r === 0, size: r === 0 ? 14 : 11, color: { argb: r === 0 ? INDIGO_600 : SLATE_900 } };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 0 ? INDIGO_50 : WHITE } };
            valueCell.alignment = { vertical: 'middle', horizontal: 'left' };

            if (r === 0) {
                ws.mergeCells(row.number, 1, row.number, 15);
                labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                ws.mergeCells(row.number, 2, row.number, 15);
            }
        }

        // Empty spacer row
        ws.addRow([]);

        // ── Table header ──
        const TABLE_HEADERS = [
            'ITEM', 'CATEGORÍA', 'NOMBRE', 'TIPO', 'FABRICANTE',
            'DESCRIPCIÓN', 'CANT.', 'COSTO UNIT.', 'IVA',
            'SUBTOTAL COSTO', 'TOTAL COSTO + IVA',
            'MARGEN UNIT.', 'VENTA UNIT.',
            'SUBTOTAL VENTA', 'TOTAL VENTA + IVA',
        ];

        const headerRow = ws.addRow(TABLE_HEADERS);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 9, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: INDIGO_600 } },
                bottom: { style: 'thin', color: { argb: INDIGO_600 } },
                left:   { style: 'thin', color: { argb: INDIGO_600 } },
                right:  { style: 'thin', color: { argb: INDIGO_600 } },
            };
        });

        // ── Data rows (only visible/normal items) ──
        const normalItems = scenario.scenarioItems.filter(i => !i.isDilpidate);

        normalItems
            .sort((a, b) => {
                const aIdx = proposalItems.findIndex(pi => pi.id === a.itemId);
                const bIdx = proposalItems.findIndex(pi => pi.id === b.itemId);
                return aIdx - bIdx;
            })
            .forEach((si, idx) => {
                const item = si.item;
                const piFromArchitect = proposalItems.find(pi => pi.id === si.itemId);
                const globalItemIdx = proposalItems.findIndex(pi => pi.id === si.itemId);
                const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;

                // ── Delegate all cost calculations to pricing engine ──
                const dv = calculateItemDisplayValues(si, scenario.scenarioItems);

                const ivaPct = item.isTaxable ? 19 : 0;
                const ivaMultiplier = 1 + ivaPct / 100;
                const subtotalCost = dv.effectiveLandedCost * si.quantity;
                const totalCostConIva = subtotalCost * ivaMultiplier;
                const subtotalVenta = dv.unitPrice * si.quantity;
                const totalVentaConIva = subtotalVenta * ivaMultiplier;

                // Source data from ITEMS_ARCHITECT
                const specs = piFromArchitect?.technicalSpecs || item.technicalSpecs;
                const categoryLabel = ITEM_TYPE_LABELS[item.itemType] || item.itemType;
                const tipoField = getTypeField(specs);
                const fabricanteField = getManufacturerField(specs);
                const descriptionField = piFromArchitect?.description || (item as unknown as { description?: string }).description || '';

                const dataRow = ws.addRow([
                    displayIdx,
                    categoryLabel,
                    item.name,
                    tipoField,
                    fabricanteField,
                    descriptionField,
                    si.quantity,
                    dv.effectiveLandedCost,
                    `${ivaPct}%`,
                    subtotalCost,
                    totalCostConIva,
                    `${dv.margin.toFixed(2)}%`,
                    dv.unitPrice,
                    subtotalVenta,
                    totalVentaConIva,
                ]);

                const isEvenRow = idx % 2 === 0;
                dataRow.eachCell((cell, colNumber) => {
                    cell.font = { size: 10, color: { argb: SLATE_900 } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? WHITE : SLATE_50 } };
                    cell.border = {
                        top:    { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        left:   { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
                    };
                    cell.alignment = { vertical: 'middle', wrapText: colNumber === 6 };

                    // Numeric columns: right alignment + currency format
                    if ([8, 10, 11, 13, 14, 15].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '"$"#,##0.00';
                    }
                    // Center columns
                    if ([1, 7, 9, 12].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    // Color highlights
                    if (colNumber === 8 || colNumber === 10 || colNumber === 11) {
                        // Cost columns: amber tint
                        cell.font = { size: 10, color: { argb: AMBER_600 }, bold: colNumber === 11 };
                    }
                    if (colNumber === 13 || colNumber === 14 || colNumber === 15) {
                        // Sales columns: emerald tint
                        cell.font = { size: 10, color: { argb: EMERALD_600 }, bold: colNumber === 15 };
                    }
                    if (colNumber === 12) {
                        // Margin: indigo
                        cell.font = { size: 10, color: { argb: INDIGO_600 }, bold: true };
                    }
                });
            });

        // ── Totals row ──
        const totalsStartRow = headerRow.number + 1;
        const totalsEndRow = headerRow.number + normalItems.length;

        if (normalItems.length > 0) {
            ws.addRow([]); // spacer
            const sumRow = ws.addRow([
                '', '', '', '', '', 'TOTALES', '', '', '', '',
                '', '', '', '', '',
            ]);

            // Sum formulas for numeric columns
            const sumColumns = [
                { col: 10, letter: 'J' }, // SUBTOTAL COSTO
                { col: 11, letter: 'K' }, // TOTAL COSTO + IVA
                { col: 14, letter: 'N' }, // SUBTOTAL VENTA
                { col: 15, letter: 'O' }, // TOTAL VENTA + IVA
            ];

            const labelCell = sumRow.getCell(6);
            labelCell.font = { bold: true, size: 11, color: { argb: WHITE } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_600 } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

            sumColumns.forEach(({ col, letter }) => {
                const cell = sumRow.getCell(col);
                cell.value = { formula: `SUM(${letter}${totalsStartRow}:${letter}${totalsEndRow})` };
                cell.numFmt = '"$"#,##0.00';
                cell.font = { bold: true, size: 11, color: { argb: col <= 11 ? AMBER_600 : EMERALD_600 } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col <= 11 ? 'FFFFFBEB' : EMERALD_50 } };
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                cell.border = {
                    top:    { style: 'medium', color: { argb: INDIGO_600 } },
                    bottom: { style: 'medium', color: { argb: INDIGO_600 } },
                };
            });

            // Style remaining cells in sum row
            for (let c = 1; c <= 15; c++) {
                if (c !== 6 && ![10, 11, 14, 15].includes(c)) {
                    const cell = sumRow.getCell(c);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_50 } };
                    cell.border = {
                        top:    { style: 'medium', color: { argb: INDIGO_600 } },
                        bottom: { style: 'medium', color: { argb: INDIGO_600 } },
                    };
                }
            }
        }

        // Freeze panes: first row + header
        ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 0 }];
    }

    // ── Generate and download ──
    const fileName = `${proposalCode}_${clientName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
===
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { Scenario, ProposalCalcItem } from '../hooks/useScenarios';
import { ITEM_TYPE_LABELS } from './constants';
import { calculateItemDisplayValues } from './pricing-engine';

// ── Types ──────────────────────────────────────────────
interface ExportOptions {
    proposalCode: string;
    clientName: string;
    userName: string;
    scenarios: Scenario[];
    proposalItems: ProposalCalcItem[];
    acquisitionModes: Record<string, string>;
}

// ── Brand colours matching the app ──────────────────────
const INDIGO_600 = 'FF4F46E5';
const INDIGO_50 = 'FFEEF2FF';
const SLATE_900 = 'FF0F172A';
const SLATE_50 = 'FFF8FAFC';
const EMERALD_600 = 'FF059669';
const EMERALD_50 = 'FFECFDF5';
const AMBER_600 = 'FFD97706';
const WHITE = 'FFFFFFFF';

// ── Helper: get "formato | tipo" and "fabricante | responsable" ──
function getTypeField(specs?: Record<string, string | undefined>): string {
    if (!specs) return '';
    return specs.formato || specs.tipo || '';
}

function getManufacturerField(specs?: Record<string, string | undefined>): string {
    if (!specs) return '';
    return specs.fabricante || specs.responsable || '';
}

// ── Main export function ──────────────────────────────
export async function exportToExcel(opts: ExportOptions) {
    const { proposalCode, clientName, userName, scenarios, proposalItems, acquisitionModes } = opts;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NovoTechFlow';
    wb.created = new Date();

    for (let sIdx = 0; sIdx < scenarios.length; sIdx++) {
        const scenario = scenarios[sIdx];
        const sheetName = scenario.name.length > 31 ? scenario.name.substring(0, 31) : scenario.name;
        const ws = wb.addWorksheet(sheetName);

        // ── Column widths ──
        ws.columns = [
            { width: 8 },   // A - ITEM
            { width: 22 },  // B - CATEGORÍA
            { width: 35 },  // C - NOMBRE
            { width: 18 },  // D - TIPO
            { width: 18 },  // E - FABRICANTE
            { width: 40 },  // F - DESCRIPCIÓN
            { width: 10 },  // G - CANTIDAD
            { width: 18 },  // H - COSTO UNITARIO
            { width: 8 },   // I - IVA
            { width: 18 },  // J - SUBTOTAL COSTO
            { width: 20 },  // K - TOTAL COSTO + IVA
            { width: 16 },  // L - MARGEN UNITARIO
            { width: 18 },  // M - VENTA UNITARIA
            { width: 18 },  // N - SUBTOTAL VENTA
            { width: 20 },  // O - TOTAL VENTA + IVA
        ];

        // ── Acquisition mode ──
        const acqMode = acquisitionModes[scenario.id] || 'VENTA';
        const acqLabel = acqMode === 'VENTA' ? 'VENTA'
            : acqMode === 'DAAS_12' ? 'DaaS 12 Meses'
            : acqMode === 'DAAS_24' ? 'DaaS 24 Meses'
            : acqMode === 'DAAS_36' ? 'DaaS 36 Meses'
            : acqMode === 'DAAS_48' ? 'DaaS 48 Meses'
            : acqMode === 'DAAS_60' ? 'DaaS 60 Meses'
            : 'VENTA';

        // ── Header info rows ──
        const headerRows = [
            [scenario.name.toUpperCase(), ''],
            ['USUARIO', userName],
            ['COTIZACIÓN', proposalCode],
            ['CLIENTE', clientName],
            ['ADQUISICIÓN', acqLabel],
            ['MONEDA', scenario.currency || 'COP'],
        ];

        for (let r = 0; r < headerRows.length; r++) {
            const row = ws.addRow([headerRows[r][0], headerRows[r][1]]);
            const labelCell = row.getCell(1);
            const valueCell = row.getCell(2);

            labelCell.font = { bold: true, size: r === 0 ? 14 : 11, color: { argb: r === 0 ? INDIGO_600 : SLATE_900 } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 0 ? INDIGO_50 : SLATE_50 } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

            valueCell.font = { bold: r === 0, size: r === 0 ? 14 : 11, color: { argb: r === 0 ? INDIGO_600 : SLATE_900 } };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 0 ? INDIGO_50 : WHITE } };
            valueCell.alignment = { vertical: 'middle', horizontal: 'left' };

            if (r === 0) {
                ws.mergeCells(row.number, 1, row.number, 15);
                labelCell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else {
                ws.mergeCells(row.number, 2, row.number, 15);
            }
        }

        // Empty spacer row
        ws.addRow([]);

        // ── Table header ──
        const TABLE_HEADERS = [
            'ITEM', 'CATEGORÍA', 'NOMBRE', 'TIPO', 'FABRICANTE',
            'DESCRIPCIÓN', 'CANT.', 'COSTO UNIT.', 'IVA',
            'SUBTOTAL COSTO', 'TOTAL COSTO + IVA',
            'MARGEN UNIT.', 'VENTA UNIT.',
            'SUBTOTAL VENTA', 'TOTAL VENTA + IVA',
        ];

        const headerRow = ws.addRow(TABLE_HEADERS);
        headerRow.height = 28;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, size: 9, color: { argb: WHITE } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_900 } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: INDIGO_600 } },
                bottom: { style: 'thin', color: { argb: INDIGO_600 } },
                left:   { style: 'thin', color: { argb: INDIGO_600 } },
                right:  { style: 'thin', color: { argb: INDIGO_600 } },
            };
        });

        // ── Data rows (only visible/normal items) ──
        const normalItems = scenario.scenarioItems.filter(i => !i.isDilpidate);

        normalItems
            .sort((a, b) => {
                const aIdx = proposalItems.findIndex(pi => pi.id === a.itemId);
                const bIdx = proposalItems.findIndex(pi => pi.id === b.itemId);
                return aIdx - bIdx;
            })
            .forEach((si, idx) => {
                const item = si.item;
                const piFromArchitect = proposalItems.find(pi => pi.id === si.itemId);
                const globalItemIdx = proposalItems.findIndex(pi => pi.id === si.itemId);
                const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;

                // ── Delegate all cost calculations to pricing engine ──
                const dv = calculateItemDisplayValues(si, scenario.scenarioItems, scenario.currency, scenario.conversionTrm);

                const ivaPct = item.isTaxable ? 19 : 0;
                const ivaMultiplier = 1 + ivaPct / 100;
                const subtotalCost = dv.effectiveLandedCost * si.quantity;
                const totalCostConIva = subtotalCost * ivaMultiplier;
                const subtotalVenta = dv.unitPrice * si.quantity;
                const totalVentaConIva = subtotalVenta * ivaMultiplier;

                // Source data from ITEMS_ARCHITECT
                const specs = piFromArchitect?.technicalSpecs || item.technicalSpecs;
                const categoryLabel = ITEM_TYPE_LABELS[item.itemType] || item.itemType;
                const tipoField = getTypeField(specs);
                const fabricanteField = getManufacturerField(specs);
                const descriptionField = piFromArchitect?.description || (item as unknown as { description?: string }).description || '';

                const dataRow = ws.addRow([
                    displayIdx,
                    categoryLabel,
                    item.name,
                    tipoField,
                    fabricanteField,
                    descriptionField,
                    si.quantity,
                    dv.effectiveLandedCost,
                    `${ivaPct}%`,
                    subtotalCost,
                    totalCostConIva,
                    `${dv.margin.toFixed(2)}%`,
                    dv.unitPrice,
                    subtotalVenta,
                    totalVentaConIva,
                ]);

                const isEvenRow = idx % 2 === 0;
                dataRow.eachCell((cell, colNumber) => {
                    cell.font = { size: 10, color: { argb: SLATE_900 } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEvenRow ? WHITE : SLATE_50 } };
                    cell.border = {
                        top:    { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        left:   { style: 'hair', color: { argb: 'FFE2E8F0' } },
                        right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
                    };
                    cell.alignment = { vertical: 'middle', wrapText: colNumber === 6 };

                    // Numeric columns: right alignment + currency format
                    if ([8, 10, 11, 13, 14, 15].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '"$"#,##0.00';
                    }
                    // Center columns
                    if ([1, 7, 9, 12].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }

                    // Color highlights
                    if (colNumber === 8 || colNumber === 10 || colNumber === 11) {
                        // Cost columns: amber tint
                        cell.font = { size: 10, color: { argb: AMBER_600 }, bold: colNumber === 11 };
                    }
                    if (colNumber === 13 || colNumber === 14 || colNumber === 15) {
                        // Sales columns: emerald tint
                        cell.font = { size: 10, color: { argb: EMERALD_600 }, bold: colNumber === 15 };
                    }
                    if (colNumber === 12) {
                        // Margin: indigo
                        cell.font = { size: 10, color: { argb: INDIGO_600 }, bold: true };
                    }
                });
            });

        // ── Totals row ──
        const totalsStartRow = headerRow.number + 1;
        const totalsEndRow = headerRow.number + normalItems.length;

        if (normalItems.length > 0) {
            ws.addRow([]); // spacer
            const sumRow = ws.addRow([
                '', '', '', '', '', 'TOTALES', '', '', '', '',
                '', '', '', '', '',
            ]);

            // Sum formulas for numeric columns
            const sumColumns = [
                { col: 10, letter: 'J' }, // SUBTOTAL COSTO
                { col: 11, letter: 'K' }, // TOTAL COSTO + IVA
                { col: 14, letter: 'N' }, // SUBTOTAL VENTA
                { col: 15, letter: 'O' }, // TOTAL VENTA + IVA
            ];

            const labelCell = sumRow.getCell(6);
            labelCell.font = { bold: true, size: 11, color: { argb: WHITE } };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_600 } };
            labelCell.alignment = { vertical: 'middle', horizontal: 'right' };

            sumColumns.forEach(({ col, letter }) => {
                const cell = sumRow.getCell(col);
                cell.value = { formula: `SUM(${letter}${totalsStartRow}:${letter}${totalsEndRow})` };
                cell.numFmt = '"$"#,##0.00';
                cell.font = { bold: true, size: 11, color: { argb: col <= 11 ? AMBER_600 : EMERALD_600 } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col <= 11 ? 'FFFFFBEB' : EMERALD_50 } };
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                cell.border = {
                    top:    { style: 'medium', color: { argb: INDIGO_600 } },
                    bottom: { style: 'medium', color: { argb: INDIGO_600 } },
                };
            });

            // Style remaining cells in sum row
            for (let c = 1; c <= 15; c++) {
                if (c !== 6 && ![10, 11, 14, 15].includes(c)) {
                    const cell = sumRow.getCell(c);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INDIGO_50 } };
                    cell.border = {
                        top:    { style: 'medium', color: { argb: INDIGO_600 } },
                        bottom: { style: 'medium', color: { argb: INDIGO_600 } },
                    };
                }
            }
        }

        // Freeze panes: first row + header
        ws.views = [{ state: 'frozen', ySplit: headerRow.number, xSplit: 0 }];
    }

    // ── Generate and download ──
    const fileName = `${proposalCode}_${clientName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
```

- `calculateItemDisplayValues` call → passes `scenario.currency`, `scenario.conversionTrm`

### [ProposalCalculations.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalCalculations.tsx)

```diff:ProposalCalculations.tsx
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calculator, Loader2, Package,
    ArrowLeft, RotateCcw, Layers, BookOpen, FileSpreadsheet
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScenarios, type ProposalCalcItem } from '../../hooks/useScenarios';
import ItemPickerModal from '../../components/proposals/ItemPickerModal';
import ScenarioTotalsCards from '../../components/proposals/ScenarioTotalsCards';
import { exportToExcel } from '../../lib/exportExcel';
import { useAuthStore } from '../../store/authStore';
import { calculateItemDisplayValues } from '../../lib/pricing-engine';
import { type AcquisitionMode } from '../../lib/constants';
import { resolveMargin } from '../../lib/pricing-engine';
import ScenarioItemRow from './components/ScenarioItemRow';
import ScenarioSidebar from './components/ScenarioSidebar';
import ScenarioHeader from './components/ScenarioHeader';

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, proposal, proposalItems, scenarios,
        activeScenarioId, setActiveScenarioId, activeScenario, totals,
        trm, extraTrm, loadData,
        createScenario, deleteScenario,
        addItemToScenario, removeItemFromScenario,
        addChildItem, removeChildItem, updateChildQuantity,
        changeCurrency, updateMargin, updateQuantity,
        updateUnitPrice, updateGlobalMargin, toggleDilpidate,
        renameScenario,
        cloneScenario,
    } = useScenarios(id);

    // UI-only state
    const [isPickingItems, setIsPickingItems] = useState(false);
    const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);
    const [globalMarginBuffer, setGlobalMarginBuffer] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [pickingChildrenFor, setPickingChildrenFor] = useState<string | null>(null);

    // ── Acquisition mode per scenario (VENTA / DAAS) ──
    const [acquisitionModes, setAcquisitionModes] = useState<Record<string, AcquisitionMode>>({});
    const savedMarginsRef = useRef<Record<string, { global: number; items: Record<string, number> }>>({});

    const isDaasMode = (scenarioId: string | null) => {
        if (!scenarioId) return false;
        return (acquisitionModes[scenarioId] || 'VENTA') !== 'VENTA';
    };

    const handleAcquisitionChange = async (newMode: AcquisitionMode) => {
        if (!activeScenarioId || !activeScenario) return;
        const currentMode = acquisitionModes[activeScenarioId] || 'VENTA';
        if (newMode === currentMode) return;

        if (newMode !== 'VENTA' && currentMode === 'VENTA') {
            // Switching TO DaaS → save current margins, then set all to 0
            const marginSnapshot: Record<string, number> = {};
            activeScenario.scenarioItems.forEach(si => {
                const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
                marginSnapshot[si.id!] = margin;
            });
            savedMarginsRef.current[activeScenarioId] = {
                global: totals.globalMarginPct,
                items: marginSnapshot,
            };
            await updateGlobalMargin('0');
        } else if (newMode === 'VENTA' && currentMode !== 'VENTA') {
            // Switching BACK to VENTA → restore saved margins
            const saved = savedMarginsRef.current[activeScenarioId];
            if (saved) {
                for (const [siId, margin] of Object.entries(saved.items)) {
                    await updateMargin(siId, margin.toString());
                }
                delete savedMarginsRef.current[activeScenarioId];
            }
        }
        // Switching between DaaS modes — margins stay at 0, just update the mode

        setAcquisitionModes(prev => ({ ...prev, [activeScenarioId]: newMode }));
    };

    const toggleExpandItem = (siId: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(siId)) next.delete(siId);
            else next.add(siId);
            return next;
        });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate(`/proposals/${id}/builder`)}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                            <Calculator className="h-8 w-8 mr-3 text-indigo-600" />
                            Ventana de Cálculos
                        </h2>
                        <div className="flex items-center space-x-4 mt-1">
                            <p className="text-slate-500 text-sm font-medium">Modelación de Escenarios y Proyecciones Financieras</p>
                            {trm && (
                                <div className="flex items-center space-x-4 bg-emerald-50 px-6 py-4 rounded-[2rem] border-2 border-emerald-200 shadow-xl ml-6">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <div className="flex flex-col justify-center">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-2xl font-black text-emerald-900 leading-none">
                                                ${trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-tighter">TRM USD/COP</span>
                                        </div>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em]">
                                                Vigencia Oficial:
                                            </span>
                                            <span className="text-[11px] font-bold text-indigo-600">
                                                {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={loadData}
                                        disabled={loading}
                                        className="p-3 bg-white hover:bg-emerald-100 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                        title="Actualizar TRM"
                                    >
                                        <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                                    </button>
                                    
                                    {(extraTrm?.setIcapAverage || extraTrm?.wilkinsonSpot) && (
                                        <>
                                            <div className="w-px h-10 bg-emerald-200 mx-2 hidden md:block"></div>
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">Dólar Mañana (Est.)</span>
                                                <div className="flex items-baseline space-x-3">
                                                    {extraTrm.setIcapAverage && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.setIcapAverage.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SET-ICAP</span>
                                                        </div>
                                                    )}
                                                    {extraTrm.wilkinsonSpot && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.wilkinsonSpot.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SPOT</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Propuesta No.</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* Navigation to Document Builder + Export */}
            <div className="flex justify-end space-x-3">
                <button 
                    onClick={async () => {
                        const { user } = useAuthStore.getState();
                        await exportToExcel({
                            proposalCode: proposal.proposalCode,
                            clientName: proposal.clientName,
                            userName: user?.name || 'Usuario',
                            scenarios,
                            proposalItems,
                            acquisitionModes,
                        });
                    }}
                    disabled={scenarios.length === 0}
                    className="flex items-center space-x-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Exportar Excel</span>
                </button>
                <button 
                    onClick={() => navigate(`/proposals/${id}/document`)}
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                    <BookOpen className="h-4 w-4" />
                    <span>Construir Documento</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar de Escenarios */}
                <ScenarioSidebar
                    scenarios={scenarios}
                    activeScenarioId={activeScenarioId}
                    saving={saving}
                    setActiveScenarioId={setActiveScenarioId}
                    createScenario={createScenario}
                    deleteScenario={deleteScenario}
                    cloneScenario={cloneScenario}
                />

                {/* Contenido Principal */}
                <div className="lg:col-span-9 space-y-6">
                    {activeScenario ? (
                        <>
                            {/* Editor de Escenario */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
                                <ScenarioHeader
                                    activeScenario={activeScenario}
                                    totals={totals}
                                    activeScenarioId={activeScenarioId}
                                    isDaasMode={isDaasMode(activeScenarioId)}
                                    acquisitionModes={acquisitionModes}
                                    globalMarginBuffer={globalMarginBuffer}
                                    setGlobalMarginBuffer={setGlobalMarginBuffer}
                                    updateGlobalMargin={updateGlobalMargin}
                                    handleAcquisitionChange={handleAcquisitionChange}
                                    changeCurrency={changeCurrency}
                                    renameScenario={renameScenario}
                                    setIsPickingItems={setIsPickingItems}
                                />

                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-y border-slate-100">
                                            <tr>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant.</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Margen (%)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unitario ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] text-center" title="Diluir el costo de este ítem entre los demás">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <Layers className="h-3 w-3" />
                                                        <span>Diluir</span>
                                                    </div>
                                                </th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {activeScenario.scenarioItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-8 py-24 text-center">
                                                        <div className="max-w-xs mx-auto space-y-4 opacity-30 grayscale">
                                                            <Package className="h-16 w-16 mx-auto text-slate-400" />
                                                            <p className="text-sm font-bold text-slate-500">No hay ítems en este escenario. Realice un picking para empezar.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                [...activeScenario.scenarioItems]
                                                    .sort((a, b) => {
                                                        if (a.isDilpidate && !b.isDilpidate) return -1;
                                                        if (!a.isDilpidate && b.isDilpidate) return 1;
                                                        return 0;
                                                    })
                                                    .map((si, idx) => {
                                                    const displayValues = calculateItemDisplayValues(si, activeScenario.scenarioItems);
                                                    const item = si.item;
                                                    const globalItemIdx = proposal?.proposalItems.findIndex((pi: ProposalCalcItem) => pi.id === si.itemId) ?? -1;
                                                    const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;

                                                    return (
                                                        <ScenarioItemRow
                                                            key={si.id}
                                                            si={si}
                                                            item={item}
                                                            displayValues={displayValues}
                                                            displayIdx={displayIdx}
                                                            editingCell={editingCell}
                                                            setEditingCell={setEditingCell}
                                                            isExpanded={expandedItems.has(si.id!)}
                                                            isDaasMode={isDaasMode(activeScenarioId)}
                                                            toggleExpandItem={toggleExpandItem}
                                                            updateQuantity={updateQuantity}
                                                            updateMargin={updateMargin}
                                                            updateUnitPrice={updateUnitPrice}
                                                            toggleDilpidate={toggleDilpidate}
                                                            removeItemFromScenario={removeItemFromScenario}
                                                            updateChildQuantity={updateChildQuantity}
                                                            removeChildItem={removeChildItem}
                                                            setPickingChildrenFor={setPickingChildrenFor}
                                                            proposal={proposal}
                                                        />
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <ScenarioTotalsCards totals={totals} currency={activeScenario.currency} />
                        </>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                             <Calculator className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                             <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">Seleccione o cree un escenario para modelar costos.</h4>
                        </div>
                    )}
                </div>
            </div>

            <ItemPickerModal
                isOpen={isPickingItems}
                onClose={() => setIsPickingItems(false)}
                proposalItems={proposalItems}
                scenarioItems={activeScenario?.scenarioItems}
                onAddItem={addItemToScenario}
            />

            {/* Child item picker — filters out the parent itself and items already added as children */}
            <ItemPickerModal
                isOpen={pickingChildrenFor !== null}
                onClose={() => setPickingChildrenFor(null)}
                proposalItems={proposalItems.filter(pi => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    if (!parentSi) return true;
                    if (pi.id === parentSi.itemId) return false;
                    return true;
                })}
                scenarioItems={(() => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    return parentSi?.children?.map(c => ({ ...c, itemId: c.itemId })) || [];
                })()}
                onAddItem={(itemId) => {
                    if (pickingChildrenFor) {
                        addChildItem(pickingChildrenFor, itemId);
                    }
                }}
            />
        </div>
    );
}
===
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calculator, Loader2, Package,
    ArrowLeft, RotateCcw, Layers, BookOpen, FileSpreadsheet
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScenarios, type ProposalCalcItem } from '../../hooks/useScenarios';
import ItemPickerModal from '../../components/proposals/ItemPickerModal';
import ScenarioTotalsCards from '../../components/proposals/ScenarioTotalsCards';
import { exportToExcel } from '../../lib/exportExcel';
import { useAuthStore } from '../../store/authStore';
import { calculateItemDisplayValues } from '../../lib/pricing-engine';
import { type AcquisitionMode } from '../../lib/constants';
import { resolveMargin } from '../../lib/pricing-engine';
import ScenarioItemRow from './components/ScenarioItemRow';
import ScenarioSidebar from './components/ScenarioSidebar';
import ScenarioHeader from './components/ScenarioHeader';

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, proposal, proposalItems, scenarios,
        activeScenarioId, setActiveScenarioId, activeScenario, totals,
        trm, extraTrm, loadData,
        createScenario, deleteScenario,
        addItemToScenario, removeItemFromScenario,
        addChildItem, removeChildItem, updateChildQuantity,
        changeCurrency, updateMargin, updateQuantity,
        updateUnitPrice, updateGlobalMargin, toggleDilpidate,
        renameScenario,
        cloneScenario,
    } = useScenarios(id);

    // UI-only state
    const [isPickingItems, setIsPickingItems] = useState(false);
    const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);
    const [globalMarginBuffer, setGlobalMarginBuffer] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [pickingChildrenFor, setPickingChildrenFor] = useState<string | null>(null);

    // ── Acquisition mode per scenario (VENTA / DAAS) ──
    const [acquisitionModes, setAcquisitionModes] = useState<Record<string, AcquisitionMode>>({});
    const savedMarginsRef = useRef<Record<string, { global: number; items: Record<string, number> }>>({});

    const isDaasMode = (scenarioId: string | null) => {
        if (!scenarioId) return false;
        return (acquisitionModes[scenarioId] || 'VENTA') !== 'VENTA';
    };

    const handleAcquisitionChange = async (newMode: AcquisitionMode) => {
        if (!activeScenarioId || !activeScenario) return;
        const currentMode = acquisitionModes[activeScenarioId] || 'VENTA';
        if (newMode === currentMode) return;

        if (newMode !== 'VENTA' && currentMode === 'VENTA') {
            // Switching TO DaaS → save current margins, then set all to 0
            const marginSnapshot: Record<string, number> = {};
            activeScenario.scenarioItems.forEach(si => {
                const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
                marginSnapshot[si.id!] = margin;
            });
            savedMarginsRef.current[activeScenarioId] = {
                global: totals.globalMarginPct,
                items: marginSnapshot,
            };
            await updateGlobalMargin('0');
        } else if (newMode === 'VENTA' && currentMode !== 'VENTA') {
            // Switching BACK to VENTA → restore saved margins
            const saved = savedMarginsRef.current[activeScenarioId];
            if (saved) {
                for (const [siId, margin] of Object.entries(saved.items)) {
                    await updateMargin(siId, margin.toString());
                }
                delete savedMarginsRef.current[activeScenarioId];
            }
        }
        // Switching between DaaS modes — margins stay at 0, just update the mode

        setAcquisitionModes(prev => ({ ...prev, [activeScenarioId]: newMode }));
    };

    const toggleExpandItem = (siId: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(siId)) next.delete(siId);
            else next.add(siId);
            return next;
        });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate(`/proposals/${id}/builder`)}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                            <Calculator className="h-8 w-8 mr-3 text-indigo-600" />
                            Ventana de Cálculos
                        </h2>
                        <div className="flex items-center space-x-4 mt-1">
                            <p className="text-slate-500 text-sm font-medium">Modelación de Escenarios y Proyecciones Financieras</p>
                            {trm && (
                                <div className="flex items-center space-x-4 bg-emerald-50 px-6 py-4 rounded-[2rem] border-2 border-emerald-200 shadow-xl ml-6">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <div className="flex flex-col justify-center">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-2xl font-black text-emerald-900 leading-none">
                                                ${trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-tighter">TRM USD/COP</span>
                                        </div>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em]">
                                                Vigencia Oficial:
                                            </span>
                                            <span className="text-[11px] font-bold text-indigo-600">
                                                {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={loadData}
                                        disabled={loading}
                                        className="p-3 bg-white hover:bg-emerald-100 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                        title="Actualizar TRM"
                                    >
                                        <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                                    </button>
                                    
                                    {(extraTrm?.setIcapAverage || extraTrm?.wilkinsonSpot) && (
                                        <>
                                            <div className="w-px h-10 bg-emerald-200 mx-2 hidden md:block"></div>
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">Dólar Mañana (Est.)</span>
                                                <div className="flex items-baseline space-x-3">
                                                    {extraTrm.setIcapAverage && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.setIcapAverage.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SET-ICAP</span>
                                                        </div>
                                                    )}
                                                    {extraTrm.wilkinsonSpot && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.wilkinsonSpot.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SPOT</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Propuesta No.</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* Navigation to Document Builder + Export */}
            <div className="flex justify-end space-x-3">
                <button 
                    onClick={async () => {
                        const { user } = useAuthStore.getState();
                        await exportToExcel({
                            proposalCode: proposal.proposalCode,
                            clientName: proposal.clientName,
                            userName: user?.name || 'Usuario',
                            scenarios,
                            proposalItems,
                            acquisitionModes,
                        });
                    }}
                    disabled={scenarios.length === 0}
                    className="flex items-center space-x-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Exportar Excel</span>
                </button>
                <button 
                    onClick={() => navigate(`/proposals/${id}/document`)}
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                    <BookOpen className="h-4 w-4" />
                    <span>Construir Documento</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar de Escenarios */}
                <ScenarioSidebar
                    scenarios={scenarios}
                    activeScenarioId={activeScenarioId}
                    saving={saving}
                    setActiveScenarioId={setActiveScenarioId}
                    createScenario={createScenario}
                    deleteScenario={deleteScenario}
                    cloneScenario={cloneScenario}
                />

                {/* Contenido Principal */}
                <div className="lg:col-span-9 space-y-6">
                    {activeScenario ? (
                        <>
                            {/* Editor de Escenario */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
                                <ScenarioHeader
                                    activeScenario={activeScenario}
                                    totals={totals}
                                    activeScenarioId={activeScenarioId}
                                    isDaasMode={isDaasMode(activeScenarioId)}
                                    acquisitionModes={acquisitionModes}
                                    globalMarginBuffer={globalMarginBuffer}
                                    setGlobalMarginBuffer={setGlobalMarginBuffer}
                                    updateGlobalMargin={updateGlobalMargin}
                                    handleAcquisitionChange={handleAcquisitionChange}
                                    changeCurrency={changeCurrency}
                                    renameScenario={renameScenario}
                                    setIsPickingItems={setIsPickingItems}
                                />

                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-y border-slate-100">
                                            <tr>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant.</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Margen (%)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unitario ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] text-center" title="Diluir el costo de este ítem entre los demás">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <Layers className="h-3 w-3" />
                                                        <span>Diluir</span>
                                                    </div>
                                                </th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {activeScenario.scenarioItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-8 py-24 text-center">
                                                        <div className="max-w-xs mx-auto space-y-4 opacity-30 grayscale">
                                                            <Package className="h-16 w-16 mx-auto text-slate-400" />
                                                            <p className="text-sm font-bold text-slate-500">No hay ítems en este escenario. Realice un picking para empezar.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                [...activeScenario.scenarioItems]
                                                    .sort((a, b) => {
                                                        if (a.isDilpidate && !b.isDilpidate) return -1;
                                                        if (!a.isDilpidate && b.isDilpidate) return 1;
                                                        return 0;
                                                    })
                                                    .map((si, idx) => {
                                                    const displayValues = calculateItemDisplayValues(si, activeScenario.scenarioItems, activeScenario.currency, activeScenario.conversionTrm);
                                                    const item = si.item;
                                                    const globalItemIdx = proposal?.proposalItems.findIndex((pi: ProposalCalcItem) => pi.id === si.itemId) ?? -1;
                                                    const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;

                                                    return (
                                                        <ScenarioItemRow
                                                            key={si.id}
                                                            si={si}
                                                            item={item}
                                                            displayValues={displayValues}
                                                            displayIdx={displayIdx}
                                                            editingCell={editingCell}
                                                            setEditingCell={setEditingCell}
                                                            isExpanded={expandedItems.has(si.id!)}
                                                            isDaasMode={isDaasMode(activeScenarioId)}
                                                            toggleExpandItem={toggleExpandItem}
                                                            updateQuantity={updateQuantity}
                                                            updateMargin={updateMargin}
                                                            updateUnitPrice={updateUnitPrice}
                                                            toggleDilpidate={toggleDilpidate}
                                                            removeItemFromScenario={removeItemFromScenario}
                                                            updateChildQuantity={updateChildQuantity}
                                                            removeChildItem={removeChildItem}
                                                            setPickingChildrenFor={setPickingChildrenFor}
                                                            proposal={proposal}
                                                        />
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <ScenarioTotalsCards totals={totals} currency={activeScenario.currency} />
                        </>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                             <Calculator className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                             <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">Seleccione o cree un escenario para modelar costos.</h4>
                        </div>
                    )}
                </div>
            </div>

            <ItemPickerModal
                isOpen={isPickingItems}
                onClose={() => setIsPickingItems(false)}
                proposalItems={proposalItems}
                scenarioItems={activeScenario?.scenarioItems}
                onAddItem={addItemToScenario}
            />

            {/* Child item picker — filters out the parent itself and items already added as children */}
            <ItemPickerModal
                isOpen={pickingChildrenFor !== null}
                onClose={() => setPickingChildrenFor(null)}
                proposalItems={proposalItems.filter(pi => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    if (!parentSi) return true;
                    if (pi.id === parentSi.itemId) return false;
                    return true;
                })}
                scenarioItems={(() => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    return parentSi?.children?.map(c => ({ ...c, itemId: c.itemId })) || [];
                })()}
                onAddItem={(itemId) => {
                    if (pickingChildrenFor) {
                        addChildItem(pickingChildrenFor, itemId);
                    }
                }}
            />
        </div>
    );
}
```

- `calculateItemDisplayValues` call → passes `activeScenario.currency`, `activeScenario.conversionTrm`

---

## Migration Command

```bash
npx prisma migrate dev --name add_item_currency_and_scenario_trm
```

> [!WARNING]
> The backend Prisma lint errors (`costCurrency`/`conversionTrm` not found on types) will resolve after running `npx prisma generate` as part of the migration. Do NOT run generate until after migration.

## Verification
- Frontend `tsc --noEmit` — sandbox was unavailable. Please run manually:
  ```bash
  cd apps/web && npx tsc --noEmit --project tsconfig.app.json
  ```
