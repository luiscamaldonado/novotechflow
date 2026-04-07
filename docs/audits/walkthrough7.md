# Backend Scalability Improvements — Walkthrough

## Resumen

| Categoría | Cantidad |
|:---|:---|
| **Índices agregados** | **16** |
| **Relaciones con `onDelete` modificadas** | **8** (7 Cascade + 1 SetNull) |
| **Servicios simplificados** | **3** métodos en 3 archivos |

---

## 1. Índices Agregados (16 total)

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

  proposal  Proposal   @relation(fields: [proposalId], references: [id])
  emailLogs EmailLog[]

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

  proposal      Proposal           @relation(fields: [proposalId], references: [id])
  blocks        ProposalPageBlock[]
  proposalItems ProposalItem[]

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

  proposal      Proposal         @relation(fields: [proposalId], references: [id])
  page          ProposalPage?    @relation(fields: [pageId], references: [id])
  scenarioItems ScenarioItem[]

  @@map("proposal_items")
}

model Scenario {
  id          String  @id @default(uuid()) @db.Uuid
  proposalId  String  @map("proposal_id") @db.Uuid
  name        String  @db.VarChar(100)
  currency    String  @default("COP") @db.VarChar(5)
  description String? @db.Text
  sortOrder   Int     @default(0) @map("sort_order")

  proposal      Proposal       @relation(fields: [proposalId], references: [id])
  scenarioItems ScenarioItem[]

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

  scenario Scenario      @relation(fields: [scenarioId], references: [id])
  item     ProposalItem  @relation(fields: [itemId], references: [id])
  parent   ScenarioItem? @relation("ScenarioItemChildren", fields: [parentId], references: [id])
  children ScenarioItem[] @relation("ScenarioItemChildren")

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
  proposal Proposal? @relation(fields: [proposalId], references: [id])

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
  proposal        Proposal         @relation(fields: [proposalId], references: [id])
  proposalVersion ProposalVersion? @relation(fields: [proposalVersionId], references: [id])

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

| Modelo | Índice | Propósito |
|:---|:---|:---|
| `Proposal` | `@@index([userId])` | Filtro por comercial |
| `Proposal` | `@@index([status])` | Filtro por estado |
| `Proposal` | `@@index([clientId])` | Filtro por cliente |
| `Proposal` | `@@index([createdAt])` | Ordenamiento temporal |
| `ProposalVersion` | `@@index([proposalId])` | JOIN con proposal |
| `ProposalPage` | `@@index([proposalId])` | JOIN con proposal |
| `ProposalPageBlock` | `@@index([pageId])` | JOIN con page |
| `ProposalItem` | `@@index([proposalId])` | JOIN con proposal |
| `Scenario` | `@@index([proposalId])` | JOIN con proposal |
| `ScenarioItem` | `@@index([scenarioId])` | JOIN con scenario |
| `ScenarioItem` | `@@index([itemId])` | JOIN con item |
| `ScenarioItem` | `@@index([parentId])` | Navegación jerárquica |
| `SyncedFile` | `@@index([userId])` | Filtro por usuario |
| `SyncedFile` | `@@index([proposalId])` | JOIN con proposal |
| `EmailLog` | `@@index([userId])` | Filtro por usuario |
| `EmailLog` | `@@index([proposalId])` | JOIN con proposal |
| `BillingProjection` | `@@index([userId])` | Filtro por usuario |

---

## 2. Relaciones `onDelete` Modificadas (8 total)

| Modelo.relación | Tipo | Razón |
|:---|:---|:---|
| `ProposalVersion.proposal` | `Cascade` | Versiones no existen sin propuesta |
| `ProposalPage.proposal` | `Cascade` | Páginas no existen sin propuesta |
| `ProposalItem.proposal` | `Cascade` | Ítems no existen sin propuesta |
| `Scenario.proposal` | `Cascade` | Escenarios no existen sin propuesta |
| `ScenarioItem.scenario` | `Cascade` | Ítems de escenario no existen sin escenario |
| `EmailLog.proposal` | `Cascade` | Logs ligados a propuesta |
| `SyncedFile.proposal` | `SetNull` | Archivo puede existir sin propuesta |
| `ProposalPageBlock.page` | *(ya existía)* | Ya estaba con Cascade |

> [!IMPORTANT]
> **NO se tocó** la relación `Proposal → User` — eliminar un usuario **no** borra sus propuestas.

---

## 3. Servicios Simplificados

### [proposals.service.ts](file:///d:/novotechflow/apps/api/src/proposals/proposals.service.ts) — `deleteProposal`

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
   * Implementa limpieza manual de ítems previa a la eliminación de la cabecera.
   */
  async deleteProposal(id: string, user: AuthenticatedUser) {
    await this.verifyProposalOwnership(id, user);
    return this.prisma.$transaction(async (tx) => {
      // Delete page blocks first (they reference pages)
      await tx.proposalPageBlock.deleteMany({
        where: { page: { proposalId: id } }
      });

      // Delete pages (they reference the proposal)
      await tx.proposalPage.deleteMany({
        where: { proposalId: id }
      });

      // Delete linked scenario items first
      await tx.scenarioItem.deleteMany({
        where: { scenario: { proposalId: id } }
      });

      // Delete scenarios
      await tx.scenario.deleteMany({
        where: { proposalId: id }
      });

      // Delete regular items
      await tx.proposalItem.deleteMany({
        where: { proposalId: id },
      });

      // Delete proposal
      return tx.proposal.delete({
        where: { id },
      });
    });
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
```

**Antes:** Transacción con 6 `deleteMany`/`delete` manuales (~30 líneas).
**Después:** Una sola línea `prisma.proposal.delete()` (la DB hace el cascade).

---

### [scenarios.service.ts](file:///d:/novotechflow/apps/api/src/proposals/scenarios.service.ts) — `deleteScenario`

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
   * Elimina un escenario y sus items vinculados.
   */
  async deleteScenario(id: string, user: AuthenticatedUser) {
    await this.verifyScenarioOwnership(id, user);
    return this.prisma.$transaction(async (tx) => {
      await tx.scenarioItem.deleteMany({ where: { scenarioId: id } });
      return tx.scenario.delete({ where: { id } });
    });
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
```

**Antes:** Transacción con `deleteMany` de scenarioItems + `delete` del scenario.
**Después:** `prisma.scenario.delete()` directo.

---

### [pages.service.ts](file:///d:/novotechflow/apps/api/src/proposals/pages.service.ts) — `deletePage`

```diff:pages.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';
import { BlockType, PageType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizeRichText } from '../common/sanitize';
import {
    CreatePageDto,
    UpdatePageDto,
    ReorderPagesDto,
    CreateBlockDto,
    UpdateBlockDto,
    ReorderBlocksDto,
} from './dto/proposals.dto';


@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Verifica ownership a través de una página.
   * Busca la page → obtiene proposalId → verifica ownership.
   */
  private async verifyPageOwnership(pageId: string, user: AuthenticatedUser) {
    const page = await this.prisma.proposalPage.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Página no encontrada.');
    await this.proposalsService.verifyProposalOwnership(page.proposalId, user);
    return page;
  }

  /**
   * Inicializa las páginas predeterminadas para una propuesta.
   * Lee las plantillas globales configuradas por el admin (PdfTemplate).
   * Si no hay plantillas, usa fallback hardcodeado mínimo.
   * Agrega la firma del comercial a la página de presentación.
   */
  async initializeDefaultPages(proposalId: string, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    // Check for ANY existing pages to prevent re-initialization
    const existingCount = await this.prisma.proposalPage.count({
      where: { proposalId },
    });

    if (existingCount > 0) {
      return this.getPagesByProposalId(proposalId);
    }

    // Fetch proposal with user to get signature
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: { select: { name: true, signatureUrl: true } } },
    });

    // Read global templates from admin configuration
    const templates = await this.prisma.pdfTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Build page definitions from templates or fallback
    let pageDefs: {
      pageType: string;
      title: string;
      sortOrder: number;
      blocks: { blockType: string; content: object }[];
    }[];

    if (templates.length > 0) {
      // Use admin-configured templates
      pageDefs = templates.map((t) => ({
        pageType: t.templateType,
        title: t.name,
        sortOrder: t.sortOrder,
        blocks: ((t.content as any[]) || []).map((b: any) => ({
          blockType: b.blockType,
          content: b.content || {},
        })),
      }));
    } else {
      // Fallback: minimal hardcoded defaults
      pageDefs = [
        { pageType: 'COVER', title: 'Portada', sortOrder: 1, blocks: [{ blockType: 'IMAGE', content: { url: '/uploads/defaults/portada.png', caption: '', fullPage: true } }] },
        { pageType: 'PRESENTATION', title: 'Carta de Presentación', sortOrder: 2, blocks: [{ blockType: 'RICH_TEXT', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Carta de Presentación' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Contenido de la carta de presentación.' }] }] } }] },
        { pageType: 'COMPANY_INFO', title: 'Información General (1/2)', sortOrder: 3, blocks: [] },
        { pageType: 'COMPANY_INFO', title: 'Información General (2/2)', sortOrder: 4, blocks: [] },
        { pageType: 'INDEX', title: 'Índice', sortOrder: 5, blocks: [] },
        { pageType: 'TERMS', title: 'Términos y Condiciones', sortOrder: 1000, blocks: [{ blockType: 'RICH_TEXT', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Términos y Condiciones' }] }] } }] },
      ];
    }

    // For the PRESENTATION page, append the commercial user's signature if available
    if (proposal?.user?.signatureUrl) {
      const presentationIdx = pageDefs.findIndex(p => p.pageType === 'PRESENTATION');
      if (presentationIdx !== -1) {
        pageDefs[presentationIdx].blocks.push({
          blockType: 'IMAGE',
          content: { url: proposal.user.signatureUrl, caption: proposal.user.name || 'Firma Comercial' },
        });
      }
    }

    // Create pages and blocks
    for (const page of pageDefs) {
      const createdPage = await this.prisma.proposalPage.create({
        data: {
          proposalId,
          pageType: page.pageType as PageType,
          title: page.title,
          sortOrder: page.sortOrder,
          isLocked: true,
        },
      });

      if (page.blocks?.length) {
        for (let i = 0; i < page.blocks.length; i++) {
          await this.prisma.proposalPageBlock.create({
            data: {
              pageId: createdPage.id,
              blockType: page.blocks[i].blockType as BlockType,
              content: page.blocks[i].content as object,
              sortOrder: i + 1,
            },
          });
        }
      }
    }

    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Retorna todas las páginas con sus bloques para una propuesta.
   */
  async getPagesByProposalId(proposalId: string, user?: AuthenticatedUser) {
    if (user) await this.proposalsService.verifyProposalOwnership(proposalId, user);
    return this.prisma.proposalPage.findMany({
      where: { proposalId },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea una página personalizada.
   */
  async createCustomPage(proposalId: string, data: CreatePageDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    // Insert before TERMS (sortOrder 1000) but after everything else
    const aggregate = await this.prisma.proposalPage.aggregate({
      where: { proposalId, pageType: { not: 'TERMS' } },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalPage.create({
      data: {
        proposalId,
        pageType: 'CUSTOM',
        title: data.title,
        isLocked: false,
        sortOrder: nextOrder,
      },
      include: { blocks: true },
    });
  }

  /**
   * Actualiza una página (título o variables).
   */
  async updatePage(pageId: string, data: UpdatePageDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    return this.prisma.proposalPage.update({
      where: { id: pageId },
      data: {
        title: data.title,
        variables: data.variables as object | undefined,
      },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  /**
   * Elimina una página (solo si no es predeterminada).
   */
  async deletePage(pageId: string, user: AuthenticatedUser) {
    const page = await this.verifyPageOwnership(pageId, user);
    if (page.isLocked) throw new Error('No se puede eliminar una página predeterminada.');

    await this.prisma.proposalPageBlock.deleteMany({ where: { pageId } });
    return this.prisma.proposalPage.delete({ where: { id: pageId } });
  }

  /**
   * Reordena las páginas respetando las posiciones fijas de predeterminadas.
   */
  async reorderPages(proposalId: string, data: ReorderPagesDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    await this.prisma.$transaction(
      data.pageIds.map((id, index) =>
        this.prisma.proposalPage.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Crea un bloque dentro de una página.
   */
  async createBlock(pageId: string, data: CreateBlockDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    const aggregate = await this.prisma.proposalPageBlock.aggregate({
      where: { pageId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    const contentToSave = data.blockType === 'RICH_TEXT' && data.content
      ? { ...data.content as object, html: typeof (data.content as any).html === 'string' ? sanitizeRichText((data.content as any).html) : undefined }
      : (data.content || {});

    return this.prisma.proposalPageBlock.create({
      data: {
        pageId,
        blockType: data.blockType as BlockType,
        content: contentToSave as object,
        sortOrder: nextOrder,
      },
    });
  }

  /**
   * Actualiza el contenido de un bloque.
   */
  async updateBlock(blockId: string, data: UpdateBlockDto, user: AuthenticatedUser) {
    const block = await this.prisma.proposalPageBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Bloque no encontrado.');
    await this.verifyPageOwnership(block.pageId, user);

    const contentToSave = block.blockType === 'RICH_TEXT' && data.content
      ? { ...data.content as object, html: typeof (data.content as any).html === 'string' ? sanitizeRichText((data.content as any).html) : undefined }
      : data.content;

    return this.prisma.proposalPageBlock.update({
      where: { id: blockId },
      data: { content: contentToSave as object | undefined },
    });
  }

  /**
   * Elimina un bloque.
   */
  async deleteBlock(blockId: string, user: AuthenticatedUser) {
    const block = await this.prisma.proposalPageBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Bloque no encontrado.');
    await this.verifyPageOwnership(block.pageId, user);
    return this.prisma.proposalPageBlock.delete({ where: { id: blockId } });
  }

  /**
   * Reordena los bloques dentro de una página.
   */
  async reorderBlocks(pageId: string, data: ReorderBlocksDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    await this.prisma.$transaction(
      data.blockIds.map((id, index) =>
        this.prisma.proposalPageBlock.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.prisma.proposalPageBlock.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
===
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalsService } from './proposals.service';
import { BlockType, PageType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';
import { sanitizeRichText } from '../common/sanitize';
import {
    CreatePageDto,
    UpdatePageDto,
    ReorderPagesDto,
    CreateBlockDto,
    UpdateBlockDto,
    ReorderBlocksDto,
} from './dto/proposals.dto';


@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposalsService: ProposalsService,
  ) {}

  /**
   * Verifica ownership a través de una página.
   * Busca la page → obtiene proposalId → verifica ownership.
   */
  private async verifyPageOwnership(pageId: string, user: AuthenticatedUser) {
    const page = await this.prisma.proposalPage.findUnique({ where: { id: pageId } });
    if (!page) throw new NotFoundException('Página no encontrada.');
    await this.proposalsService.verifyProposalOwnership(page.proposalId, user);
    return page;
  }

  /**
   * Inicializa las páginas predeterminadas para una propuesta.
   * Lee las plantillas globales configuradas por el admin (PdfTemplate).
   * Si no hay plantillas, usa fallback hardcodeado mínimo.
   * Agrega la firma del comercial a la página de presentación.
   */
  async initializeDefaultPages(proposalId: string, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    // Check for ANY existing pages to prevent re-initialization
    const existingCount = await this.prisma.proposalPage.count({
      where: { proposalId },
    });

    if (existingCount > 0) {
      return this.getPagesByProposalId(proposalId);
    }

    // Fetch proposal with user to get signature
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { user: { select: { name: true, signatureUrl: true } } },
    });

    // Read global templates from admin configuration
    const templates = await this.prisma.pdfTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Build page definitions from templates or fallback
    let pageDefs: {
      pageType: string;
      title: string;
      sortOrder: number;
      blocks: { blockType: string; content: object }[];
    }[];

    if (templates.length > 0) {
      // Use admin-configured templates
      pageDefs = templates.map((t) => ({
        pageType: t.templateType,
        title: t.name,
        sortOrder: t.sortOrder,
        blocks: ((t.content as any[]) || []).map((b: any) => ({
          blockType: b.blockType,
          content: b.content || {},
        })),
      }));
    } else {
      // Fallback: minimal hardcoded defaults
      pageDefs = [
        { pageType: 'COVER', title: 'Portada', sortOrder: 1, blocks: [{ blockType: 'IMAGE', content: { url: '/uploads/defaults/portada.png', caption: '', fullPage: true } }] },
        { pageType: 'PRESENTATION', title: 'Carta de Presentación', sortOrder: 2, blocks: [{ blockType: 'RICH_TEXT', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Carta de Presentación' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Contenido de la carta de presentación.' }] }] } }] },
        { pageType: 'COMPANY_INFO', title: 'Información General (1/2)', sortOrder: 3, blocks: [] },
        { pageType: 'COMPANY_INFO', title: 'Información General (2/2)', sortOrder: 4, blocks: [] },
        { pageType: 'INDEX', title: 'Índice', sortOrder: 5, blocks: [] },
        { pageType: 'TERMS', title: 'Términos y Condiciones', sortOrder: 1000, blocks: [{ blockType: 'RICH_TEXT', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'left' }, content: [{ type: 'text', text: 'Términos y Condiciones' }] }] } }] },
      ];
    }

    // For the PRESENTATION page, append the commercial user's signature if available
    if (proposal?.user?.signatureUrl) {
      const presentationIdx = pageDefs.findIndex(p => p.pageType === 'PRESENTATION');
      if (presentationIdx !== -1) {
        pageDefs[presentationIdx].blocks.push({
          blockType: 'IMAGE',
          content: { url: proposal.user.signatureUrl, caption: proposal.user.name || 'Firma Comercial' },
        });
      }
    }

    // Create pages and blocks
    for (const page of pageDefs) {
      const createdPage = await this.prisma.proposalPage.create({
        data: {
          proposalId,
          pageType: page.pageType as PageType,
          title: page.title,
          sortOrder: page.sortOrder,
          isLocked: true,
        },
      });

      if (page.blocks?.length) {
        for (let i = 0; i < page.blocks.length; i++) {
          await this.prisma.proposalPageBlock.create({
            data: {
              pageId: createdPage.id,
              blockType: page.blocks[i].blockType as BlockType,
              content: page.blocks[i].content as object,
              sortOrder: i + 1,
            },
          });
        }
      }
    }

    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Retorna todas las páginas con sus bloques para una propuesta.
   */
  async getPagesByProposalId(proposalId: string, user?: AuthenticatedUser) {
    if (user) await this.proposalsService.verifyProposalOwnership(proposalId, user);
    return this.prisma.proposalPage.findMany({
      where: { proposalId },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Crea una página personalizada.
   */
  async createCustomPage(proposalId: string, data: CreatePageDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    // Insert before TERMS (sortOrder 1000) but after everything else
    const aggregate = await this.prisma.proposalPage.aggregate({
      where: { proposalId, pageType: { not: 'TERMS' } },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalPage.create({
      data: {
        proposalId,
        pageType: 'CUSTOM',
        title: data.title,
        isLocked: false,
        sortOrder: nextOrder,
      },
      include: { blocks: true },
    });
  }

  /**
   * Actualiza una página (título o variables).
   */
  async updatePage(pageId: string, data: UpdatePageDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    return this.prisma.proposalPage.update({
      where: { id: pageId },
      data: {
        title: data.title,
        variables: data.variables as object | undefined,
      },
      include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  /**
   * Elimina una página (solo si no es predeterminada).
   * La cascada (onDelete: Cascade en ProposalPageBlock) elimina automáticamente los bloques.
   */
  async deletePage(pageId: string, user: AuthenticatedUser) {
    const page = await this.verifyPageOwnership(pageId, user);
    if (page.isLocked) throw new Error('No se puede eliminar una página predeterminada.');

    return this.prisma.proposalPage.delete({ where: { id: pageId } });
  }

  /**
   * Reordena las páginas respetando las posiciones fijas de predeterminadas.
   */
  async reorderPages(proposalId: string, data: ReorderPagesDto, user: AuthenticatedUser) {
    await this.proposalsService.verifyProposalOwnership(proposalId, user);
    await this.prisma.$transaction(
      data.pageIds.map((id, index) =>
        this.prisma.proposalPage.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.getPagesByProposalId(proposalId);
  }

  /**
   * Crea un bloque dentro de una página.
   */
  async createBlock(pageId: string, data: CreateBlockDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    const aggregate = await this.prisma.proposalPageBlock.aggregate({
      where: { pageId },
      _max: { sortOrder: true },
    });
    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    const contentToSave = data.blockType === 'RICH_TEXT' && data.content
      ? { ...data.content as object, html: typeof (data.content as any).html === 'string' ? sanitizeRichText((data.content as any).html) : undefined }
      : (data.content || {});

    return this.prisma.proposalPageBlock.create({
      data: {
        pageId,
        blockType: data.blockType as BlockType,
        content: contentToSave as object,
        sortOrder: nextOrder,
      },
    });
  }

  /**
   * Actualiza el contenido de un bloque.
   */
  async updateBlock(blockId: string, data: UpdateBlockDto, user: AuthenticatedUser) {
    const block = await this.prisma.proposalPageBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Bloque no encontrado.');
    await this.verifyPageOwnership(block.pageId, user);

    const contentToSave = block.blockType === 'RICH_TEXT' && data.content
      ? { ...data.content as object, html: typeof (data.content as any).html === 'string' ? sanitizeRichText((data.content as any).html) : undefined }
      : data.content;

    return this.prisma.proposalPageBlock.update({
      where: { id: blockId },
      data: { content: contentToSave as object | undefined },
    });
  }

  /**
   * Elimina un bloque.
   */
  async deleteBlock(blockId: string, user: AuthenticatedUser) {
    const block = await this.prisma.proposalPageBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Bloque no encontrado.');
    await this.verifyPageOwnership(block.pageId, user);
    return this.prisma.proposalPageBlock.delete({ where: { id: blockId } });
  }

  /**
   * Reordena los bloques dentro de una página.
   */
  async reorderBlocks(pageId: string, data: ReorderBlocksDto, user: AuthenticatedUser) {
    await this.verifyPageOwnership(pageId, user);
    await this.prisma.$transaction(
      data.blockIds.map((id, index) =>
        this.prisma.proposalPageBlock.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
    return this.prisma.proposalPageBlock.findMany({
      where: { pageId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
```

**Antes:** `deleteMany` de bloques + `delete` de la página.
**Después:** `prisma.proposalPage.delete()` directo (bloques cascadean).

---

## ⚠️ Migración Pendiente

> [!WARNING]
> La migración de Prisma **NO** fue ejecutada. Debes correr manualmente:
> ```bash
> npx prisma migrate dev --name add_indexes_and_cascades
> ```
