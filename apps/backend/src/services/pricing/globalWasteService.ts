import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';
import { InvalidCostComponentError } from './pricingErrors';

export const GLOBAL_WASTE_CONFIG_ID = 1;

type WasteClient = PrismaClient | Prisma.TransactionClient;
type DecimalValue = Prisma.Decimal.Value;

function isMissingWasteConfigTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2021';
}

export function validateWastePercent(value: DecimalValue): Prisma.Decimal {
  let percent: Prisma.Decimal;
  try {
    percent = new Prisma.Decimal(value);
  } catch {
    throw new InvalidCostComponentError('wastePercent debe ser un decimal válido');
  }
  if (!percent.isFinite() || percent.lt(0) || percent.gt(100)) {
    throw new InvalidCostComponentError('wastePercent debe estar entre 0 y 100');
  }
  if (percent.decimalPlaces() > 2) {
    throw new InvalidCostComponentError(
      'wastePercent admite máximo 2 posiciones decimales',
    );
  }
  return percent;
}

export function wasteFactor(value: DecimalValue): Prisma.Decimal {
  return new Prisma.Decimal(1).plus(validateWastePercent(value).div(100));
}

export function applyWasteFactor(
  theoreticalValue: DecimalValue,
  percent: DecimalValue,
): Prisma.Decimal {
  return new Prisma.Decimal(theoreticalValue).mul(wasteFactor(percent));
}

export async function getGlobalWastePercent(
  client: WasteClient = prisma,
): Promise<Prisma.Decimal> {
  try {
    const config = await client.globalWasteConfig.findUnique({
      where: { id: GLOBAL_WASTE_CONFIG_ID },
      select: { wastePercent: true },
    });
    return config?.wastePercent ?? new Prisma.Decimal(0);
  } catch (error) {
    if (isMissingWasteConfigTable(error)) return new Prisma.Decimal(0);
    throw error;
  }
}

export async function getGlobalWasteConfig(client: WasteClient = prisma) {
  let config: {
    wastePercent: Prisma.Decimal;
    updatedAt: Date;
    updatedBy: { id: number; fullName: string | null } | null;
  } | null;
  try {
    config = await client.globalWasteConfig.findUnique({
      where: { id: GLOBAL_WASTE_CONFIG_ID },
      select: {
        wastePercent: true,
        updatedAt: true,
        updatedBy: { select: { id: true, fullName: true } },
      },
    });
  } catch (error) {
    if (!isMissingWasteConfigTable(error)) throw error;
    config = null;
  }
  return {
    wastePercent: (config?.wastePercent ?? new Prisma.Decimal(0)).toNumber(),
    updatedAt: config?.updatedAt.toISOString() ?? null,
    updatedBy: config?.updatedBy ?? null,
  };
}

export async function updateGlobalWasteConfig(
  wastePercentValue: DecimalValue,
  changedById: number,
) {
  const newPercent = validateWastePercent(wastePercentValue);
  return prisma.$transaction(async transaction => {
    await transaction.$queryRaw`
      SELECT "id" FROM "global_waste_config" WHERE "id" = ${GLOBAL_WASTE_CONFIG_ID}
      FOR UPDATE
    `;
    const current = await transaction.globalWasteConfig.upsert({
      where: { id: GLOBAL_WASTE_CONFIG_ID },
      create: { id: GLOBAL_WASTE_CONFIG_ID, wastePercent: 0 },
      update: {},
      select: { wastePercent: true },
    });
    if (!current.wastePercent.eq(newPercent)) {
      await transaction.globalWasteConfigAudit.create({
        data: {
          configId: GLOBAL_WASTE_CONFIG_ID,
          previousPercent: current.wastePercent,
          newPercent,
          changedById,
        },
      });
      await transaction.globalWasteConfig.update({
        where: { id: GLOBAL_WASTE_CONFIG_ID },
        data: { wastePercent: newPercent, updatedById: changedById },
      });
    }
    return getGlobalWasteConfig(transaction);
  });
}
