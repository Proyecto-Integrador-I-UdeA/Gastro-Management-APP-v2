import type { Express } from 'express';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

const SCHEMA = 'cash_01a_test';
let app: Express;
let prisma: PrismaClient;
let admin: PrismaClient;
let originalUrl: string;
let actorId: number;
let menuItemId: number;
let menuItemPriceId: number;
const auth = (permissions: string[]) => `Bearer ${createIntegrationToken(permissions, actorId)}`;
const operate = () => auth(['cash.operate']);
const read = () => auth(['cash.read']);
const reports = () => auth(['cash.reports']);

beforeAll(async () => {
  originalUrl = process.env.DATABASE_URL as string;
  const base = process.env.TEST_DATABASE_URL as string; // setup.ts verifica host y gastro_management_test.
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA);
  admin = new PrismaClient({ datasources: { db: { url: base } } });
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);
  prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  // Se valida la migración nueva sobre el schema físico real, incluida la baseline.
  const migrations = resolve(process.cwd(), 'prisma/migrations');
  for (const folder of readdirSync(migrations, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = readFileSync(resolve(migrations, folder.name, 'migration.sql'), 'utf8');
    for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
    if (folder.name === '00000000000000_canonical_baseline') await prisma.role.createMany({ data: [{ name: 'admin' }, { name: 'super' }, { name: 'chef' }] });
  }
  actorId = (await prisma.user.create({ data: { email: 'cash@test.local', passwordHash: 'not-used', fullName: 'Cajero de prueba' } })).id;
  menuItemId = (await prisma.menuItem.create({ data: { name: 'Plato de prueba' } })).id;
  menuItemPriceId = (await prisma.menuItemPrice.create({ data: { menuItemId, baseCostSnapshot: 0, indirectCostSnapshot: 0, totalCostSnapshot: 0, marginRate: 0, taxRate: 0, priceBeforeTax: 100000, taxAmount: 0, calculatedAmount: 100000, roundingIncrement: 1, amount: 100000, calculationVersion: 'cash-test', createdById: actorId, validFrom: new Date() } })).id;
  process.env.DATABASE_URL = url.toString();
  app = (await import('../../src/app')).default;
}, 120_000);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "dining_tables", "cash_sessions", "cash_service_config_audits" RESTART IDENTITY CASCADE');
  await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 0, updatedById: null } });
});

afterAll(async () => {
  if (app) await (await import('../../src/lib/prisma')).default.$disconnect();
  if (prisma) await prisma.$disconnect();
  if (admin) {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await admin.$disconnect();
  }
  process.env.DATABASE_URL = originalUrl;
});

async function fixture(sale = '100000.00', kitchen: 'DELIVERED' | 'READY' | 'PREPARING' | 'NEXT' | 'UNSENT' = 'DELIVERED') {
  const table = await prisma.diningTable.create({ data: { code: `M${await prisma.diningTable.count() + 1}`, capacity: 4 } });
  const order = await prisma.salesOrder.create({ data: { diningTableId: table.id, openedById: actorId } });
  const item = await prisma.salesOrderItem.create({ data: { salesOrderId: order.id, menuItemId, menuItemPriceId, menuItemNameSnapshot: 'Plato de prueba', quantity: 1, unitPriceSnapshot: sale, unitSalesAmountSnapshot: sale, unitConsumptionTaxAmountSnapshot: 0, currencySnapshot: 'COP', taxIncludedSnapshot: true, addedById: actorId } });
  if (kitchen !== 'UNSENT') {
    const now = new Date();
    const dispatch = await prisma.kitchenDispatch.create({ data: { salesOrderId: order.id, dispatchedById: actorId, targetReadyAt: new Date(now.getTime() + 900000), status: kitchen === 'DELIVERED' ? 'READY' : kitchen, ...(kitchen !== 'NEXT' ? { startedAt: now, startedById: actorId } : {}), ...(['READY', 'DELIVERED'].includes(kitchen) ? { readyAt: now, readyById: actorId } : {}), ...(kitchen === 'DELIVERED' ? { deliveredAt: now, deliveredById: actorId } : {}) } });
    await prisma.kitchenDispatchItem.create({ data: { kitchenDispatchId: dispatch.id, salesOrderItemId: item.id, itemNameSnapshot: 'Plato de prueba', quantitySnapshot: 1 } });
  }
  return { order, table, item };
}

async function open(openingCash = '200000.00') {
  const response = await request(app).post('/cash/session').set('Authorization', operate()).send({ openingCash });
  expect(response.status).toBe(201);
  return response.body;
}
async function invoiceFor(orderId: number, serviceAccepted = false) {
  expect((await request(app).post(`/cash/orders/${orderId}/account`).set('Authorization', operate()).send({})).status).toBe(200);
  const response = await request(app).post(`/cash/orders/${orderId}/pre-invoices`).set('Authorization', operate()).send({ serviceAccepted });
  expect(response.status).toBe(201);
  return response.body.invoice;
}
async function pay(preInvoiceId: number, amount: string, method = 'CASH', idempotencyKey = `cash-key-${crypto.randomUUID()}`, extra = {}) {
  return request(app).post('/cash/payments').set('Authorization', operate()).send({ preInvoiceId, amount, method, idempotencyKey, ...extra });
}

describe('CASH-01A autorización y configuración', () => {
  it.each([
    ['get', '/cash/dashboard', {}], ['get', '/cash/config/service', {}], ['get', '/cash/session', {}], ['get', '/cash/session/1/reconciliation', {}],
    ['get', '/cash/pending', {}], ['get', '/cash/daily-sales', {}], ['get', '/cash/sessions/history', {}],
    ['put', '/cash/config/service', { servicePercent: 10 }], ['post', '/cash/session', { openingCash: 0 }],
    ['post', '/cash/session/1/close', { countedCash: 0 }], ['post', '/cash/orders/1/account', {}],
    ['post', '/cash/orders/1/pre-invoices', { serviceAccepted: true }], ['post', '/cash/payments', {}], ['post', '/cash/orders/1/settle', {}],
  ] as const)('%s %s exige autenticación y permiso explícito', async (method, path, body) => {
    const send = (authorization?: string) => {
      const call = method === 'get' ? request(app).get(path) : method === 'put' ? request(app).put(path) : request(app).post(path);
      if (authorization) call.set('Authorization', authorization);
      return call.send(body);
    };
    expect((await send()).status).toBe(401);
    expect((await send(auth(['sales.read']))).status).toBe(403);
  });

  it('default 0, cambio auditado y permisos nuevos para admin/super', async () => {
    expect((await request(app).get('/cash/config/service').set('Authorization', auth(['cash.configure']))).body.servicePercent).toBe('0.00');
    const response = await request(app).put('/cash/config/service').set('Authorization', auth(['cash.configure'])).send({ servicePercent: '10.25' });
    expect(response.status).toBe(200);
    expect(response.body.servicePercent).toBe('10.25');
    const audit = await prisma.cashServiceConfigAudit.findFirstOrThrow();
    expect(audit.previousPercent.toFixed(2)).toBe('0.00');
    expect(audit.newPercent.toFixed(2)).toBe('10.25');
    expect(audit.changedById).toBe(actorId);
    for (const name of ['admin', 'super']) expect(await prisma.rolePermission.count({ where: { role: { name }, permission: { name: { startsWith: 'cash.' } } } })).toBe(4);
    expect(await prisma.rolePermission.count({ where: { role: { name: 'chef' }, permission: { name: { startsWith: 'cash.' } } } })).toBe(0);
  });

  it.each([-1, 101, 1.001, '0.123', 'NaN', 'Infinity', ''])('rechaza porcentaje inválido %s', async servicePercent => {
    expect((await request(app).put('/cash/config/service').set('Authorization', auth(['cash.configure'])).send({ servicePercent })).status).toBe(400);
    expect(await prisma.cashServiceConfigAudit.count()).toBe(0);
  });
  it('acepta extremos 0 y 100 y rechaza fecha/sessionId inválidos', async () => {
    for (const servicePercent of [0, 100]) expect((await request(app).put('/cash/config/service').set('Authorization', auth(['cash.configure'])).send({ servicePercent })).status).toBe(200);
    expect((await request(app).get('/cash/dashboard?date=2026-02-30').set('Authorization', read())).status).toBe(400);
    expect((await request(app).post('/cash/session/foo/close').set('Authorization', operate()).send({ countedCash: 0 })).status).toBe(400);
  });
  it('cash.read + cash.operate no permite reportes ni configuración', async () => {
    const cashier = auth(['cash.read', 'cash.operate']);
    for (const path of ['/cash/daily-sales', '/cash/sessions/history', '/cash/config/service']) {
      expect((await request(app).get(path).set('Authorization', cashier)).status).toBe(403);
    }
    expect((await request(app).put('/cash/config/service').set('Authorization', cashier).send({ servicePercent: 10 })).status).toBe(403);
    expect((await request(app).get('/cash/daily-sales').set('Authorization', reports())).status).toBe(200);
    expect((await request(app).get('/cash/sessions/history').set('Authorization', reports())).status).toBe(200);
  });
  it('dashboard operativo omite datos administrativos incluso con pagos registrados', async () => {
    await open();
    const { order } = await fixture();
    const invoice = await invoiceFor(order.id);
    expect((await pay(invoice.id, '60000')).status).toBe(201);
    const response = await request(app).get('/cash/dashboard').set('Authorization', auth(['cash.read', 'cash.operate']));
    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['pending', 'session']);
    expect(response.body.pending[0].invoice).toMatchObject({ subtotal: '100000.00', total: '100000.00', paid: '60000.00', pending: '40000.00' });
  });
  it('cash.reports habilita agregados pero no configuración; cash.configure no habilita reportes', async () => {
    await open();
    const administrative = await request(app).get('/cash/dashboard').set('Authorization', auth(['cash.read', ' CASH.REPORTS ']));
    expect(administrative.status).toBe(200);
    expect(administrative.body).toHaveProperty('daily.summary.salesAmount', '0.00');
    expect(administrative.body).toHaveProperty('sessionSummary.serviceAmount', '0.00');
    expect(administrative.body).toHaveProperty('history');
    expect(administrative.body).not.toHaveProperty('config');
    const configuration = await request(app).get('/cash/dashboard').set('Authorization', auth(['cash.read', 'cash.configure']));
    expect(configuration.body).toHaveProperty('config.servicePercent', '0.00');
    for (const field of ['daily', 'history', 'sessionSummary']) expect(configuration.body).not.toHaveProperty(field);
  });
  it('conciliación operativa solo expone medios de la sesión abierta y cierre devuelve valores finales', async () => {
    const session = await open();
    const { order } = await fixture('110000');
    const invoice = await invoiceFor(order.id);
    await pay(invoice.id, '60000', 'CASH');
    const path = `/cash/session/${session.id}/reconciliation`;
    expect((await request(app).get(path).set('Authorization', read())).status).toBe(403);
    expect((await request(app).get('/cash/session/foo/reconciliation').set('Authorization', operate())).status).toBe(400);
    expect((await request(app).get('/cash/session/999999/reconciliation').set('Authorization', operate())).status).toBe(404);
    const preview = await request(app).get(path).set('Authorization', operate());
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({ sessionId: session.id, openingCash: '200000.00', expectedCash: '260000.00', byMethod: { CASH: '60000.00', CARD: '0.00', TRANSFER: '0.00', OTHER: '0.00' } });
    await pay(invoice.id, '25000', 'CARD');
    await pay(invoice.id, '15000', 'TRANSFER');
    await pay(invoice.id, '10000', 'OTHER');
    const closed = await request(app).post(`/cash/session/${session.id}/close`).set('Authorization', operate()).send({ countedCash: '259000' });
    expect(closed.status).toBe(200);
    expect(Number(closed.body.expectedCash)).toBe(260000);
    expect(Number(closed.body.difference)).toBe(-1000);
    expect(closed.body.reconciliation).toEqual({ byMethod: { CASH: '60000.00', CARD: '25000.00', TRANSFER: '15000.00', OTHER: '10000.00' } });
    for (const field of ['salesAmount', 'serviceAmount', 'totalCollected', 'summary']) expect(closed.body).not.toHaveProperty(field);
    expect((await request(app).get(path).set('Authorization', operate())).status).toBe(409);
  });
});

describe('CASH-01A cuenta y prefactura', () => {
  it('cuenta conserva porcentaje, no acepta servicio/paga/cierra y bloquea cambios de productos', async () => {
    await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 10 } });
    const { order, item } = await fixture();
    const account = await request(app).post(`/cash/orders/${order.id}/account`).set('Authorization', operate()).send({});
    expect(account.status).toBe(200);
    expect(account.body.suggestedServiceAmount).toBe('10000.00');
    expect(account.body.suggestedTotal).toBe('110000.00');
    expect(account.body.invoice).toBeNull();
    expect(account.body.status).toBe('OPEN');
    expect(account.body.paymentStatus).toBe('UNPAID');
    await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 8 } });
    const again = await request(app).post(`/cash/orders/${order.id}/account`).set('Authorization', operate()).send({});
    expect(again.body.suggestedServicePercent).toBe('10.00');
    expect(again.body.accountRequestedAt).toBe(account.body.accountRequestedAt);
    const salesAuth = auth(['sales.manage']);
    expect((await request(app).post(`/sales/orders/${order.id}/items`).set('Authorization', salesAuth).send({ menuItemId, quantity: 1 })).body.code).toBe('ORDER_ACCOUNT_REQUESTED');
    expect((await request(app).delete(`/sales/orders/${order.id}/items/${item.id}`).set('Authorization', salesAuth).send({})).body.code).toBe('ORDER_ACCOUNT_REQUESTED');
    expect((await request(app).patch(`/sales/orders/${order.id}/items/${item.id}`).set('Authorization', salesAuth).send({ quantity: 2 })).body.code).toBe('ORDER_ACCOUNT_REQUESTED');
    expect(await prisma.cashPayment.count()).toBe(0);
  });
  it('cambia con/sin servicio antes de pagos y bloquea regeneración después', async () => {
    await open();
    await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 10 } });
    const { order } = await fixture('80000');
    const withService = await invoiceFor(order.id, true);
    expect(withService.serviceAmount).toBe('8000.00');
    const without = await invoiceFor(order.id, false);
    expect(without.total).toBe('80000.00');
    expect(without.serviceAmount).toBe('0.00');
    expect(without.suggestedServicePercent).toBe('10.00');
    expect(await prisma.salesPreInvoice.count({ where: { salesOrderId: order.id, status: 'ACTIVE' } })).toBe(1);
    expect((await pay(withService.id, '1')).status).toBe(409);
    expect((await pay(without.id, '1000')).status).toBe(201);
    const blocked = await request(app).post(`/cash/orders/${order.id}/pre-invoices`).set('Authorization', operate()).send({ serviceAccepted: true });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('PREFINVOICE_LOCKED_AFTER_PAYMENT');
  });
  it('exige cuenta antes de prefactura y sesión antes de pago', async () => {
    const { order } = await fixture();
    expect((await request(app).post(`/cash/orders/${order.id}/pre-invoices`).set('Authorization', operate()).send({ serviceAccepted: false })).body.code).toBe('ACCOUNT_NOT_REQUESTED');
    const invoice = await invoiceFor(order.id);
    expect((await pay(invoice.id, '100')).body.code).toBe('CASH_SESSION_REQUIRED');
  });
});

describe('CASH-01A pagos, settlement y arqueo', () => {
  it('usa snapshots del precio publicado y separa venta, impuesto y servicio sin fórmula fiscal en Caja', async () => {
    await open('0');
    await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 10 } });
    const category = await prisma.menuCategory.create({ data: { name: 'Categoría impuesto', normalizedName: 'categoria impuesto' } });
    const taxItem = await prisma.menuItem.create({ data: { name: 'Plato con impuesto', categoryId: category.id } });
    const published = await prisma.menuItemPrice.create({ data: { menuItemId: taxItem.id, baseCostSnapshot: 60000, indirectCostSnapshot: 0, totalCostSnapshot: 60000, marginRate: 0.4, taxRate: 0.08, priceBeforeTax: 100000, taxAmount: 8000, calculatedAmount: 108000, roundingIncrement: 1000, amount: 108000, calculationVersion: 'sales-price-v1', createdById: actorId, validFrom: new Date() } });
    const table = await prisma.diningTable.create({ data: { code: 'TAX-1', capacity: 2 } });
    const order = await prisma.salesOrder.create({ data: { diningTableId: table.id, openedById: actorId } });
    const added = await request(app).post(`/sales/orders/${order.id}/items`).set('Authorization', auth(['sales.manage'])).send({ menuItemId: taxItem.id, quantity: 1 });
    expect(added.status).toBe(201);
    const line = await prisma.salesOrderItem.findFirstOrThrow({ where: { salesOrderId: order.id } });
    expect(line.menuItemPriceId).toBe(published.id);
    expect(line.unitPriceSnapshot.toFixed(2)).toBe('108000.00');
    expect(line.unitSalesAmountSnapshot.toFixed(2)).toBe('100000.00');
    expect(line.unitConsumptionTaxAmountSnapshot.toFixed(2)).toBe('8000.00');
    const now = new Date();
    const dispatch = await prisma.kitchenDispatch.create({ data: { salesOrderId: order.id, dispatchedById: actorId, targetReadyAt: new Date(now.getTime() + 900000), status: 'READY', startedAt: now, startedById: actorId, readyAt: now, readyById: actorId, deliveredAt: now, deliveredById: actorId } });
    await prisma.kitchenDispatchItem.create({ data: { kitchenDispatchId: dispatch.id, salesOrderItemId: line.id, itemNameSnapshot: taxItem.name, quantitySnapshot: 1 } });
    const account = await request(app).post(`/cash/orders/${order.id}/account`).set('Authorization', operate()).send({});
    expect(account.body).toMatchObject({ salesAmount: '100000.00', consumptionTaxAmount: '8000.00', subtotal: '108000.00', suggestedServiceAmount: '10800.00', suggestedTotal: '118800.00' });
    const withoutService = await request(app).post(`/cash/orders/${order.id}/pre-invoices`).set('Authorization', operate()).send({ serviceAccepted: false });
    expect(withoutService.body.invoice).toMatchObject({ salesAmount: '100000.00', consumptionTaxAmount: '8000.00', serviceAmount: '0.00', total: '108000.00' });
    const withService = await request(app).post(`/cash/orders/${order.id}/pre-invoices`).set('Authorization', operate()).send({ serviceAccepted: true });
    expect(withService.body.invoice).toMatchObject({ salesAmount: '100000.00', consumptionTaxAmount: '8000.00', serviceAmount: '10800.00', total: '118800.00' });
    expect((await pay(withService.body.invoice.id, '118800', 'CASH')).status).toBe(201);
    expect((await request(app).post(`/cash/orders/${order.id}/settle`).set('Authorization', operate()).send({})).status).toBe(200);
    const payment = await prisma.cashPayment.findFirstOrThrow({ where: { preInvoiceId: withService.body.invoice.id } });
    expect(payment.salesAmount.toFixed(2)).toBe('100000.00');
    expect(payment.consumptionTaxAmount.toFixed(2)).toBe('8000.00');
    expect(payment.serviceAmount.toFixed(2)).toBe('10800.00');
    const daily = await request(app).get('/cash/daily-sales').set('Authorization', reports());
    expect(daily.body.summary).toMatchObject({ salesAmount: '100000.00', consumptionTaxAmount: '8000.00', serviceAmount: '10800.00', totalCollected: '118800.00', byMethod: { CASH: '118800.00' } });
  });
  it('demo: 100000 + 10000, pagos 60000/50000, PAID explícito y efectivo esperado 260000', async () => {
    const session = await open();
    await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 10 } });
    const { order, table } = await fixture();
    const invoice = await invoiceFor(order.id, true);
    expect((await pay(invoice.id, '60000')).status).toBe(201);
    expect((await request(app).post(`/cash/orders/${order.id}/settle`).set('Authorization', operate()).send({})).body.code).toBe('PAYMENT_NOT_COMPLETE');
    const partial = await prisma.salesOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(partial.status).toBe('OPEN');
    expect(partial.paymentStatus).toBe('PARTIALLY_PAID');
    expect((await pay(invoice.id, '50000', 'CARD')).status).toBe(201);
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PARTIALLY_PAID');
    const settled = await request(app).post(`/cash/orders/${order.id}/settle`).set('Authorization', operate()).send({});
    expect(settled.status).toBe(200);
    expect(settled.body.paymentStatus).toBe('PAID');
    expect(settled.body.status).toBe('SETTLED');
    expect((await request(app).get('/cash/pending').set('Authorization', read())).body.orders).toHaveLength(0);
    const tables = await request(app).get('/sales/tables').set('Authorization', auth(['sales.read']));
    expect(tables.body.tables.find((row: { id: number }) => row.id === table.id).operationalStatus).toBe('AVAILABLE');
    expect(await prisma.salesOrder.count({ where: { id: order.id, status: 'OPEN' } })).toBe(0);
    expect(await prisma.salesOrder.count({ where: { id: order.id } })).toBe(1);
    const daily = await request(app).get('/cash/daily-sales').set('Authorization', reports());
    expect(daily.body.summary).toMatchObject({ salesAmount: '100000.00', consumptionTaxAmount: '0.00', serviceAmount: '10000.00', totalCollected: '110000.00', byMethod: { CASH: '60000.00', CARD: '50000.00' } });
    const closed = await request(app).post(`/cash/session/${session.id}/close`).set('Authorization', operate()).send({ countedCash: '259000' });
    expect(closed.status).toBe(200);
    expect(Number(closed.body.expectedCash)).toBe(260000);
    expect(Number(closed.body.difference)).toBe(-1000);
    const history = await request(app).get('/cash/sessions/history').set('Authorization', reports());
    expect(history.body.sessions[0].summary).toMatchObject({ salesAmount: '100000.00', serviceAmount: '10000.00', totalCollected: '110000.00', expectedCash: '260000.00' });
    expect(await prisma.inventoryMovement.count()).toBe(0);
    expect(await prisma.kitchenInventoryConsumption.count()).toBe(0);
  });
  it.each(['CASH', 'CARD', 'TRANSFER', 'OTHER'])('registra %s e impide sobrepago y precisión no representable', async method => {
    await open();
    const { order } = await fixture();
    const invoice = await invoiceFor(order.id);
    expect((await pay(invoice.id, '10', method)).status).toBe(201);
    expect((await pay(invoice.id, '100000', method)).status).toBe(400);
    expect((await pay(invoice.id, '0.001', method)).status).toBe(400);
    expect(await prisma.cashPayment.count()).toBe(1);
  });
  it('efectivo recibido 100000 aplica 80000 y devuelve cambio 20000', async () => {
    const session = await open('200000');
    const { order } = await fixture('80000');
    const invoice = await invoiceFor(order.id);
    const response = await pay(invoice.id, '80000', 'CASH', undefined, { amountTendered: '100000' });
    expect(response.status).toBe(201);
    expect(Number(response.body.change)).toBe(20000);
    const closed = await request(app).post(`/cash/session/${session.id}/close`).set('Authorization', operate()).send({ countedCash: '280000' });
    expect(Number(closed.body.expectedCash)).toBe(280000);
    expect(Number(closed.body.difference)).toBe(0);
  });
  it('idempotencia secuencial y concurrente sin duplicados, incluso después de settlement', async () => {
    await open();
    const { order } = await fixture('100');
    const invoice = await invoiceFor(order.id);
    const attempts = await Promise.all([pay(invoice.id, '100', 'TRANSFER', 'cash-idempotency-01'), pay(invoice.id, '100', 'TRANSFER', 'cash-idempotency-01')]);
    expect(attempts.map(response => response.status)).toEqual([201, 201]);
    expect(attempts[0].body.id).toBe(attempts[1].body.id);
    expect(await prisma.cashPayment.count()).toBe(1);
    expect((await pay(invoice.id, '100', 'CARD', 'cash-idempotency-01')).status).toBe(409);
    const settlements = await Promise.all([request(app).post(`/cash/orders/${order.id}/settle`).set('Authorization', operate()).send({}), request(app).post(`/cash/orders/${order.id}/settle`).set('Authorization', operate()).send({})]);
    expect(settlements.map(response => response.status)).toEqual([200, 200]);
    expect((await pay(invoice.id, '100', 'TRANSFER', 'cash-idempotency-01')).status).toBe(201);
  });
  it('dos últimos pagos simultáneos no superan el total', async () => {
    await open();
    const { order } = await fixture('100');
    const invoice = await invoiceFor(order.id);
    const attempts = await Promise.all([pay(invoice.id, '100'), pay(invoice.id, '100')]);
    expect(attempts.map(response => response.status).sort()).toEqual([201, 400]);
    expect(await prisma.cashPayment.count()).toBe(1);
  });
  it('pago y cierre concurrentes nunca dejan dinero fuera del efectivo esperado', async () => {
    const session = await open();
    const { order } = await fixture('100');
    const invoice = await invoiceFor(order.id);
    const [payment, closed] = await Promise.all([
      pay(invoice.id, '100', 'CASH', undefined, { cashSessionId: session.id }),
      request(app).post(`/cash/session/${session.id}/close`).set('Authorization', operate()).send({ countedCash: '200100' }),
    ]);
    expect([201, 409]).toContain(payment.status);
    expect(closed.status).toBe(200);
    const payments = await prisma.cashPayment.aggregate({ where: { cashSessionId: session.id }, _sum: { amount: true } });
    expect(Number(closed.body.expectedCash)).toBe(200000 + Number(payments._sum.amount ?? 0));
  });
  it('cancelación ordinaria con pagos no descarta dinero ni restaura inventario', async () => {
    await open();
    const { order } = await fixture('100', 'NEXT');
    const invoice = await invoiceFor(order.id);
    expect((await pay(invoice.id, '50')).status).toBe(201);
    const response = await request(app).post(`/sales/orders/${order.id}/cancel`).set('Authorization', auth(['sales.manage'])).send({ reason: 'Cancelar prueba' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ORDER_HAS_PAYMENTS');
    expect(await prisma.cashPayment.count()).toBe(1);
    expect(await prisma.inventoryMovement.count()).toBe(0);
  });
  it('reparto de pagos conserva exactamente el centavo de servicio redondeado', async () => {
    await open('0');
    await prisma.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: 10 } });
    const { order } = await fixture('0.05');
    const invoice = await invoiceFor(order.id, true);
    expect(invoice.serviceAmount).toBe('0.01');
    expect(invoice.total).toBe('0.06');
    for (const applied of ['0.01', '0.02', '0.03']) expect((await pay(invoice.id, applied, 'OTHER')).status).toBe(201);
    const totals = await prisma.cashPayment.aggregate({ _sum: { amount: true, salesAmount: true, consumptionTaxAmount: true, serviceAmount: true } });
    expect(totals._sum.amount?.toFixed(2)).toBe('0.06');
    expect(totals._sum.salesAmount?.toFixed(2)).toBe('0.05');
    expect(totals._sum.consumptionTaxAmount?.toFixed(2)).toBe('0.00');
    expect(totals._sum.serviceAmount?.toFixed(2)).toBe('0.01');
  });
  it('apertura/cierre concurrentes conservan una única sesión y un único arqueo', async () => {
    const attempts = await Promise.all([request(app).post('/cash/session').set('Authorization', operate()).send({ openingCash: 0 }), request(app).post('/cash/session').set('Authorization', operate()).send({ openingCash: 0 })]);
    expect(attempts.map(response => response.status).sort()).toEqual([201, 409]);
    const session = await prisma.cashSession.findFirstOrThrow();
    const closes = await Promise.all([request(app).post(`/cash/session/${session.id}/close`).set('Authorization', operate()).send({ countedCash: 0 }), request(app).post(`/cash/session/${session.id}/close`).set('Authorization', operate()).send({ countedCash: 0 })]);
    expect(closes.map(response => response.status).sort()).toEqual([200, 409]);
  });
  it.each(['NEXT', 'PREPARING', 'READY', 'UNSENT'] as const)('no libera mesa con trabajo %s pendiente', async state => {
    await open();
    const { order } = await fixture('100', state);
    const invoice = await invoiceFor(order.id);
    expect((await pay(invoice.id, '100')).status).toBe(201);
    const response = await request(app).post(`/cash/orders/${order.id}/settle`).set('Authorization', operate()).send({});
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ORDER_NOT_READY_FOR_SETTLEMENT');
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('OPEN');
  });
});
