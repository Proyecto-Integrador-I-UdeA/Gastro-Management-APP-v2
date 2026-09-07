import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type AuthoritativeRecipeCostState =
  | { status: 'loading' }
  | { status: 'ready'; costPerPortion: number }
  | { status: 'error'; message: string };

type RecipeReference = {
  id: number;
};

export type AuthoritativeRecipeCosts = Record<
  number,
  AuthoritativeRecipeCostState
>;

export function useAuthoritativeRecipeCosts(
  recipes: ReadonlyArray<RecipeReference>,
): AuthoritativeRecipeCosts {
  const recipeIdsKey = useMemo(
    () => Array.from(new Set(recipes.map(recipe => Number(recipe.id))))
      .filter(Number.isInteger)
      .sort((left, right) => left - right)
      .join(','),
    [recipes],
  );
  const [costs, setCosts] = useState<AuthoritativeRecipeCosts>({});

  useEffect(() => {
    const recipeIds = recipeIdsKey === ''
      ? []
      : recipeIdsKey.split(',').map(Number);
    let cancelled = false;

    setCosts(Object.fromEntries(
      recipeIds.map(recipeId => [recipeId, { status: 'loading' }]),
    ));

    recipeIds.forEach(recipeId => {
      void apiFetch(`/costs/recipe/${recipeId}`)
        .then(response => {
          const costPerPortion = Number(response?.costPerPortion);
          if (!Number.isFinite(costPerPortion) || costPerPortion < 0) {
            throw new Error('Costo por porción inválido');
          }

          if (!cancelled) {
            setCosts(current => ({
              ...current,
              [recipeId]: { status: 'ready', costPerPortion },
            }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCosts(current => ({
              ...current,
              [recipeId]: {
                status: 'error',
                message: 'No se pudo obtener el costo actualizado de esta receta.',
              },
            }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [recipeIdsKey]);

  return costs;
}
