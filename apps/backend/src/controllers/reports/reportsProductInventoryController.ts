import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export type InventoryRiskLevel = 'zero' | 'low' | 'high' | 'ok';

export interface ProductInventoryRiskRow {
  productId: number;
  internalCode: string;
  name: string;
  unitOfMeasure: string;
  supplierName: string;
  minStock: number;
  maxStock: number;
  totalQuantity: number;
  risk: InventoryRiskLevel;
  deficitBelowMin: number | null;
  excessAboveMax: number | null;
}

function classifyRisk(
  total: number,
  minStock: number,
  maxStock: number
): {
  risk: InventoryRiskLevel;
  deficitBelowMin: number | null;
  excessAboveMax: number | null;
} {
  let risk: InventoryRiskLevel;
  if (total <= 0) {
    risk = 'zero';
  } else if (total < minStock) {
    risk = 'low';
  } else if (maxStock > 0 && total > maxStock) {
    risk = 'high';
  } else {
    risk = 'ok';
  }

  const deficitBelowMin =
    total < minStock ? Math.max(0, minStock - total) : null;
  const excessAboveMax =
    maxStock > 0 && total > maxStock ? total - maxStock : null;

  return { risk, deficitBelowMin, excessAboveMax };
}

/**
 * Agregado por producto (suma de `inventories` en todas las bodegas).
 * Solo productos activos. Pensado para reportes (permiso `reports.read`).
 */
export const getProductsInventoryRisk = async (_req: Request, res: Response) => {
  try {
    const sums = await prisma.inventory.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
    });

    const sumByProduct = new Map<number, number>();
    for (const row of sums) {
      sumByProduct.set(row.productId, row._sum.quantity ?? 0);
    }

    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { internalCode: 'asc' },
      include: {
        supplier: { select: { name: true } },
      },
    });

    const rows: ProductInventoryRiskRow[] = products.map((p) => {
      const total = sumByProduct.get(p.id) ?? 0;
      const { risk, deficitBelowMin, excessAboveMax } = classifyRisk(
        total,
        p.minStock,
        p.maxStock
      );
      return {
        productId: p.id,
        internalCode: p.internalCode,
        name: p.name,
        unitOfMeasure: p.unitOfMeasure,
        supplierName: p.supplier.name,
        minStock: p.minStock,
        maxStock: p.maxStock,
        totalQuantity: total,
        risk,
        deficitBelowMin,
        excessAboveMax,
      };
    });

    const kpis = {
      totalActiveProducts: rows.length,
      zeroStock: rows.filter((r) => r.risk === 'zero').length,
      lowStock: rows.filter((r) => r.risk === 'low').length,
      highStock: rows.filter((r) => r.risk === 'high').length,
      okStock: rows.filter((r) => r.risk === 'ok').length,
    };

    const criticalLow = [...rows]
      .filter((r) => r.totalQuantity < r.minStock)
      .sort(
        (a, b) =>
          (b.deficitBelowMin ?? 0) - (a.deficitBelowMin ?? 0)
      )
      .slice(0, 10);

    const highExcess = [...rows]
      .filter((r) => r.maxStock > 0 && r.totalQuantity > r.maxStock)
      .sort(
        (a, b) =>
          (b.excessAboveMax ?? 0) - (a.excessAboveMax ?? 0)
      )
      .slice(0, 10);

    res.json({
      kpis,
      rows,
      rankings: { criticalLow, highExcess },
    });
  } catch (error) {
    console.error('getProductsInventoryRisk:', error);
    res.status(500).json({ error: 'Error interno al generar el reporte' });
  }
};
