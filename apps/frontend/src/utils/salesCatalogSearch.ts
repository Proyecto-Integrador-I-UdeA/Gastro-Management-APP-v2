export type SearchableSalesCatalogItem = {
  id: number;
  name: string;
  description: string | null;
  kind: "STANDARD" | "ADDITION";
  available: boolean;
  category: { name: string };
};

export function normalizeSalesSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/\s+/g, " ");
}

function kindSearchText(kind: SearchableSalesCatalogItem["kind"]): string {
  return kind === "ADDITION"
    ? "addition adicion adicional"
    : "standard estandar plato producto";
}

function relevance(item: SearchableSalesCatalogItem, query: string): number | null {
  if (!query) return 0;

  const name = normalizeSalesSearchText(item.name);
  const category = normalizeSalesSearchText(item.category.name);
  const description = normalizeSalesSearchText(item.description ?? "");
  const kind = kindSearchText(item.kind);

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (category.includes(query)) return 3;
  if (description.includes(query)) return 4;
  if (kind.includes(query)) return 5;
  return null;
}

export function searchSalesCatalogItems<T extends SearchableSalesCatalogItem>(
  items: readonly T[],
  rawQuery: string,
): T[] {
  const query = normalizeSalesSearchText(rawQuery);

  return items
    .map(item => ({ item, relevance: relevance(item, query) }))
    .filter((entry): entry is { item: T; relevance: number } => entry.relevance !== null)
    .sort((left, right) => (
      Number(right.item.available) - Number(left.item.available)
      || left.relevance - right.relevance
      || normalizeSalesSearchText(left.item.name).localeCompare(
        normalizeSalesSearchText(right.item.name),
        "es",
      )
      || left.item.id - right.item.id
    ))
    .map(entry => entry.item);
}
