import { apiFetch } from '@/utils/apiFetch';

export type IngredientCatalogItem = {
  id: number;
  name: string;
  category?: string | null;
  caloriesPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  proteinPer100g?: number | null;
  sugarPer100g?: number | null;
  sodiumPer100g?: number | null;
  isSystem?: boolean;
};

export type CreateIngredientCatalogPayload = {
  name: string;
  category?: string;
  caloriesPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  proteinPer100g?: number;
  sugarPer100g?: number;
  sodiumPer100g?: number;
};

export async function fetchIngredientCatalog(): Promise<
  IngredientCatalogItem[]
> {
  return apiFetch<IngredientCatalogItem[]>('/ingredient-catalog');
}

export async function createIngredientCatalogItem(
  payload: CreateIngredientCatalogPayload
): Promise<IngredientCatalogItem> {
  return apiFetch<IngredientCatalogItem>('/ingredient-catalog', {
    method: 'POST',
    json: payload,
  });
}