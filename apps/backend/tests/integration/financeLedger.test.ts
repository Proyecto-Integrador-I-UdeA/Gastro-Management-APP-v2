import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const MONTH = '2026-10';
const PREFIX = '__finance_01b__';
const readToken = createIntegrationToken(['accounting.read']);
const writeToken = createIntegrationToken(['accounting.read', 'accounting.update']);

async function clearFixtures() {
  await prisma.financeLedgerDocument.deleteMany({
    where: {
      OR: [
        { partyName: { startsWith: PREFIX } },
        { invoiceNumber: { startsWith: PREFIX } },
      ],
    },
  });
  await prisma.supplier.deleteMany({
    where: { internalCode: { startsWith: PREFIX } },
  });
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('autorización del ledger financiero', () => {
  it('protege GET con accounting.read', async () => {
    expect((await request(app).get('/finance/ledger').query({ month: MONTH })).status).toBe(401);
    const listed = await request(app)
      .get('/finance/ledger')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${readToken}`);
    expect(listed.status).toBe(200);
  });
});

describe('API de CxP y CxC', () => {
  it('crea, abona y cierra una cuenta por cobrar con consecutivo interno', async () => {
    const created = await request(app)
      .post('/finance/ledger')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        side: 'RECEIVABLE',
        partyName: `${PREFIX} Eventos Nova`,
        issuedAt: '2026-10-01',
        dueAt: '2026-10-29',
        amount: 3800000,
      });
    expect(created.status).toBe(201);
    expect(created.body.documentNumber).toMatch(/^FV-\d{5}$/);
    expect(created.body.invoiceNumber).toBe(created.body.documentNumber);
    expect(created.body.balance).toBe(3800000);
    expect(created.body.status).not.toBe('PAID');

    const paid = await request(app)
      .post(`/finance/ledger/${created.body.id}/payments`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ amount: 3800000 });
    expect(paid.status).toBe(201);
    expect(paid.body.balance).toBe(0);
    expect(paid.body.status).toBe('PAID');

    const overflow = await request(app)
      .post(`/finance/ledger/${created.body.id}/payments`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ amount: 10 });
    expect(overflow.status).toBe(400);
  });

  it('crea una cuenta por pagar con factura del proveedor y consecutivo interno', async () => {
    const supplier = await prisma.supplier.create({
      data: {
        internalCode: `${PREFIX}SUP`,
        name: `${PREFIX} proveedor`,
        taxId: `${PREFIX}NIT`,
        phone: '0000000',
        address: 'Dirección de prueba',
        contactPerson: 'Contacto de prueba',
      },
    });

    const created = await request(app)
      .post('/finance/ledger')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        side: 'PAYABLE',
        supplierId: supplier.id,
        invoiceNumber: `${PREFIX}FAC-88421`,
        issuedAt: '2026-10-01',
        dueAt: '2026-10-28',
        amount: 6480000,
      });

    expect(created.status).toBe(201);
    expect(created.body.documentNumber).toMatch(/^FC-\d{5}$/);
    expect(created.body.invoiceNumber).toBe(`${PREFIX}FAC-88421`);
    expect(created.body.supplierId).toBe(supplier.id);
  });
});
