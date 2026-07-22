import { Injectable } from '@nestjs/common';
import { ProposalStatus, Prisma } from '@prisma/client';
import {
  calculateItemDisplayValues,
  type PricingScenarioItem,
} from '@repo/pricing-engine';
import { PrismaService } from '../prisma/prisma.service';
import {
  externalProposalInclude,
  type ExternalProposalWithRelations,
} from './external-proposals.types';
import type {
  ExternalProposalOut,
  ExternalScenarioOut,
  ExternalItemOut,
  ExternalChildItemOut,
} from './dto/external-proposals.dto';
import { buildQuickDescription, pickSpecString, resolveItemTypeLabel } from '@repo/item-display';

type ScenarioItemRel =
  ExternalProposalWithRelations['scenarios'][number]['scenarioItems'][number];
type ChildItemRel = ScenarioItemRel['children'][number];

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function extractFletePct(internalCosts: Prisma.JsonValue | null): number | null {
  if (internalCosts === null || typeof internalCosts !== 'object' || Array.isArray(internalCosts)) {
    return null;
  }
  const flete = (internalCosts as Record<string, unknown>).fletePct;
  return flete === undefined || flete === null ? null : Number(flete);
}

function extractProveedor(internalCosts: Prisma.JsonValue | null): string | null {
  if (internalCosts === null || typeof internalCosts !== 'object' || Array.isArray(internalCosts)) {
    return null;
  }
  const prov = (internalCosts as Record<string, unknown>).proveedor;
  return typeof prov === 'string' ? prov : null;
}

function toTechnicalSpecs(specs: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (specs === null || typeof specs !== 'object' || Array.isArray(specs)) {
    return null;
  }
  return specs as Record<string, unknown>;
}

function childToPricingScenarioItem(child: ChildItemRel): PricingScenarioItem {
  return {
    quantity: child.quantity,
    marginPctOverride: child.marginPctOverride === null ? null : Number(child.marginPctOverride),
    unitPriceOverride: child.unitPriceOverride === null ? null : Number(child.unitPriceOverride),
    isDiluted: child.isDiluted,
    item: {
      unitCost: Number(child.item.unitCost),
      costCurrency: child.item.costCurrency,
      internalCosts: { fletePct: extractFletePct(child.item.internalCosts) ?? 0 },
      marginPct: child.item.marginPct === null ? 0 : Number(child.item.marginPct),
      isTaxable: child.item.isTaxable,
    },
    children: [],
  };
}

function toPricingScenarioItem(si: ScenarioItemRel): PricingScenarioItem {
  return {
    quantity: si.quantity,
    marginPctOverride: si.marginPctOverride === null ? null : Number(si.marginPctOverride),
    unitPriceOverride: si.unitPriceOverride === null ? null : Number(si.unitPriceOverride),
    isDiluted: si.isDiluted,
    item: {
      unitCost: Number(si.item.unitCost),
      costCurrency: si.item.costCurrency,
      internalCosts: {
        fletePct: extractFletePct(si.item.internalCosts) ?? 0,
      },
      marginPct: si.item.marginPct === null ? 0 : Number(si.item.marginPct),
      isTaxable: si.item.isTaxable,
    },
    children: si.children.map(childToPricingScenarioItem),
  };
}

function mapChildOut(child: ChildItemRel): ExternalChildItemOut {
  const specs = toTechnicalSpecs(child.item.technicalSpecs);
  return {
    scenarioItemId: child.id,
    itemId: child.item.id,
    itemType: child.item.itemType,
    itemTypeLabel: resolveItemTypeLabel(child.item.itemType),
    name: child.item.name,
    description: child.item.description,
    brand: pickSpecString(specs, 'fabricante'),
    partNumber: pickSpecString(specs, 'numeroParte'),
    formato: pickSpecString(specs, 'formato'),
    modelo: pickSpecString(specs, 'modelo'),
    quickSpecs: buildQuickDescription(child.item.itemType, specs),
    quantity: child.quantity,
    unitCost: Number(child.item.unitCost),
    costCurrency: child.item.costCurrency,
    unitCostOverride: toNumber(child.unitCostOverride),
    fletePct: extractFletePct(child.item.internalCosts),
    proveedor: extractProveedor(child.item.internalCosts),
    isTaxable: child.item.isTaxable,
    deliveryDays: child.item.deliveryDays,
    technicalSpecs: specs,
  };
}

@Injectable()
export class ExternalProposalsService {
  constructor(private prisma: PrismaService) {}

  async getWonProposals(userId: string): Promise<ExternalProposalOut[]> {
    const proposals = await this.prisma.proposal.findMany({
      where: {
        userId,
        status: ProposalStatus.GANADA,
        deletedAt: null,
      },
      include: externalProposalInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return proposals.map((p) => this.mapProposal(p));
  }

  private mapProposal(p: ExternalProposalWithRelations): ExternalProposalOut {
    return {
      id: p.id,
      proposalCode: p.proposalCode,
      clientName: p.clientName,
      subject: p.subject,
      issueDate: p.issueDate ? p.issueDate.toISOString() : null,
      issueCity: p.issueCity,
      validityDays: p.validityDays,
      validityDate: p.validityDate ? p.validityDate.toISOString() : null,
      closeDate: p.closeDate ? p.closeDate.toISOString() : null,
      billingDate: p.billingDate ? p.billingDate.toISOString() : null,
      acquisitionType: p.acquisitionType,
      status: p.status,
      scenarios: p.scenarios.map((s) => this.mapScenario(s)),
    };
  }

  private mapScenario(
    s: ExternalProposalWithRelations['scenarios'][number],
  ): ExternalScenarioOut {
    const pricingItems = s.scenarioItems.map(toPricingScenarioItem);

    const items: ExternalItemOut[] = s.scenarioItems.map((si, idx) => {
      const display = calculateItemDisplayValues(
        pricingItems[idx],
        pricingItems,
        s.currency,
        s.conversionTrm,
      );
      const specs = toTechnicalSpecs(si.item.technicalSpecs);
      return {
        scenarioItemId: si.id,
        itemId: si.item.id,
        itemType: si.item.itemType,
        itemTypeLabel: resolveItemTypeLabel(si.item.itemType),
        name: si.item.name,
        description: si.item.description,
        brand: pickSpecString(specs, 'fabricante'),
        partNumber: pickSpecString(specs, 'numeroParte'),
        formato: pickSpecString(specs, 'formato'),
        modelo: pickSpecString(specs, 'modelo'),
        quickSpecs: buildQuickDescription(si.item.itemType, specs),
        quantity: si.quantity,
        unitCost: Number(si.item.unitCost),
        costCurrency: si.item.costCurrency,
        fletePct: extractFletePct(si.item.internalCosts),
        proveedor: extractProveedor(si.item.internalCosts),
        marginPct: si.item.marginPct === null ? null : Number(si.item.marginPct),
        marginPctOverride: toNumber(si.marginPctOverride),
        unitCostOverride: toNumber(si.unitCostOverride),
        unitPriceOverride: toNumber(si.unitPriceOverride),
        isTaxable: si.item.isTaxable,
        deliveryDays: si.item.deliveryDays,
        isDiluted: si.isDiluted,
        technicalSpecs: specs,
        unitSalePrice: display.unitPrice,
        children: si.children.map(mapChildOut),
      };
    });

    return {
      id: s.id,
      name: s.name,
      currency: s.currency,
      conversionTrm: s.conversionTrm,
      items,
    };
  }
}
