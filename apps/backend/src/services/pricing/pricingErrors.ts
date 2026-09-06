export class MenuItemCostNotFoundError extends Error {
  constructor() {
    super('MenuItem no encontrado');
    this.name = 'MenuItemCostNotFoundError';
  }
}

export class RecipeCostNotFoundError extends Error {
  constructor(recipeId: number) {
    super(`Receta ${recipeId} no encontrada`);
    this.name = 'RecipeCostNotFoundError';
  }
}

export class RecipeCycleError extends Error {
  constructor(recipeIds: number[]) {
    super(`Se detectó un ciclo de recetas: ${recipeIds.join(' -> ')}`);
    this.name = 'RecipeCycleError';
  }
}

export class InvalidCostComponentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCostComponentError';
  }
}

export class InvalidOperationalCostConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOperationalCostConfigError';
  }
}

export class InvalidSalePriceInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSalePriceInputError';
  }
}

export class SalePriceOutOfRangeError extends Error {
  constructor(field: string, maximum: string) {
    super(`${field} excede el máximo representable de ${maximum}`);
    this.name = 'SalePriceOutOfRangeError';
  }
}
