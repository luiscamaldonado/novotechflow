# Currency Selector for Billing Projections

## Summary

Added a COP/USD currency selector to the Billing Projection modal, persisted it to the database, and wired it through to the Dashboard table and billing cards so TRM conversion works identically to proposals.

## Files Modified (6)

---

### 1. Schema — `apps/api/prisma/schema.prisma`

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
```

> [!IMPORTANT]
> New column with `@default("COP")` — existing rows will automatically get `COP` after migration.

---

### 2. Backend Service — `apps/api/src/billing-projections/billing-projections.service.ts`

```diff:billing-projections.service.ts
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus, AcquisitionType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

export interface CreateBillingProjectionDto {
    clientName: string;
    subtotal: number;
    status?: string;
    billingDate?: string | null;
    acquisitionType?: string;
}

export interface UpdateBillingProjectionDto {
    clientName?: string;
    subtotal?: number;
    status?: string;
    billingDate?: string | null;
    acquisitionType?: string;
}

@Injectable()
export class BillingProjectionsService {
    private readonly logger = new Logger(BillingProjectionsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Generates a unique projection code: PROY-[NOMENCLATURE][SEQUENTIAL]
     */
    private async generateProjectionCode(nomenclature: string, userId: string): Promise<string> {
        const prefix = nomenclature || 'XX';

        const lastProjection = await this.prisma.billingProjection.findFirst({
            where: { userId },
            orderBy: { projectionCode: 'desc' },
            select: { projectionCode: true },
        });

        let nextNumber = 1;

        if (lastProjection?.projectionCode) {
            const match = lastProjection.projectionCode.match(/(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const sequential = nextNumber.toString().padStart(4, '0');
        return `PROY-${prefix}${sequential}`;
    }

    /**
     * Creates a new billing projection entry.
     */
    async create(userId: string, data: CreateBillingProjectionDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Usuario no encontrado.');

        const projectionCode = await this.generateProjectionCode(user.nomenclature, userId);

        return this.prisma.billingProjection.create({
            data: {
                userId,
                projectionCode,
                clientName: data.clientName.trim().toUpperCase(),
                subtotal: data.subtotal,
                status: (data.status as ProposalStatus) || ProposalStatus.PENDIENTE_FACTURAR,
                billingDate: data.billingDate ? new Date(data.billingDate) : null,
                acquisitionType: data.acquisitionType ? (data.acquisitionType as AcquisitionType) : undefined,
            },
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
        });
    }

    /**
     * Lists billing projections with RBAC filtering.
     */
    async findAll(user: AuthenticatedUser) {
        const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };

        return this.prisma.billingProjection.findMany({
            where: accessFilter,
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    /**
     * Updates a billing projection.
     */
    async update(id: string, data: UpdateBillingProjectionDto, user: AuthenticatedUser) {
        const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proyección no encontrada.');
        if (user.role !== 'ADMIN' && existing.userId !== user.id) {
            throw new ForbiddenException('No tienes permiso para modificar esta proyección.');
        }

        return this.prisma.billingProjection.update({
            where: { id },
            data: {
                clientName: data.clientName ? data.clientName.trim().toUpperCase() : undefined,
                subtotal: data.subtotal ?? undefined,
                status: data.status ? (data.status as ProposalStatus) : undefined,
                billingDate: data.billingDate ? new Date(data.billingDate) : data.billingDate === null ? null : undefined,
                acquisitionType: data.acquisitionType ? (data.acquisitionType as AcquisitionType) : undefined,
            },
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
        });
    }

    /**
     * Deletes a billing projection.
     */
    async delete(id: string, user: AuthenticatedUser) {
        const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proyección no encontrada.');
        if (user.role !== 'ADMIN' && existing.userId !== user.id) {
            throw new ForbiddenException('No tienes permiso para eliminar esta proyección.');
        }

        return this.prisma.billingProjection.delete({ where: { id } });
    }
}
===
import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus, AcquisitionType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

export interface CreateBillingProjectionDto {
    clientName: string;
    subtotal: number;
    status?: string;
    billingDate?: string | null;
    acquisitionType?: string;
    currency?: string;
}

export interface UpdateBillingProjectionDto {
    clientName?: string;
    subtotal?: number;
    status?: string;
    billingDate?: string | null;
    acquisitionType?: string;
    currency?: string;
}

@Injectable()
export class BillingProjectionsService {
    private readonly logger = new Logger(BillingProjectionsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Generates a unique projection code: PROY-[NOMENCLATURE][SEQUENTIAL]
     */
    private async generateProjectionCode(nomenclature: string, userId: string): Promise<string> {
        const prefix = nomenclature || 'XX';

        const lastProjection = await this.prisma.billingProjection.findFirst({
            where: { userId },
            orderBy: { projectionCode: 'desc' },
            select: { projectionCode: true },
        });

        let nextNumber = 1;

        if (lastProjection?.projectionCode) {
            const match = lastProjection.projectionCode.match(/(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const sequential = nextNumber.toString().padStart(4, '0');
        return `PROY-${prefix}${sequential}`;
    }

    /**
     * Creates a new billing projection entry.
     */
    async create(userId: string, data: CreateBillingProjectionDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Usuario no encontrado.');

        const projectionCode = await this.generateProjectionCode(user.nomenclature, userId);

        return this.prisma.billingProjection.create({
            data: {
                userId,
                projectionCode,
                clientName: data.clientName.trim().toUpperCase(),
                subtotal: data.subtotal,
                status: (data.status as ProposalStatus) || ProposalStatus.PENDIENTE_FACTURAR,
                billingDate: data.billingDate ? new Date(data.billingDate) : null,
                acquisitionType: data.acquisitionType ? (data.acquisitionType as AcquisitionType) : undefined,
                currency: data.currency || 'COP',
            },
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
        });
    }

    /**
     * Lists billing projections with RBAC filtering.
     */
    async findAll(user: AuthenticatedUser) {
        const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };

        return this.prisma.billingProjection.findMany({
            where: accessFilter,
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    /**
     * Updates a billing projection.
     */
    async update(id: string, data: UpdateBillingProjectionDto, user: AuthenticatedUser) {
        const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proyección no encontrada.');
        if (user.role !== 'ADMIN' && existing.userId !== user.id) {
            throw new ForbiddenException('No tienes permiso para modificar esta proyección.');
        }

        return this.prisma.billingProjection.update({
            where: { id },
            data: {
                clientName: data.clientName ? data.clientName.trim().toUpperCase() : undefined,
                subtotal: data.subtotal ?? undefined,
                status: data.status ? (data.status as ProposalStatus) : undefined,
                billingDate: data.billingDate ? new Date(data.billingDate) : data.billingDate === null ? null : undefined,
                acquisitionType: data.acquisitionType ? (data.acquisitionType as AcquisitionType) : undefined,
                currency: data.currency ?? undefined,
            },
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
        });
    }

    /**
     * Deletes a billing projection.
     */
    async delete(id: string, user: AuthenticatedUser) {
        const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proyección no encontrada.');
        if (user.role !== 'ADMIN' && existing.userId !== user.id) {
            throw new ForbiddenException('No tienes permiso para eliminar esta proyección.');
        }

        return this.prisma.billingProjection.delete({ where: { id } });
    }
}
```

Changes:
- Added `currency?: string` to both `CreateBillingProjectionDto` and `UpdateBillingProjectionDto`
- Wired `currency` into `create()` with fallback `|| 'COP'`
- Wired `currency` into `update()` with `?? undefined` (skip if not provided)

---

### 3. Frontend Types — `apps/web/src/lib/types.ts`

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

```

Added `currency?: string` to the `BillingProjection` interface.

---

### 4. Hook — `apps/web/src/hooks/useProjections.ts`

```diff:useProjections.ts
import { useState } from 'react';
import { api } from '../lib/api';
import type { BillingProjection } from '../lib/types';

export interface ProjForm {
    clientName: string;
    subtotal: string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate: string;
    acquisitionType: '' | 'VENTA' | 'DAAS';
}

export function useProjections(
    setProjections: React.Dispatch<React.SetStateAction<BillingProjection[]>>,
) {
    const [showProjectionModal, setShowProjectionModal] = useState(false);
    const [editingProjection, setEditingProjection] = useState<BillingProjection | null>(null);
    const [projForm, setProjForm] = useState<ProjForm>({
        clientName: '',
        subtotal: '',
        status: 'PENDIENTE_FACTURAR',
        billingDate: '',
        acquisitionType: '',
    });
    const [savingProjection, setSavingProjection] = useState(false);

    const openNewProjectionModal = () => {
        setEditingProjection(null);
        setProjForm({ clientName: '', subtotal: '', status: 'PENDIENTE_FACTURAR', billingDate: '', acquisitionType: '' });
        setShowProjectionModal(true);
    };

    const openEditProjectionModal = (pr: BillingProjection) => {
        setEditingProjection(pr);
        setProjForm({
            clientName: pr.clientName,
            subtotal: String(pr.subtotal),
            status: pr.status,
            billingDate: pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : '',
            acquisitionType: (pr.acquisitionType || '') as '' | 'VENTA' | 'DAAS',
        });
        setShowProjectionModal(true);
    };

    const handleSaveProjection = async () => {
        if (!projForm.clientName.trim() || !projForm.subtotal) return;
        setSavingProjection(true);
        try {
            if (editingProjection) {
                const res = await api.patch(`/billing-projections/${editingProjection.id}`, {
                    clientName: projForm.clientName,
                    subtotal: parseFloat(projForm.subtotal),
                    status: projForm.status,
                    billingDate: projForm.billingDate || null,
                    acquisitionType: projForm.acquisitionType || undefined,
                });
                setProjections(prev => prev.map(pr => pr.id === editingProjection.id ? res.data : pr));
            } else {
                const res = await api.post('/billing-projections', {
                    clientName: projForm.clientName,
                    subtotal: parseFloat(projForm.subtotal),
                    status: projForm.status,
                    billingDate: projForm.billingDate || null,
                    acquisitionType: projForm.acquisitionType || undefined,
                });
                setProjections(prev => [res.data, ...prev]);
            }
            setShowProjectionModal(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar la proyección.');
        } finally {
            setSavingProjection(false);
        }
    };

    const handleDeleteProjection = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar la proyección ${code}?`)) return;

        try {
            await api.delete(`/billing-projections/${id}`);
            setProjections(prev => prev.filter(pr => pr.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la proyección.");
        }
    };

    return {
        showProjectionModal,
        setShowProjectionModal,
        editingProjection,
        projForm,
        setProjForm,
        savingProjection,
        openNewProjectionModal,
        openEditProjectionModal,
        handleSaveProjection,
        handleDeleteProjection,
    };
}
===
import { useState } from 'react';
import { api } from '../lib/api';
import type { BillingProjection } from '../lib/types';

export interface ProjForm {
    clientName: string;
    subtotal: string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate: string;
    acquisitionType: '' | 'VENTA' | 'DAAS';
    currency: 'COP' | 'USD';
}

export function useProjections(
    setProjections: React.Dispatch<React.SetStateAction<BillingProjection[]>>,
) {
    const [showProjectionModal, setShowProjectionModal] = useState(false);
    const [editingProjection, setEditingProjection] = useState<BillingProjection | null>(null);
    const [projForm, setProjForm] = useState<ProjForm>({
        clientName: '',
        subtotal: '',
        status: 'PENDIENTE_FACTURAR',
        billingDate: '',
        acquisitionType: '',
        currency: 'COP',
    });
    const [savingProjection, setSavingProjection] = useState(false);

    const openNewProjectionModal = () => {
        setEditingProjection(null);
        setProjForm({ clientName: '', subtotal: '', status: 'PENDIENTE_FACTURAR', billingDate: '', acquisitionType: '', currency: 'COP' });
        setShowProjectionModal(true);
    };

    const openEditProjectionModal = (pr: BillingProjection) => {
        setEditingProjection(pr);
        setProjForm({
            clientName: pr.clientName,
            subtotal: String(pr.subtotal),
            status: pr.status,
            billingDate: pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : '',
            acquisitionType: (pr.acquisitionType || '') as '' | 'VENTA' | 'DAAS',
            currency: (pr.currency === 'USD' ? 'USD' : 'COP') as 'COP' | 'USD',
        });
        setShowProjectionModal(true);
    };

    const handleSaveProjection = async () => {
        if (!projForm.clientName.trim() || !projForm.subtotal) return;
        setSavingProjection(true);
        try {
            if (editingProjection) {
                const res = await api.patch(`/billing-projections/${editingProjection.id}`, {
                    clientName: projForm.clientName,
                    subtotal: parseFloat(projForm.subtotal),
                    status: projForm.status,
                    billingDate: projForm.billingDate || null,
                    acquisitionType: projForm.acquisitionType || undefined,
                    currency: projForm.currency,
                });
                setProjections(prev => prev.map(pr => pr.id === editingProjection.id ? res.data : pr));
            } else {
                const res = await api.post('/billing-projections', {
                    clientName: projForm.clientName,
                    subtotal: parseFloat(projForm.subtotal),
                    status: projForm.status,
                    billingDate: projForm.billingDate || null,
                    acquisitionType: projForm.acquisitionType || undefined,
                    currency: projForm.currency,
                });
                setProjections(prev => [res.data, ...prev]);
            }
            setShowProjectionModal(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar la proyección.');
        } finally {
            setSavingProjection(false);
        }
    };

    const handleDeleteProjection = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar la proyección ${code}?`)) return;

        try {
            await api.delete(`/billing-projections/${id}`);
            setProjections(prev => prev.filter(pr => pr.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la proyección.");
        }
    };

    return {
        showProjectionModal,
        setShowProjectionModal,
        editingProjection,
        projForm,
        setProjForm,
        savingProjection,
        openNewProjectionModal,
        openEditProjectionModal,
        handleSaveProjection,
        handleDeleteProjection,
    };
}
```

Changes:
- Added `currency: 'COP' | 'USD'` to `ProjForm` interface
- Default value set to `'COP'` in all reset paths
- Pre-fills `currency` when editing an existing projection
- Sends `currency` in both POST and PATCH payloads

---

### 5. Dashboard Hook — `apps/web/src/hooks/useDashboard.ts`

```diff:useDashboard.ts
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { calculateScenarioTotals } from '../lib/pricing-engine';
import { getTrmMonthlyAverage } from '../lib/trm-service';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType } from '../lib/types';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
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

/** Compute billing cards for a single acquisition type. All subtotals converted to USD. */
function computeBillingCards(
    proposals: ProposalWithSubtotal[],
    projections: BillingProjection[],
    acquisitionFilter: AcquisitionType,
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

    const filteredProposals = proposals.filter(p => p.acquisitionType === acquisitionFilter);
    const filteredProjections = projections.filter(pr => pr.acquisitionType === acquisitionFilter);

    for (const p of filteredProposals) {
        const sub = getSubtotalUsd(p.subtotal, p.currency, trmRate) ?? 0;

        if (p.status === 'FACTURADA' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (p.status === 'GANADA' && p.closeDate) {
            const { month, year } = parseDate(p.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    // Projections: assumed COP if no currency info; convert to USD via TRM
    for (const pr of filteredProjections) {
        const rawSub = Number(pr.subtotal) || 0;
        const sub = getSubtotalUsd(rawSub, 'COP', trmRate) ?? 0;

        if (pr.status === 'FACTURADA' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
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
    const [subtotalMin, setSubtotalMin] = useState('');
    const [subtotalMax, setSubtotalMax] = useState('');

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
            minSubtotalCurrency: 'COP' as CurrencyCode,
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

    const filtered = useMemo(() => {
        return allRows.filter(p => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = p.code?.toLowerCase().includes(term) ||
                    p.clientName.toLowerCase().includes(term) ||
                    p.subject.toLowerCase().includes(term);
                if (!matches) return false;
            }
            if (statusFilters.size > 0 && !statusFilters.has(p.status)) return false;
            if (subtotalMin && p.minSubtotal !== null && p.minSubtotal < parseFloat(subtotalMin)) return false;
            if (subtotalMax && p.minSubtotal !== null && p.minSubtotal > parseFloat(subtotalMax)) return false;
            return true;
        });
    }, [allRows, searchTerm, statusFilters, subtotalMin, subtotalMax]);

    // ── Billing summary cards per acquisition type (values in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'VENTA', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'DAAS', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

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
        setSubtotalMin('');
        setSubtotalMax('');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0 || subtotalMin || subtotalMax;

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
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
        subtotalMin,
        setSubtotalMin,
        subtotalMax,
        setSubtotalMax,
        hasActiveFilters,

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
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType } from '../lib/types';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
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

/** Compute billing cards for a single acquisition type. All subtotals converted to USD. */
function computeBillingCards(
    proposals: ProposalWithSubtotal[],
    projections: BillingProjection[],
    acquisitionFilter: AcquisitionType,
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

    const filteredProposals = proposals.filter(p => p.acquisitionType === acquisitionFilter);
    const filteredProjections = projections.filter(pr => pr.acquisitionType === acquisitionFilter);

    for (const p of filteredProposals) {
        const sub = getSubtotalUsd(p.subtotal, p.currency, trmRate) ?? 0;

        if (p.status === 'FACTURADA' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (p.status === 'GANADA' && p.closeDate) {
            const { month, year } = parseDate(p.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    // Projections: use stored currency for conversion
    for (const pr of filteredProjections) {
        const rawSub = Number(pr.subtotal) || 0;
        const prCurrency: CurrencyCode = pr.currency === 'USD' ? 'USD' : 'COP';
        const sub = getSubtotalUsd(rawSub, prCurrency, trmRate) ?? 0;

        if (pr.status === 'FACTURADA' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
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
    const [subtotalMin, setSubtotalMin] = useState('');
    const [subtotalMax, setSubtotalMax] = useState('');

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

    const filtered = useMemo(() => {
        return allRows.filter(p => {
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = p.code?.toLowerCase().includes(term) ||
                    p.clientName.toLowerCase().includes(term) ||
                    p.subject.toLowerCase().includes(term);
                if (!matches) return false;
            }
            if (statusFilters.size > 0 && !statusFilters.has(p.status)) return false;
            if (subtotalMin && p.minSubtotal !== null && p.minSubtotal < parseFloat(subtotalMin)) return false;
            if (subtotalMax && p.minSubtotal !== null && p.minSubtotal > parseFloat(subtotalMax)) return false;
            return true;
        });
    }, [allRows, searchTerm, statusFilters, subtotalMin, subtotalMax]);

    // ── Billing summary cards per acquisition type (values in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'VENTA', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'DAAS', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

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
        setSubtotalMin('');
        setSubtotalMax('');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0 || subtotalMin || subtotalMax;

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
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
        subtotalMin,
        setSubtotalMin,
        subtotalMax,
        setSubtotalMax,
        hasActiveFilters,

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

Changes:
- **Projection rows**: `minSubtotalCurrency` now reads `pr.currency` instead of hardcoded `'COP'`
- **Billing cards**: `computeBillingCards` uses `pr.currency` for USD conversion instead of assuming COP

---

### 6. Modal Component — `apps/web/src/pages/dashboard/ProjectionModal.tsx`

```diff:ProjectionModal.tsx
import { Loader2, Receipt, X } from 'lucide-react';
import type { ProjForm } from '../../hooks/useProjections';
import type { BillingProjection } from '../../lib/types';

interface ProjectionModalProps {
    editingProjection: BillingProjection | null;
    projForm: ProjForm;
    setProjForm: React.Dispatch<React.SetStateAction<ProjForm>>;
    savingProjection: boolean;
    onSave: () => void;
    onClose: () => void;
}

export default function ProjectionModal({
    editingProjection,
    projForm,
    setProjForm,
    savingProjection,
    onSave,
    onClose,
}: ProjectionModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Receipt className="h-5 w-5 text-white/80" />
                        <h3 className="text-lg font-bold text-white">
                            {editingProjection ? 'Editar Proyección' : 'Nueva Proyección de Facturación'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5">
                    {/* Client Name */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Cliente</label>
                        <input
                            type="text"
                            value={projForm.clientName}
                            onChange={(e) => setProjForm(prev => ({ ...prev, clientName: e.target.value }))}
                            placeholder="Nombre del cliente"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Subtotal */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Subtotal</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3 text-gray-400 font-bold text-sm">$</span>
                            <input
                                type="number"
                                value={projForm.subtotal}
                                onChange={(e) => setProjForm(prev => ({ ...prev, subtotal: e.target.value }))}
                                placeholder="0"
                                className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <select
                            value={projForm.status}
                            onChange={(e) => setProjForm(prev => ({ ...prev, status: e.target.value as 'PENDIENTE_FACTURAR' | 'FACTURADA' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="PENDIENTE_FACTURAR">Pendiente Facturar</option>
                            <option value="FACTURADA">Facturada</option>
                        </select>
                    </div>

                    {/* Acquisition Type */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Adquisición</label>
                        <select
                            value={projForm.acquisitionType}
                            onChange={(e) => setProjForm(prev => ({ ...prev, acquisitionType: e.target.value as '' | 'VENTA' | 'DAAS' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="">— Seleccionar —</option>
                            <option value="VENTA">Venta</option>
                            <option value="DAAS">DaaS</option>
                        </select>
                    </div>

                    {/* Billing Date */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fecha de Facturación</label>
                        <input
                            type="date"
                            value={projForm.billingDate}
                            onChange={(e) => setProjForm(prev => ({ ...prev, billingDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={savingProjection || !projForm.clientName.trim() || !projForm.subtotal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/25"
                    >
                        {savingProjection ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Receipt className="h-4 w-4" />
                        )}
                        <span>{editingProjection ? 'Guardar Cambios' : 'Crear Proyección'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
===
import { Loader2, Receipt, X } from 'lucide-react';
import type { ProjForm } from '../../hooks/useProjections';
import type { BillingProjection } from '../../lib/types';

interface ProjectionModalProps {
    editingProjection: BillingProjection | null;
    projForm: ProjForm;
    setProjForm: React.Dispatch<React.SetStateAction<ProjForm>>;
    savingProjection: boolean;
    onSave: () => void;
    onClose: () => void;
}

export default function ProjectionModal({
    editingProjection,
    projForm,
    setProjForm,
    savingProjection,
    onSave,
    onClose,
}: ProjectionModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Receipt className="h-5 w-5 text-white/80" />
                        <h3 className="text-lg font-bold text-white">
                            {editingProjection ? 'Editar Proyección' : 'Nueva Proyección de Facturación'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5">
                    {/* Client Name */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Cliente</label>
                        <input
                            type="text"
                            value={projForm.clientName}
                            onChange={(e) => setProjForm(prev => ({ ...prev, clientName: e.target.value }))}
                            placeholder="Nombre del cliente"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Subtotal + Currency */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Subtotal</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <span className="absolute left-4 top-3 text-gray-400 font-bold text-sm">$</span>
                                <input
                                    type="number"
                                    value={projForm.subtotal}
                                    onChange={(e) => setProjForm(prev => ({ ...prev, subtotal: e.target.value }))}
                                    placeholder="0"
                                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                                />
                            </div>
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setProjForm(prev => ({ ...prev, currency: 'COP' }))}
                                    className={`px-4 py-3 text-xs font-bold transition-all ${
                                        projForm.currency === 'COP'
                                            ? 'bg-violet-600 text-white shadow-inner'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    COP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProjForm(prev => ({ ...prev, currency: 'USD' }))}
                                    className={`px-4 py-3 text-xs font-bold transition-all ${
                                        projForm.currency === 'USD'
                                            ? 'bg-emerald-600 text-white shadow-inner'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    USD
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <select
                            value={projForm.status}
                            onChange={(e) => setProjForm(prev => ({ ...prev, status: e.target.value as 'PENDIENTE_FACTURAR' | 'FACTURADA' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="PENDIENTE_FACTURAR">Pendiente Facturar</option>
                            <option value="FACTURADA">Facturada</option>
                        </select>
                    </div>

                    {/* Acquisition Type */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Adquisición</label>
                        <select
                            value={projForm.acquisitionType}
                            onChange={(e) => setProjForm(prev => ({ ...prev, acquisitionType: e.target.value as '' | 'VENTA' | 'DAAS' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="">— Seleccionar —</option>
                            <option value="VENTA">Venta</option>
                            <option value="DAAS">DaaS</option>
                        </select>
                    </div>

                    {/* Billing Date */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fecha de Facturación</label>
                        <input
                            type="date"
                            value={projForm.billingDate}
                            onChange={(e) => setProjForm(prev => ({ ...prev, billingDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={savingProjection || !projForm.clientName.trim() || !projForm.subtotal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/25"
                    >
                        {savingProjection ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Receipt className="h-4 w-4" />
                        )}
                        <span>{editingProjection ? 'Guardar Cambios' : 'Crear Proyección'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
```

Added a COP/USD pill-toggle next to the subtotal input. COP is violet, USD is emerald — matching the existing design language.

---

## Migration Command

> [!CAUTION]
> Do NOT run this until you've reviewed the schema diff above.

```bash
pnpm --filter api exec -- npx prisma migrate dev --name add-currency-to-billing-projection
```

This will:
1. Add the `currency VARCHAR(5) DEFAULT 'COP'` column to `billing_projections`
2. Backfill all existing rows with `'COP'`

## Verification

- [ ] Run migration
- [ ] Create a new projection with USD → verify it saves and reloads with USD selected
- [ ] Edit an existing COP projection → confirm selector shows COP
- [ ] Dashboard table "SUBTOTAL MIN." column shows correct currency symbol
- [ ] Dashboard "USD Est." column: COP projections get divided by TRM, USD projections pass through
- [ ] Billing cards aggregate correctly with mixed COP/USD projections
