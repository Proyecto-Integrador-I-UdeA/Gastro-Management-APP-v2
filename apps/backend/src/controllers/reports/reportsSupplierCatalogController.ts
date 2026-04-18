import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export interface SupplierCatalogRow {
  supplierId: number;
  internalCode: string;
  name: string;
  taxId: string;
  active: boolean;
  activeProductCount: number;
  totalProductCount: number;
}

/**
 * Catálogo de proveedores y conteo de productos (activos / total).
 * Sin movimientos de compra (fase 1).
 */
export const getSuppliersCatalogReport = async (_req: Request, res: Response) => {
  try {
    const activeBySupplier = await prisma.product.groupBy({
      by: ['supplierId'],
      where: { active: true },
      _count: { id: true },
    });

    const totalBySupplier = await prisma.product.groupBy({
      by: ['supplierId'],
      _count: { id: true },
    });

    const activeMap = new Map<number, number>();
    for (const row of activeBySupplier) {
      activeMap.set(row.supplierId, row._count.id);
    }

    const totalMap = new Map<number, number>();
    for (const row of totalBySupplier) {
      totalMap.set(row.supplierId, row._count.id);
    }

    const suppliers = await prisma.supplier.findMany({
      orderBy: { internalCode: 'asc' },
    });

    const rows: SupplierCatalogRow[] = suppliers.map((s) => ({
      supplierId: s.id,
      internalCode: s.internalCode,
      name: s.name,
      taxId: s.taxId,
      active: s.active,
      activeProductCount: activeMap.get(s.id) ?? 0,
      totalProductCount: totalMap.get(s.id) ?? 0,
    }));

    const kpis = {
      totalSuppliers: rows.length,
      activeSuppliers: rows.filter((r) => r.active).length,
      inactiveSuppliers: rows.filter((r) => !r.active).length,
      /** Proveedor activo en catálogo sin ningún producto activo asignado */
      activeWithNoActiveProducts: rows.filter(
        (r) => r.active && r.activeProductCount === 0
      ).length,
    };

    const topByActiveProducts = [...rows]
      .filter((r) => r.activeProductCount > 0)
      .sort((a, b) => b.activeProductCount - a.activeProductCount)
      .slice(0, 10);

    const noActiveProducts = rows.filter(
      (r) => r.active && r.activeProductCount === 0
    );

    res.json({
      kpis,
      rows,
      rankings: {
        topByActiveProducts,
        noActiveProducts,
      },
    });
  } catch (error) {
    console.error('getSuppliersCatalogReport:', error);
    res.status(500).json({ error: 'Error interno al generar el reporte' });
  }
};
