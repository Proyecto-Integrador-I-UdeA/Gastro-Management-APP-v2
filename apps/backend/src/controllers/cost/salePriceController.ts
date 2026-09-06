import { MenuItemPrice, Prisma } from '@prisma/client';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { salePriceInputSchema } from '../../schemas/salePriceSchema';
import {
  calculateMenuItemSalePricePreview,
  listMenuItemSalePrices,
  publishMenuItemPrice,
  SalePricePreview,
} from '../../services/pricing/menuItemPriceService';
import {
  InvalidCostComponentError,
  InvalidOperationalCostConfigError,
  InvalidSalePriceInputError,
  MenuItemCostNotFoundError,
  RecipeCostNotFoundError,
  RecipeCycleError,
  SalePriceOutOfRangeError,
} from '../../services/pricing/pricingErrors';

function parseMenuItemId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function serializePrice(price: MenuItemPrice) {
  return {
    id: price.id,
    menuItemId: price.menuItemId,
    baseCostSnapshot: price.baseCostSnapshot.toFixed(4),
    indirectCostSnapshot: price.indirectCostSnapshot.toFixed(4),
    totalCostSnapshot: price.totalCostSnapshot.toFixed(4),
    marginRate: price.marginRate.toFixed(6),
    taxRate: price.taxRate.toFixed(6),
    priceBeforeTax: price.priceBeforeTax.toFixed(4),
    taxAmount: price.taxAmount.toFixed(4),
    calculatedAmount: price.calculatedAmount.toFixed(4),
    roundingIncrement: price.roundingIncrement.toFixed(2),
    amount: price.amount.toFixed(2),
    currency: price.currency,
    taxIncluded: price.taxIncluded,
    calculationVersion: price.calculationVersion,
    createdById: price.createdById,
    validFrom: price.validFrom.toISOString(),
    validUntil: price.validUntil?.toISOString() ?? null,
    createdAt: price.createdAt.toISOString(),
  };
}

function serializePreview(preview: SalePricePreview) {
  return {
    menuItemId: preview.menuItemId,
    cost: {
      baseCost: preview.cost.baseCost.toFixed(4),
      indirectCost: preview.cost.indirectCost.toFixed(4),
      totalCost: preview.cost.totalCost.toFixed(4),
    },
    pricing: {
      marginRate: preview.pricing.marginRate.toFixed(6),
      taxRate: preview.pricing.taxRate.toFixed(6),
      priceBeforeTax: preview.pricing.priceBeforeTax.toFixed(4),
      taxAmount: preview.pricing.taxAmount.toFixed(4),
      calculatedAmount: preview.pricing.calculatedAmount.toFixed(4),
      roundingIncrement: preview.pricing.roundingIncrement.toFixed(2),
      amount: preview.pricing.amount.toFixed(2),
      currency: preview.pricing.currency,
      taxIncluded: preview.pricing.taxIncluded,
      calculationVersion: preview.pricing.calculationVersion,
    },
    currentPrice: preview.currentPrice ? serializePrice(preview.currentPrice) : null,
  };
}

function handleSalePriceError(error: unknown, res: Response) {
  if (error instanceof MenuItemCostNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (
    error instanceof RecipeCycleError
    || error instanceof RecipeCostNotFoundError
    || error instanceof InvalidCostComponentError
    || error instanceof InvalidOperationalCostConfigError
    || error instanceof InvalidSalePriceInputError
    || error instanceof SalePriceOutOfRangeError
  ) {
    return res.status(422).json({ error: error.message });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Conflicto al publicar el precio vigente' });
    }
    if (error.code === 'P2003') {
      return res.status(401).json({ error: 'El usuario autenticado ya no existe' });
    }
  }

  console.error('Error procesando precio de venta:', error);
  return res.status(500).json({ error: 'Error interno procesando precio de venta' });
}

function parsePriceRequest(req: AuthenticatedRequest, res: Response) {
  const menuItemId = parseMenuItemId(req.params.menuItemId);
  if (menuItemId === null) {
    res.status(400).json({ error: 'menuItemId inválido' });
    return null;
  }

  const validation = salePriceInputSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Datos de precio inválidos',
      details: validation.error.issues,
    });
    return null;
  }

  return { menuItemId, rates: validation.data };
}

export const calculateSalePricePreview = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const parsed = parsePriceRequest(req, res);
  if (!parsed) return;

  try {
    return res.json(serializePreview(
      await calculateMenuItemSalePricePreview(parsed.menuItemId, parsed.rates),
    ));
  } catch (error) {
    return handleSalePriceError(error, res);
  }
};

export const publishSalePrice = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const parsed = parsePriceRequest(req, res);
  if (!parsed) return;

  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const published = await publishMenuItemPrice(
      parsed.menuItemId,
      parsed.rates,
      req.user.id,
    );
    return res.status(201).json(serializePreview(published));
  } catch (error) {
    return handleSalePriceError(error, res);
  }
};

export const getSalePriceHistory = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const menuItemId = parseMenuItemId(req.params.menuItemId);
  if (menuItemId === null) {
    return res.status(400).json({ error: 'menuItemId inválido' });
  }

  try {
    const prices = await listMenuItemSalePrices(menuItemId);
    return res.json(prices.map(serializePrice));
  } catch (error) {
    return handleSalePriceError(error, res);
  }
};
