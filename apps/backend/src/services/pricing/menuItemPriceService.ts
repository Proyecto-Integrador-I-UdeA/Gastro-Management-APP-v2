import { MenuItemPrice, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  calculateMenuItemCost,
  createPrismaMenuItemCostDataSource,
  MenuItemCostResult,
} from './menuItemCostService';
import {
  calculateSalePrice,
  SalePriceCalculation,
} from './salePriceCalculator';
import { MenuItemCostNotFoundError } from './pricingErrors';
import { normalizeMenuItemCostForPricing } from './salePricePrecision';

export type SalePriceRates = {
  marginRate: string;
  taxRate: string;
};

export type SalePricePreview = {
  menuItemId: number;
  cost: MenuItemCostResult;
  pricing: SalePriceCalculation;
  currentPrice: MenuItemPrice | null;
};

export async function calculateMenuItemSalePricePreview(
  menuItemId: number,
  rates: SalePriceRates,
): Promise<SalePricePreview> {
  const cost = normalizeMenuItemCostForPricing(
    await calculateMenuItemCost(menuItemId),
  );
  const pricing = calculateSalePrice({
    totalCost: cost.totalCost,
    marginRate: rates.marginRate,
    taxRate: rates.taxRate,
  });
  const currentPrice = await prisma.menuItemPrice.findFirst({
    where: { menuItemId, validUntil: null },
  });

  return { menuItemId, cost, pricing, currentPrice };
}

export async function publishMenuItemPrice(
  menuItemId: number,
  rates: SalePriceRates,
  actorId: number,
): Promise<SalePricePreview> {
  return prisma.$transaction(async transaction => {
    const lockedMenuItems = await transaction.$queryRaw<Array<{ id: number }>>`
      SELECT "id"
      FROM "MenuItem"
      WHERE "id" = ${menuItemId}
      FOR UPDATE
    `;

    if (lockedMenuItems.length === 0) {
      throw new MenuItemCostNotFoundError();
    }

    const cost = normalizeMenuItemCostForPricing(
      await calculateMenuItemCost(
        menuItemId,
        createPrismaMenuItemCostDataSource(transaction),
      ),
    );
    const pricing = calculateSalePrice({
      totalCost: cost.totalCost,
      marginRate: rates.marginRate,
      taxRate: rates.taxRate,
    });
    const timestamps = await transaction.$queryRaw<Array<{ publishedAt: Date }>>`
      SELECT GREATEST(
        clock_timestamp(),
        COALESCE(
          MAX("validFrom") + INTERVAL '1 millisecond',
          clock_timestamp()
        )
      ) AS "publishedAt"
      FROM "menu_item_prices"
      WHERE "menuItemId" = ${menuItemId}
    `;
    const publishedAt = timestamps[0].publishedAt;

    await transaction.menuItemPrice.updateMany({
      where: { menuItemId, validUntil: null },
      data: { validUntil: publishedAt },
    });

    const currentPrice = await transaction.menuItemPrice.create({
      data: {
        menuItemId,
        baseCostSnapshot: cost.baseCost,
        indirectCostSnapshot: cost.indirectCost,
        totalCostSnapshot: cost.totalCost,
        marginRate: pricing.marginRate,
        taxRate: pricing.taxRate,
        priceBeforeTax: pricing.priceBeforeTax,
        taxAmount: pricing.taxAmount,
        calculatedAmount: pricing.calculatedAmount,
        roundingIncrement: pricing.roundingIncrement,
        amount: pricing.amount,
        currency: pricing.currency,
        taxIncluded: pricing.taxIncluded,
        calculationVersion: pricing.calculationVersion,
        createdById: actorId,
        validFrom: publishedAt,
      },
    });

    return { menuItemId, cost, pricing, currentPrice };
  });
}

export async function listMenuItemSalePrices(menuItemId: number) {
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    select: { id: true },
  });
  if (!menuItem) throw new MenuItemCostNotFoundError();

  const prices = await prisma.menuItemPrice.findMany({
    where: { menuItemId },
    orderBy: { validFrom: 'desc' },
  });

  return prices.sort((left, right) => {
    if (left.validUntil === null && right.validUntil !== null) return -1;
    if (left.validUntil !== null && right.validUntil === null) return 1;
    return right.validFrom.getTime() - left.validFrom.getTime();
  });
}
