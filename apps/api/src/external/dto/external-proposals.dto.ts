export interface ExternalItemOut {
  scenarioItemId: string;
  itemId: string;
  itemType: string;
  itemTypeLabel: string;
  name: string;
  description: string | null;
  brand: string | null;
  partNumber: string | null;
  formato: string | null;
  modelo: string | null;
  tipo: string | null;
  responsable: string | null;
  quickSpecs: string;
  quantity: number;
  unitCost: number;
  costCurrency: string;
  fletePct: number | null;
  proveedor: string | null;
  supplierCompanyName: string | null;
  supplierContactName: string | null;
  supplierContactPhone: string | null;
  supplierContactEmail: string | null;
  marginPct: number | null;
  marginPctOverride: number | null;
  unitCostOverride: number | null;
  unitPriceOverride: number | null;
  isTaxable: boolean;
  deliveryDays: number | null;
  isDiluted: boolean;
  technicalSpecs: Record<string, unknown> | null;
  unitSalePrice: number | null;
  children: ExternalChildItemOut[];
}

export interface ExternalChildItemOut {
  scenarioItemId: string;
  itemId: string;
  itemType: string;
  itemTypeLabel: string;
  name: string;
  description: string | null;
  brand: string | null;
  partNumber: string | null;
  formato: string | null;
  modelo: string | null;
  tipo: string | null;
  responsable: string | null;
  quickSpecs: string;
  quantity: number;
  unitCost: number;
  costCurrency: string;
  unitCostOverride: number | null;
  fletePct: number | null;
  proveedor: string | null;
  supplierCompanyName: string | null;
  supplierContactName: string | null;
  supplierContactPhone: string | null;
  supplierContactEmail: string | null;
  isTaxable: boolean;
  deliveryDays: number | null;
  technicalSpecs: Record<string, unknown> | null;
}

export interface ExternalScenarioOut {
  id: string;
  name: string;
  currency: string;
  conversionTrm: number | null;
  items: ExternalItemOut[];
}

export interface ExternalProposalOut {
  id: string;
  proposalCode: string | null;
  clientName: string;
  subject: string;
  issueDate: string | null;
  issueCity: string | null;
  validityDays: number | null;
  validityDate: string | null;
  closeDate: string | null;
  billingDate: string | null;
  acquisitionType: string | null;
  status: string;
  scenarios: ExternalScenarioOut[];
}
