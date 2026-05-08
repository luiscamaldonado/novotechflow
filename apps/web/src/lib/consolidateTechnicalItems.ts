// ──────────────────────────────────────────────────────────
// Consolidación de items técnicos — Deduplicación y variantes
// Funciones puras, sin dependencias de React/estado
// ──────────────────────────────────────────────────────────

import type {
    ProcessedScenario,
    VisibleItemCalc,
} from '../hooks/useProposalScenarios';

/** Código ASCII de 'A', usado para generar etiquetas de variante (A, B, C, ...) */
const ASCII_UPPERCASE_A = 65;

// ── Interfaces exportadas ────────────────────────────────

/**
 * Item técnico consolidado para la sección "Propuesta Técnica" del PDF.
 * Cada entrada representa una variante única (misma combinación de
 * itemType + name + specs hash). Si solo hay una variante para un
 * grupo itemType+name, `variantLabel` es null.
 */
export interface ConsolidatedTechItem {
    /** Numeración global 1..N en el orden final consolidado */
    globalIndex: number;
    /** Primera ocurrencia visible de esta variante (la usamos para renderizar la ficha) */
    item: VisibleItemCalc;
    /**
     * "Config A" | "Config B" | ... cuando hay ≥2 variantes del mismo
     * itemType+name. null si solo hay una variante.
     */
    variantLabel: string | null;
}

/**
 * Resultado completo de la consolidación.
 * `items` contiene los items deduplicados en orden global.
 * `variantLabelByScenarioItemId` permite etiquetar cada aparición
 * individual en cualquier escenario (útil para la Propuesta Económica).
 */
export interface ConsolidationResult {
    items: ConsolidatedTechItem[];
    /**
     * Mapa scenarioItem.id → variantLabel.
     * Cubre TODAS las apariciones visibles del item en cualquier escenario,
     * no solo la primera. Items con isDiluted=true (ya filtrados de
     * visibleItems) no entran al mapa.
     */
    variantLabelByScenarioItemId: Map<string, string | null>;
}

// ── Helpers internos ─────────────────────────────────────

/** Información rastreada para cada variante dentro de un grupo itemType+name */
interface VariantInfo {
    specsHash: string;
    firstItem: VisibleItemCalc;
    scenarioItemIds: string[];
}

/** Grupo de variantes para una combinación itemType + name */
interface DeduplicationGroup {
    variants: VariantInfo[];
}

/**
 * Construye la dedup-key principal: `${itemType}::${name.trim().toLowerCase()}`.
 * Dos items con el mismo nombre pero distinto itemType son items distintos.
 */
function buildDedupKey(itemType: string, name: string): string {
    return `${itemType}::${name.trim().toLowerCase()}`;
}

/**
 * Crea un hash canónico de las technicalSpecs de un item.
 *
 * Proceso:
 * 1. Si specs es undefined o vacío, retorna string vacío.
 * 2. Descarta entries cuyo valor sea vacío o solo whitespace después de trim.
 * 3. Ordena keys alfabéticamente.
 * 4. Serializa como JSON (comparación case-sensitive en valores: "8GB" ≠ "8gb").
 */
function buildSpecsHash(specs: Record<string, string> | undefined): string {
    if (!specs) return '';

    const filteredEntries = Object.entries(specs)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0);

    if (filteredEntries.length === 0) return '';

    const sortedEntries = [...filteredEntries].sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(sortedEntries);
}

/**
 * Genera la etiqueta de variante para un índice dado (0-based).
 * Ej: 0 → "Config A", 1 → "Config B", 25 → "Config Z", 26 → "Config ["
 * (>26 no es realista; no se agrega lógica especial).
 */
function buildVariantLabel(variantIndex: number): string {
    return `Config ${String.fromCharCode(ASCII_UPPERCASE_A + variantIndex)}`;
}

// ── Función principal ────────────────────────────────────

/**
 * Consolida los items visibles de todos los escenarios procesados,
 * deduplicando por itemType + name y detectando variantes cuando
 * hay colisión de nombre con specs distintos.
 *
 * **Orden de salida:** primero todas las variantes que aparecen en el
 * primer escenario (en orden de visibleItems), luego las que aparecen
 * por primera vez en el segundo, y así sucesivamente.
 *
 * **Variantes:** dentro de un grupo (mismo itemType+name), cada hash
 * de specs distinto es una variante. Se ordenan por primera aparición.
 * Si hay ≥2 variantes → "Config A", "Config B", etc.
 * Si hay 1 sola variante → variantLabel = null.
 *
 * @param processedScenarios — escenarios ya procesados con visibleItems
 *   (que ya excluye isDiluted=true). No se mutan.
 */
export function consolidateTechnicalItems(
    processedScenarios: ProcessedScenario[],
): ConsolidationResult {
    /** Mapa dedupKey → grupo con sus variantes */
    const groupsByKey = new Map<string, DeduplicationGroup>();

    /**
     * Orden global de inserción: lista de [dedupKey, specsHash] en el
     * orden en que cada variante fue vista por primera vez.
     */
    const insertionOrder: Array<{ dedupKey: string; specsHash: string }> = [];

    // Paso 1: recorrer todos los escenarios en orden y agrupar
    for (const scenario of processedScenarios) {
        for (const visibleItem of scenario.visibleItems) {
            const { item } = visibleItem.scenarioItem;
            const dedupKey = buildDedupKey(item.itemType, item.name);
            const specsHash = buildSpecsHash(item.technicalSpecs);
            const scenarioItemId = visibleItem.scenarioItem.id;

            let group = groupsByKey.get(dedupKey);
            if (!group) {
                group = { variants: [] };
                groupsByKey.set(dedupKey, group);
            }

            const existingVariant = group.variants.find(v => v.specsHash === specsHash);

            if (existingVariant) {
                existingVariant.scenarioItemIds.push(scenarioItemId);
            } else {
                group.variants.push({
                    specsHash,
                    firstItem: visibleItem,
                    scenarioItemIds: [scenarioItemId],
                });
                insertionOrder.push({ dedupKey, specsHash });
            }
        }
    }

    // Paso 2: construir la lista consolidada en orden de primera aparición
    const items: ConsolidatedTechItem[] = [];
    const variantLabelByScenarioItemId = new Map<string, string | null>();
    let globalIndex = 1;

    for (const { dedupKey, specsHash } of insertionOrder) {
        const group = groupsByKey.get(dedupKey)!;
        const hasMultipleVariants = group.variants.length >= 2;
        const variantIndex = group.variants.findIndex(v => v.specsHash === specsHash);
        const variant = group.variants[variantIndex]!;

        const variantLabel = hasMultipleVariants
            ? buildVariantLabel(variantIndex)
            : null;

        items.push({
            globalIndex,
            item: variant.firstItem,
            variantLabel,
        });
        globalIndex++;
    }

    // Paso 3: llenar el mapa de labels para TODAS las apariciones
    for (const group of groupsByKey.values()) {
        const hasMultipleVariants = group.variants.length >= 2;

        for (let variantIndex = 0; variantIndex < group.variants.length; variantIndex++) {
            const variant = group.variants[variantIndex]!;
            const variantLabel = hasMultipleVariants
                ? buildVariantLabel(variantIndex)
                : null;

            for (const scenarioItemId of variant.scenarioItemIds) {
                variantLabelByScenarioItemId.set(scenarioItemId, variantLabel);
            }
        }
    }

    return { items, variantLabelByScenarioItemId };
}
