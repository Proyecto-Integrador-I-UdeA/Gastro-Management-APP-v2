import type { Express } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, ReservationStatus, ReservationType } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

const TEST_SCHEMA = 'reservations_01a_test';
const migrationSql = readFileSync(resolve(
  process.cwd(),
  'prisma/migrations/20260918180000_reservations_01a_foundation/migration.sql',
), 'utf8');
const migrationStatements = migrationSql.split(';').map(statement => statement.trim()).filter(Boolean);

let app: Express;
let prisma: PrismaClient;
let appPrisma: PrismaClient;
let administrationPrisma: PrismaClient;
let originalDatabaseUrl: string;
let actorId: number;

function auth(permissions: string[]) {
  return `Bearer ${createIntegrationToken(permissions, actorId)}`;
}

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Laura Martínez',
    phone: '+57 310 555 0101',
    email: 'laura@example.com',
    reservationType: 'TABLE_RESERVATION',
    scheduledAt: futureIso(72),
    guestCount: 4,
    preferredArea: 'Terraza',
    diningTableId: null,
    reason: 'Cena familiar',
    notes: null,
    status: 'PENDING',
    isVip: false,
    ...overrides,
  };
}

async function createBaseSchema(client: PrismaClient) {
  await client.$executeRawUnsafe(`
    CREATE TABLE "users" (
      "id" SERIAL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "fullName" TEXT,
      "roleId" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "active" BOOLEAN NOT NULL DEFAULT true
    )
  `);
  await client.$executeRawUnsafe(`CREATE TABLE "roles" ("id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await client.$executeRawUnsafe(`CREATE TABLE "permissions" ("id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await client.$executeRawUnsafe(`CREATE TABLE "role_permissions" ("id" SERIAL PRIMARY KEY, "roleId" INTEGER NOT NULL, "permissionId" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("roleId", "permissionId"))`);
  await client.$executeRawUnsafe(`
    CREATE TABLE "dining_tables" (
      "id" SERIAL PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "area" TEXT,
      "capacity" INTEGER NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.$executeRawUnsafe(`CREATE TABLE "sales_orders" ("id" SERIAL PRIMARY KEY)`);
  await client.$executeRawUnsafe(`INSERT INTO "roles" ("name") VALUES ('admin'), ('super'), ('chef')`);
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL as string;
  const baseUrl = process.env.TEST_DATABASE_URL as string;
  const schemaUrl = new URL(baseUrl);
  schemaUrl.searchParams.set('schema', TEST_SCHEMA);
  administrationPrisma = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  await administrationPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
  await administrationPrisma.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  prisma = new PrismaClient({ datasources: { db: { url: schemaUrl.toString() } } });
  await createBaseSchema(prisma);
  for (const statement of migrationStatements) await prisma.$executeRawUnsafe(statement);

  process.env.DATABASE_URL = schemaUrl.toString();
  app = (await import('../../src/app')).default;
  appPrisma = (await import('../../src/lib/prisma')).default;
  actorId = (await prisma.user.create({
    data: { email: 'reservations-actor@example.test', passwordHash: 'unused', fullName: 'Administrador Reservas' },
    select: { id: true },
  })).id;
});

afterEach(async () => {
  await prisma.reservationHistory.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.diningTable.deleteMany();
});

afterAll(async () => {
  await appPrisma?.$disconnect();
  await prisma?.$disconnect();
  process.env.DATABASE_URL = originalDatabaseUrl;
  if (administrationPrisma) {
    await administrationPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await administrationPrisma.$disconnect();
  }
});

describe('RESERVATIONS-01A API', () => {
  it('protege lecturas y mutaciones con permisos independientes', async () => {
    expect((await request(app).get('/sales/reservations')).status).toBe(401);
    expect((await request(app).get('/sales/reservations').set('Authorization', auth([]))).status).toBe(403);
    expect((await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.read'])).send(payload())).status).toBe(403);
    expect((await request(app).get('/sales/reservations').set('Authorization', auth(['reservations.read']))).status).toBe(200);
  });

  it('crea PENDING/CONFIRMED, conserva VIP/mesa opcionales, historial y no crea SalesOrder', async () => {
    const table = await prisma.diningTable.create({ data: { code: 'R-01', area: 'Terraza', capacity: 6, active: true } });
    const pending = await request(app).post('/sales/reservations')
      .set('Authorization', auth(['reservations.manage']))
      .send(payload({ diningTableId: table.id, isVip: true }));
    expect(pending.status).toBe(201);
    expect(pending.body).toMatchObject({ status: 'PENDING', isVip: true, diningTable: { id: table.id } });
    expect(pending.body.history.map((entry: { action: string }) => entry.action)).toEqual(['CREATED']);

    const confirmed = await request(app).post('/sales/reservations')
      .set('Authorization', auth(['reservations.manage']))
      .send(payload({ customerName: 'Empresa Uno', reservationType: 'CORPORATE_EVENT', status: 'CONFIRMED' }));
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.confirmedAt).toEqual(expect.any(String));
    expect(confirmed.body.history.map((entry: { action: string }) => entry.action)).toEqual(['CREATED', 'CONFIRMED']);
    expect(await prisma.salesOrder.count()).toBe(0);
  });

  it('lista y busca por cliente, motivo, tipo y fecha en orden determinista', async () => {
    for (const [name, reason, type, hours] of [
      ['Carlos Pérez', 'Cumpleaños familiar', ReservationType.PRIVATE_EVENT, 96],
      ['Ana Ruiz', 'Reunión empresarial', ReservationType.CORPORATE_EVENT, 72],
    ] as const) {
      await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.manage']))
        .send(payload({ customerName: name, reason, reservationType: type, scheduledAt: futureIso(hours) }));
    }
    const customer = await request(app).get('/sales/reservations?search=carlos').set('Authorization', auth(['reservations.read']));
    expect(customer.body.reservations.map((item: ReservationResult) => item.customerName)).toEqual(['Carlos Pérez']);
    const event = await request(app).get('/sales/reservations?search=corporativo').set('Authorization', auth(['reservations.read']));
    expect(event.body.reservations.map((item: ReservationResult) => item.customerName)).toEqual(['Ana Ruiz']);
    const first = event.body.reservations[0] as ReservationResult;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(first.scheduledAt));
    const dateSearch = await request(app).get(`/sales/reservations?search=${date}`).set('Authorization', auth(['reservations.read']));
    expect(dateSearch.body.reservations).toHaveLength(1);
  });

  it('calcula KPIs con día Bogotá, estados activos, mesas distintas y eventos confirmados', async () => {
    const now = new Date();
    const table = await prisma.diningTable.create({ data: { code: 'K-01', area: 'Salón', capacity: 4 } });
    const todayAtNow = new Date(now.getTime());
    const base = {
      phone: '300', guestCount: 3, reason: 'KPI',
      scheduledAt: todayAtNow, reservationType: ReservationType.TABLE_RESERVATION,
    };
    await prisma.reservation.createMany({ data: [
      { ...base, customerName: 'Activa 1', status: ReservationStatus.PENDING, diningTableId: table.id, createdById: actorId, updatedById: actorId },
      { ...base, customerName: 'Activa 2', status: ReservationStatus.CONFIRMED, diningTableId: table.id, confirmedAt: now, confirmedById: actorId, createdById: actorId, updatedById: actorId },
      { ...base, customerName: 'Cancelada', status: ReservationStatus.CANCELLED, cancelledAt: now, cancelledById: actorId, cancellationReason: 'No asiste', createdById: actorId, updatedById: actorId },
      { ...base, customerName: 'Evento próximo', status: ReservationStatus.CONFIRMED, reservationType: ReservationType.PRIVATE_EVENT, scheduledAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), confirmedAt: now, confirmedById: actorId, createdById: actorId, updatedById: actorId },
    ] });
    const response = await request(app).get('/sales/reservations/summary').set('Authorization', auth(['reservations.read']));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ todayReservations: 2, committedTables: 1, upcomingEvents: 1, expectedGuests: 6 });
  });

  it('confirma y aplaza con >=48h preservando tiempos; rechaza la ventana menor', async () => {
    const created = await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.manage'])).send(payload());
    const confirmed = await request(app).post(`/sales/reservations/${created.body.id}/confirm`).set('Authorization', auth(['reservations.manage'])).send({});
    expect(confirmed.body.status).toBe('CONFIRMED');

    const oldTime = confirmed.body.scheduledAt;
    const rescheduled = await request(app).post(`/sales/reservations/${created.body.id}/reschedule`)
      .set('Authorization', auth(['reservations.manage']))
      .send({ scheduledAt: futureIso(120), reason: 'Solicitud del cliente' });
    expect(rescheduled.status).toBe(200);
    expect(rescheduled.body.status).toBe('CONFIRMED');
    expect(rescheduled.body.history.at(-1)).toMatchObject({ action: 'RESCHEDULED', previousScheduledAt: oldTime, note: 'Solicitud del cliente' });

    await prisma.reservation.update({ where: { id: created.body.id }, data: { scheduledAt: new Date(futureIso(47)) } });
    const rejected = await request(app).post(`/sales/reservations/${created.body.id}/reschedule`)
      .set('Authorization', auth(['reservations.manage'])).send({ scheduledAt: futureIso(100) });
    expect(rejected.status).toBe(409);
    expect(rejected.body.code).toBe('RESCHEDULE_WINDOW_CLOSED');
  });

  it('marca cancelación tardía, completa solo al llegar la hora y conserva trazabilidad', async () => {
    const normal = await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.manage']))
      .send(payload({ customerName: 'Cancelación anticipada', status: 'CONFIRMED', scheduledAt: futureIso(72) }));
    const normalCancellation = await request(app).post(`/sales/reservations/${normal.body.id}/cancel`)
      .set('Authorization', auth(['reservations.manage'])).send({ reason: 'Aviso anticipado' });
    expect(normalCancellation.body).toMatchObject({ status: 'CANCELLED', lateCancellation: false });

    const pending = await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.manage']))
      .send(payload({ customerName: 'Pendiente cancelada', scheduledAt: futureIso(12) }));
    const pendingCancellation = await request(app).post(`/sales/reservations/${pending.body.id}/cancel`)
      .set('Authorization', auth(['reservations.manage'])).send({ reason: 'No confirmó' });
    expect(pendingCancellation.body).toMatchObject({ status: 'CANCELLED', lateCancellation: false });

    const late = await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.manage']))
      .send(payload({ status: 'CONFIRMED', scheduledAt: futureIso(24) }));
    const cancelled = await request(app).post(`/sales/reservations/${late.body.id}/cancel`)
      .set('Authorization', auth(['reservations.manage'])).send({ reason: 'Cambio de planes' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', lateCancellation: true, cancellationReason: 'Cambio de planes' });
    expect(cancelled.body.history.at(-1).action).toBe('CANCELLED');

    const completion = await request(app).post('/sales/reservations').set('Authorization', auth(['reservations.manage']))
      .send(payload({ customerName: 'Evento a completar', status: 'CONFIRMED', scheduledAt: futureIso(72) }));
    await prisma.reservation.update({ where: { id: completion.body.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    const completed = await request(app).post(`/sales/reservations/${completion.body.id}/complete`)
      .set('Authorization', auth(['reservations.manage'])).send({});
    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.completedAt).toEqual(expect.any(String));
    const editRejected = await request(app).patch(`/sales/reservations/${completion.body.id}`)
      .set('Authorization', auth(['reservations.manage'])).send({ customerName: 'Alteración inválida' });
    expect(editRejected.status).toBe(409);
    expect(await prisma.salesOrder.count()).toBe(0);
  });

  it('calcula el día operativo con límites de America/Bogota', async () => {
    const now = new Date();
    const bogotaDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now);
    const start = new Date(`${bogotaDay}T00:00:00.000-05:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const base = {
      phone: '300', guestCount: 1, reason: 'Límite Bogotá', reservationType: ReservationType.TABLE_RESERVATION,
      status: ReservationStatus.PENDING, createdById: actorId, updatedById: actorId,
    };
    await prisma.reservation.createMany({ data: [
      { ...base, customerName: 'Inicio incluido', scheduledAt: start },
      { ...base, customerName: 'Final incluido', scheduledAt: new Date(end.getTime() - 1) },
      { ...base, customerName: 'Día anterior', scheduledAt: new Date(start.getTime() - 1) },
      { ...base, customerName: 'Día siguiente', scheduledAt: end },
    ] });

    const response = await request(app).get('/sales/reservations/summary').set('Authorization', auth(['reservations.read']));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ todayReservations: 2, expectedGuests: 2 });
  });

  it('migra permisos de forma aditiva para admin/super, no para roles ajenos', async () => {
    const grants = await prisma.$queryRaw<Array<{ roleName: string; permissionName: string }>>`
      SELECT r."name" AS "roleName", p."name" AS "permissionName"
      FROM "role_permissions" rp
      JOIN "roles" r ON r."id" = rp."roleId"
      JOIN "permissions" p ON p."id" = rp."permissionId"
      WHERE p."name" LIKE 'reservations.%'
      ORDER BY p."name", r."name"
    `;
    expect(grants).toEqual([
      { roleName: 'admin', permissionName: 'reservations.manage' },
      { roleName: 'super', permissionName: 'reservations.manage' },
      { roleName: 'admin', permissionName: 'reservations.read' },
      { roleName: 'super', permissionName: 'reservations.read' },
    ]);
  });
});

type ReservationResult = { customerName: string; scheduledAt: string };
