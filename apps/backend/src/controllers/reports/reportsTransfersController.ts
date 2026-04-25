import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

function parseYmd(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  const [y, m, d] = value.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return fallback;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function endOfUtcDay(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

function defaultRange(): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0)
  );
  return { from, to };
}

/**
 * Reporte agregado de movimientos TRANSFER (kardex).
 * Query: `from`, `to` en formato YYYY-MM-DD (UTC). Por defecto últimos 30 días.
 */
export const getTransfersReport = async (req: Request, res: Response) => {
  try {
    const def = defaultRange();
    let from = parseYmd(req.query.from, def.from);
    let to = parseYmd(req.query.to, def.to);
    if (typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) {
      to = endOfUtcDay(req.query.to);
    }
    if (from > to) {
      res.status(400).json({ error: 'La fecha inicial no puede ser posterior a la final' });
      return;
    }

    const whereMovement: Prisma.InventoryMovementWhereInput = {
      type: 'TRANSFER',
      createdAt: { gte: from, lte: to },
    };

    const [kpiAgg, timeSeries, topProducts, routes, detailRows] = await Promise.all([
      prisma.inventoryMovement.aggregate({
        where: whereMovement,
        _count: { id: true },
        _sum: { quantity: true },
      }),
      prisma.$queryRaw<
        { day: Date; movement_count: number; total_qty: number }[]
      >(Prisma.sql`
        SELECT ("createdAt"::date) AS day,
               COUNT(*)::int AS movement_count,
               COALESCE(SUM(quantity), 0)::float AS total_qty
        FROM inventory_movements
        WHERE type = 'TRANSFER'
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      prisma.$queryRaw<
        {
          product_id: number;
          internal_code: string;
          name: string;
          unit_of_measure: string;
          total_qty: number;
        }[]
      >(Prisma.sql`
        SELECT p.id AS product_id,
               p."internalCode" AS internal_code,
               p.name AS name,
               p."unitOfMeasure"::text AS unit_of_measure,
               COALESCE(SUM(im.quantity), 0)::float AS total_qty
        FROM inventory_movements im
        INNER JOIN products p ON p.id = im."productId"
        WHERE im.type = 'TRANSFER'
          AND im."createdAt" >= ${from}
          AND im."createdAt" <= ${to}
        GROUP BY p.id, p."internalCode", p.name, p."unitOfMeasure"
        ORDER BY total_qty DESC
        LIMIT 12
      `),
      prisma.$queryRaw<
        {
          source_id: number | null;
          source_name: string | null;
          dest_id: number | null;
          dest_name: string | null;
          movement_count: number;
          total_qty: number;
        }[]
      >(Prisma.sql`
        SELECT sw.id AS source_id,
               sw.name AS source_name,
               dw.id AS dest_id,
               dw.name AS dest_name,
               COUNT(*)::int AS movement_count,
               COALESCE(SUM(im.quantity), 0)::float AS total_qty
        FROM inventory_movements im
        LEFT JOIN warehouses sw ON sw.id = im."sourceWarehouseId"
        LEFT JOIN warehouses dw ON dw.id = im."destinationWarehouseId"
        WHERE im.type = 'TRANSFER'
          AND im."createdAt" >= ${from}
          AND im."createdAt" <= ${to}
        GROUP BY sw.id, sw.name, dw.id, dw.name
        ORDER BY total_qty DESC NULLS LAST
        LIMIT 20
      `),
      prisma.inventoryMovement.findMany({
        where: whereMovement,
        orderBy: { createdAt: 'desc' },
        take: 400,
        select: {
          id: true,
          quantity: true,
          createdAt: true,
          notes: true,
          product: {
            select: { id: true, internalCode: true, name: true, unitOfMeasure: true },
          },
          sourceWarehouse: { select: { id: true, name: true } },
          destinationWarehouse: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    const productIds = await prisma.inventoryMovement.findMany({
      where: whereMovement,
      distinct: ['productId'],
      select: { productId: true },
    });
    const whRows = await prisma.$queryRaw<{ c: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT w)::bigint AS c
      FROM (
        SELECT "sourceWarehouseId" AS w
        FROM inventory_movements
        WHERE type = 'TRANSFER'
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND "sourceWarehouseId" IS NOT NULL
        UNION
        SELECT "destinationWarehouseId" AS w
        FROM inventory_movements
        WHERE type = 'TRANSFER'
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND "destinationWarehouseId" IS NOT NULL
      ) x
    `);

    const distinctWarehouses = Number(whRows[0]?.c ?? 0);

    res.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      kpis: {
        movementCount: kpiAgg._count.id,
        totalQuantity: kpiAgg._sum.quantity ?? 0,
        distinctProducts: productIds.length,
        distinctWarehouses,
      },
      timeSeries: timeSeries.map((r) => ({
        day: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
        movementCount: r.movement_count,
        totalQuantity: r.total_qty,
      })),
      topProducts: topProducts.map((r) => ({
        productId: r.product_id,
        internalCode: r.internal_code,
        name: r.name,
        unitOfMeasure: r.unit_of_measure,
        totalQuantity: r.total_qty,
      })),
      routes: routes.map((r) => ({
        sourceWarehouseId: r.source_id,
        sourceWarehouseName: r.source_name ?? '—',
        destinationWarehouseId: r.dest_id,
        destinationWarehouseName: r.dest_name ?? '—',
        movementCount: r.movement_count,
        totalQuantity: r.total_qty,
      })),
      details: detailRows.map((m) => ({
        id: m.id,
        quantity: m.quantity,
        createdAt: m.createdAt.toISOString(),
        notes: m.notes,
        product: m.product,
        sourceWarehouse: m.sourceWarehouse,
        destinationWarehouse: m.destinationWarehouse,
        user: m.user,
      })),
    });
  } catch (error) {
    console.error('getTransfersReport:', error);
    res.status(500).json({ error: 'Error interno al generar el reporte de traslados' });
  }
};
