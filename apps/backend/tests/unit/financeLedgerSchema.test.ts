import { describe, expect, it } from 'vitest';
import { createFinanceLedgerSchema, updateFinanceLedgerSchema } from '../../src/schemas/financeLedgerSchema';
import { ledgerDocumentStatus, nextLedgerDocumentNumber } from '../../src/services/finance/financeLedgerService';

describe('validación de documentos CxP/CxC', () => {
  it('acepta una cuenta por pagar con factura del proveedor', () => {
    const parsed = createFinanceLedgerSchema.safeParse({
      side: 'PAYABLE',
      supplierId: 3,
      invoiceNumber: 'FAC-88421',
      issuedAt: '2026-10-01',
      dueAt: '2026-10-28',
      amount: 6480000,
    });
    expect(parsed.success).toBe(true);
  });

  it('acepta una cuenta por pagar sin código de factura', () => {
    const parsed = createFinanceLedgerSchema.safeParse({
      side: 'PAYABLE',
      supplierId: 3,
      issuedAt: '2026-10-01',
      dueAt: '2026-10-28',
      amount: 6480000,
    });
    expect(parsed.success).toBe(true);
  });

  it('acepta una cuenta por cobrar sin número: el consecutivo es interno', () => {
    const parsed = createFinanceLedgerSchema.safeParse({
      side: 'RECEIVABLE',
      partyName: 'Eventos Nova SAS',
      issuedAt: '2026-10-01',
      dueAt: '2026-10-29',
      amount: 3800000,
    });
    expect(parsed.success).toBe(true);
  });

  it('acepta una edición de CxP o CxC aunque venga el lado', () => {
    expect(updateFinanceLedgerSchema.safeParse({
      side: 'PAYABLE',
      supplierId: 3,
      invoiceNumber: 'FAC-88421',
      issuedAt: '2026-10-01',
      dueAt: '2026-10-28',
      amount: 6480000,
    }).success).toBe(true);
    expect(updateFinanceLedgerSchema.safeParse({
      side: 'RECEIVABLE',
      partyName: 'Eventos Nova SAS',
      issuedAt: '2026-10-01',
      dueAt: '2026-10-29',
      amount: 3800000,
    }).success).toBe(true);
  });

  it('rechaza un vencimiento anterior a la emisión', () => {
    expect(createFinanceLedgerSchema.safeParse({
      side: 'RECEIVABLE',
      partyName: 'Club Empresarial',
      issuedAt: '2026-10-20',
      dueAt: '2026-10-01',
      amount: 100,
    }).success).toBe(false);
  });
});

describe('estado calculado del documento', () => {
  const today = new Date(Date.UTC(2026, 9, 10));

  it('marca pagado cuando el saldo es 0', () => {
    expect(ledgerDocumentStatus(new Date(Date.UTC(2026, 9, 1)), 0, today)).toBe('PAID');
  });

  it('marca vencido cuando la fecha ya pasó', () => {
    expect(ledgerDocumentStatus(new Date(Date.UTC(2026, 9, 1)), 100, today)).toBe('OVERDUE');
  });

  it('marca próximo cuando vence en 7 días o menos', () => {
    expect(ledgerDocumentStatus(new Date(Date.UTC(2026, 9, 15)), 100, today)).toBe('UPCOMING');
  });
});

describe('consecutivo de documentos', () => {
  it('empieza en FC-00001 y FV-00001', () => {
    expect(nextLedgerDocumentNumber('PAYABLE', [])).toBe('FC-00001');
    expect(nextLedgerDocumentNumber('RECEIVABLE', [])).toBe('FV-00001');
  });

  it('incrementa solo los códigos del mismo prefijo', () => {
    expect(nextLedgerDocumentNumber('PAYABLE', ['FC-00007', 'FV-00040', 'FC-12'])).toBe('FC-00013');
    expect(nextLedgerDocumentNumber('RECEIVABLE', ['FV-2091', 'CC-2091'])).toBe('FV-02092');
  });
});
