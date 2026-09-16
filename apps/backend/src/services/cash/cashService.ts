import { CashPaymentMethod, CashSessionStatus, Prisma, SalesOrderStatus, SalesPaymentStatus, SalesPreInvoiceStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { SalesOperationError } from '../sales/salesOrderService';

type CashClient = PrismaClientLike | Prisma.TransactionClient;
type PrismaClientLike = typeof prisma;

const ZERO = new Prisma.Decimal(0);

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function money(value: Prisma.Decimal.Value): string {
  return decimal(value).toFixed(2);
}

function amount(value: Prisma.Decimal.Value, positive = false) {
  const result = decimal(value);
  if (!result.isFinite() || result.lt(0) || (positive && result.isZero()) || result.decimalPlaces() > 2 || result.gte('1000000000000')) {
    throw new SalesOperationError('INVALID_CASH_AMOUNT', 400, 'El importe debe ser válido y tener máximo dos decimales');
  }
  return result;
}

export function calculateServiceAmounts(
  subtotalValue: Prisma.Decimal.Value,
  suggestedPercentValue: Prisma.Decimal.Value,
  accepted: boolean,
) {
  const subtotal = amount(subtotalValue);
  const suggestedPercent = amount(suggestedPercentValue);
  if (suggestedPercent.gt(100)) throw new SalesOperationError('INVALID_SERVICE_PERCENT', 400, 'El servicio debe estar entre 0 y 100');
  const servicePercent = accepted ? suggestedPercent : ZERO;
  const serviceAmount = accepted
    ? subtotal.mul(servicePercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : ZERO;
  return {
    subtotal,
    suggestedPercent,
    servicePercent,
    serviceAmount,
    total: amount(subtotal.add(serviceAmount)),
  };
}

export function calculateExpectedCash(
  openingCashValue: Prisma.Decimal.Value,
  cashPayments: readonly Prisma.Decimal.Value[],
) {
  return cashPayments.reduce<Prisma.Decimal>(
    (total, amount) => total.add(decimal(amount)),
    decimal(openingCashValue),
  );
}

export function splitCashPayment(total: Prisma.Decimal.Value, tax: Prisma.Decimal.Value, service: Prisma.Decimal.Value, previouslyPaid: Prisma.Decimal.Value, applied: Prisma.Decimal.Value) {
  const invoiceTotal = decimal(total);
  const taxTotal = decimal(tax);
  const serviceTotal = decimal(service);
  const previous = decimal(previouslyPaid);
  const payment = decimal(applied);
  const accumulatedComponent = (paid: Prisma.Decimal, component: Prisma.Decimal) => invoiceTotal.isZero() ? ZERO : paid.mul(component).div(invoiceTotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const accumulatedService = (paid: Prisma.Decimal) => accumulatedComponent(paid, serviceTotal);
  const accumulatedTax = (paid: Prisma.Decimal) => accumulatedComponent(paid, taxTotal);
  const serviceAmount = accumulatedService(previous.add(payment)).sub(accumulatedService(previous));
  const consumptionTaxAmount = accumulatedTax(previous.add(payment)).sub(accumulatedTax(previous));
  return { serviceAmount, consumptionTaxAmount, salesAmount: payment.sub(serviceAmount).sub(consumptionTaxAmount) };
}

const financialOrderSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  diningTable: { select: { id: true, code: true, area: true } },
  openedAt: true,
  billRequestedAt: true,
  accountRequestedAt: true,
  suggestedServicePercentSnapshot: true,
  items: { select: { id: true, menuItemNameSnapshot: true, parentItemId: true, quantity: true, unitPriceSnapshot: true, unitSalesAmountSnapshot: true, unitConsumptionTaxAmountSnapshot: true }, orderBy: { id: 'asc' as const } },
  preInvoices: {
    where: { status: SalesPreInvoiceStatus.ACTIVE },
    take: 1,
    orderBy: { generatedAt: 'desc' as const },
    include: {
      payments: {
        orderBy: { receivedAt: 'asc' as const },
        select: {
          id: true,
          method: true,
          amount: true,
          amountTendered: true,
          change: true,
          idempotencyKey: true,
          receivedAt: true,
          receivedBy: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  },
} satisfies Prisma.SalesOrderSelect;

type FinancialOrder = Prisma.SalesOrderGetPayload<{ select: typeof financialOrderSelect }>;

function orderSubtotal(order: Pick<FinancialOrder, 'items'>) {
  return order.items.reduce(
    (total, item) => total.add(decimal(item.unitPriceSnapshot).mul(item.quantity)),
    ZERO,
  );
}

function orderFinancialAmounts(order: Pick<FinancialOrder, 'items'>) {
  return order.items.reduce((total, item) => ({
    sales: total.sales.add(decimal(item.unitSalesAmountSnapshot).mul(item.quantity)),
    tax: total.tax.add(decimal(item.unitConsumptionTaxAmountSnapshot).mul(item.quantity)),
  }), { sales: ZERO, tax: ZERO });
}

function serializePreInvoice(invoice: FinancialOrder['preInvoices'][number] | null) {
  if (!invoice) return null;
  const paid = invoice.payments.reduce((total, payment) => total.add(decimal(payment.amount)), ZERO);
  return {
    id: invoice.id,
    subtotal: money(invoice.subtotalSnapshot),
    salesAmount: money(invoice.salesAmountSnapshot),
    consumptionTaxAmount: money(invoice.consumptionTaxAmountSnapshot),
    suggestedServicePercent: money(invoice.suggestedServicePercentSnapshot),
    serviceAccepted: invoice.serviceAccepted,
    servicePercent: money(invoice.servicePercentSnapshot),
    serviceAmount: money(invoice.serviceAmountSnapshot),
    total: money(invoice.totalSnapshot),
    status: invoice.status,
    generatedAt: invoice.generatedAt.toISOString(),
    paid: money(paid),
    pending: money(decimal(invoice.totalSnapshot).sub(paid)),
    payments: invoice.payments.map(payment => ({
      id: payment.id,
      method: payment.method,
      amount: money(payment.amount),
      amountTendered: payment.amountTendered == null ? null : money(payment.amountTendered),
      change: money(payment.change),
      idempotencyKey: payment.idempotencyKey,
      receivedAt: payment.receivedAt.toISOString(),
      receivedBy: payment.receivedBy,
    })),
  };
}

function serializeFinancialOrder(order: FinancialOrder) {
  const subtotal = orderSubtotal(order);
  const financialAmounts = orderFinancialAmounts(order);
  const suggestedPercent = order.suggestedServicePercentSnapshot ?? ZERO;
  const activeInvoice = order.preInvoices[0] ?? null;
  const suggestedService = calculateServiceAmounts(subtotal, suggestedPercent, true).serviceAmount;
  const invoice = serializePreInvoice(activeInvoice);
  const paid = activeInvoice
    ? activeInvoice.payments.reduce((total, payment) => total.add(decimal(payment.amount)), ZERO)
    : ZERO;
  const total = activeInvoice
    ? decimal(activeInvoice.totalSnapshot)
    : subtotal.add(suggestedService);
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    table: order.diningTable,
    openedAt: order.openedAt.toISOString(),
    billRequestedAt: order.billRequestedAt?.toISOString() ?? null,
    accountRequestedAt: order.accountRequestedAt?.toISOString() ?? null,
    subtotal: money(subtotal),
    salesAmount: money(financialAmounts.sales),
    consumptionTaxAmount: money(financialAmounts.tax),
    items: order.items.map(item => ({ id: item.id, name: item.menuItemNameSnapshot, parentItemId: item.parentItemId, quantity: item.quantity, unitPrice: money(item.unitPriceSnapshot), subtotal: money(decimal(item.unitPriceSnapshot).mul(item.quantity)) })),
    suggestedServicePercent: money(suggestedPercent),
    suggestedServiceAmount: money(suggestedService),
    suggestedTotal: money(subtotal.add(suggestedService)),
    invoice,
    paid: money(paid),
    pending: money(total.sub(paid)),
  };
}

async function lockOrder(transaction: Prisma.TransactionClient, orderId: number) {
  const rows = await transaction.$queryRaw<Array<{ id: number; status: SalesOrderStatus }>>`
    SELECT "id", "status" FROM "sales_orders" WHERE "id" = ${orderId} FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new SalesOperationError('ORDER_NOT_FOUND', 404, 'La orden no existe');
  }
  if (rows[0].status !== SalesOrderStatus.OPEN) {
    throw new SalesOperationError('ORDER_NOT_OPEN', 409, 'La orden ya no está abierta');
  }
}

async function getFinancialOrder(orderId: number, client: CashClient = prisma) {
  const order = await client.salesOrder.findUnique({ where: { id: orderId }, select: financialOrderSelect });
  if (!order) throw new SalesOperationError('ORDER_NOT_FOUND', 404, 'La orden no existe');
  return order;
}

async function ensureRegister(transaction: Prisma.TransactionClient, id?: number) {
  if (id) {
    const register = await transaction.cashRegister.findUnique({ where: { id } });
    if (!register || !register.active) throw new SalesOperationError('CASH_REGISTER_NOT_FOUND', 404, 'La caja no existe o está inactiva');
    return register;
  }
  const register = await transaction.cashRegister.findFirst({ where: { active: true }, orderBy: { id: 'asc' } });
  if (!register) throw new SalesOperationError('CASH_REGISTER_NOT_FOUND', 409, 'No hay una caja activa configurada');
  return register;
}

export async function getCashServiceConfig(client: CashClient = prisma) {
  const config = await client.cashServiceConfig.upsert({
    where: { id: 1 },
    create: { id: 1, servicePercent: 0 },
    update: {},
    select: { id: true, servicePercent: true, updatedAt: true, updatedBy: { select: { id: true, fullName: true } } },
  });
  return { id: config.id, servicePercent: money(config.servicePercent), updatedAt: config.updatedAt.toISOString(), updatedBy: config.updatedBy };
}

export async function updateCashServiceConfig(servicePercent: Prisma.Decimal.Value, actorId: number) {
  const value = amount(servicePercent);
  if (value.lt(0) || value.gt(100) || value.decimalPlaces() > 2) {
    throw new SalesOperationError('INVALID_SERVICE_PERCENT', 400, 'El servicio debe estar entre 0 y 100 con máximo dos decimales');
  }
  return prisma.$transaction(async transaction => {
    await transaction.cashServiceConfig.upsert({ where: { id: 1 }, create: { id: 1, servicePercent: 0 }, update: {} });
    await transaction.$queryRaw`SELECT "id" FROM "cash_service_config" WHERE "id" = 1 FOR UPDATE`;
    const current = await transaction.cashServiceConfig.findUniqueOrThrow({ where: { id: 1 } });
    await transaction.cashServiceConfig.update({ where: { id: 1 }, data: { servicePercent: value, updatedById: actorId } });
    await transaction.cashServiceConfigAudit.create({ data: { configId: 1, previousPercent: current.servicePercent, newPercent: value, changedById: actorId } });
    return getCashServiceConfig(transaction);
  });
}

export async function openCashSession(input: { cashRegisterId?: number; openingCash: Prisma.Decimal.Value }, actorId: number) {
  const openingCash = amount(input.openingCash);
  if (openingCash.lt(0)) throw new SalesOperationError('INVALID_OPENING_CASH', 400, 'La base inicial no puede ser negativa');
  try {
    return await prisma.$transaction(async transaction => {
      const register = await ensureRegister(transaction, input.cashRegisterId);
      await transaction.$queryRaw`SELECT "id" FROM "cash_registers" WHERE "id" = ${register.id} FOR UPDATE`;
      const existing = await transaction.cashSession.findFirst({ where: { cashRegisterId: register.id, status: CashSessionStatus.OPEN }, select: { id: true } });
      if (existing) throw new SalesOperationError('CASH_SESSION_ALREADY_OPEN', 409, 'Ya existe una sesión abierta para esta caja');
      return transaction.cashSession.create({
        data: { cashRegisterId: register.id, openedById: actorId, openingCash },
        include: { cashRegister: true, openedBy: { select: { id: true, fullName: true, email: true } } },
      });
    });
  } catch (error) {
    if (error instanceof SalesOperationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new SalesOperationError('CASH_SESSION_ALREADY_OPEN', 409, 'Ya existe una sesión abierta para esta caja');
    }
    throw error;
  }
}

export async function getOpenCashSession(client: CashClient = prisma) {
  return client.cashSession.findFirst({
    where: { status: CashSessionStatus.OPEN },
    orderBy: { id: 'asc' },
    include: { cashRegister: true, openedBy: { select: { id: true, fullName: true, email: true } } },
  });
}

export async function requestCashAccount(orderId: number, actorId: number) {
  return prisma.$transaction(async transaction => {
    await lockOrder(transaction, orderId);
    const order = await getFinancialOrder(orderId, transaction);
    if (order.items.length === 0) throw new SalesOperationError('ORDER_EMPTY', 409, 'El pedido no tiene productos');
    const current = order.suggestedServicePercentSnapshot;
    const percent = current ?? decimal((await transaction.cashServiceConfig.upsert({ where: { id: 1 }, create: { id: 1, servicePercent: 0 }, update: {} })).servicePercent);
    if (current === null) {
      await transaction.salesOrder.update({ where: { id: orderId }, data: { billRequestedAt: order.billRequestedAt ?? new Date(), accountRequestedAt: new Date(), accountRequestedById: actorId, suggestedServicePercentSnapshot: percent }, select: { id: true } });
    }
    return serializeFinancialOrder(await getFinancialOrder(orderId, transaction));
  });
}

export async function generateCashPreInvoice(orderId: number, serviceAccepted: boolean, actorId: number) {
  return prisma.$transaction(async transaction => {
    await lockOrder(transaction, orderId);
    const order = await getFinancialOrder(orderId, transaction);
    if (order.accountRequestedAt === null || order.suggestedServicePercentSnapshot === null) {
      throw new SalesOperationError('ACCOUNT_NOT_REQUESTED', 409, 'Primero debe generarse la cuenta inicial');
    }
    const current = order.preInvoices[0];
    if (current && current.payments.length > 0) {
      throw new SalesOperationError('PREFINVOICE_LOCKED_AFTER_PAYMENT', 409, 'No se puede cambiar el servicio después del primer pago');
    }
    if (current) {
      await transaction.salesPreInvoice.update({ where: { id: current.id }, data: { status: SalesPreInvoiceStatus.REPLACED, replacedAt: new Date() } });
    }
    const financialAmounts = orderFinancialAmounts(order);
    const subtotal = financialAmounts.sales.add(financialAmounts.tax);
    // Conserva la base operativa aprobada: subtotal de consumo cobrado,
   // manteniendo Venta e Impoconsumo separados para reporte.
    const serviceAmounts = calculateServiceAmounts(
    subtotal,
  order.suggestedServicePercentSnapshot,
  serviceAccepted,
);

    await transaction.salesPreInvoice.create({ data: {
      salesOrderId: orderId,
      subtotalSnapshot: subtotal,
      salesAmountSnapshot: financialAmounts.sales,
      consumptionTaxAmountSnapshot: financialAmounts.tax,
      suggestedServicePercentSnapshot: serviceAmounts.suggestedPercent,
      serviceAccepted,
      servicePercentSnapshot: serviceAmounts.servicePercent,
      serviceAmountSnapshot: serviceAmounts.serviceAmount,
      totalSnapshot: subtotal.add(serviceAmounts.serviceAmount),
      generatedById: actorId,
    } });
    return serializeFinancialOrder(await getFinancialOrder(orderId, transaction));
  });
}

export async function listPendingCashOrders(client: CashClient = prisma) {
  const orders = await client.salesOrder.findMany({ where: { status: SalesOrderStatus.OPEN, paymentStatus: { in: [SalesPaymentStatus.UNPAID, SalesPaymentStatus.PARTIALLY_PAID] } }, orderBy: [{ accountRequestedAt: { sort: 'desc', nulls: 'last' } }, { openedAt: 'asc' }], select: financialOrderSelect });
  return orders.map(serializeFinancialOrder);
}

export async function registerCashPayment(input: { preInvoiceId: number; cashSessionId?: number; method: CashPaymentMethod; amount: Prisma.Decimal.Value; amountTendered?: Prisma.Decimal.Value; idempotencyKey: string }, actorId: number) {
  const applied = amount(input.amount, true);
  const tendered = input.method === CashPaymentMethod.CASH
    ? amount(input.amountTendered ?? applied)
    : null;
  if (tendered && tendered.lt(applied)) throw new SalesOperationError('INVALID_TENDERED_AMOUNT', 400, 'El efectivo recibido es inferior al pago');
  if (input.method !== CashPaymentMethod.CASH && input.amountTendered !== undefined) throw new SalesOperationError('INVALID_TENDERED_AMOUNT', 400, 'El importe recibido solo corresponde al efectivo');
  const matchExisting = (existing: Prisma.CashPaymentGetPayload<Record<string, never>>) => {
    if (existing.preInvoiceId !== input.preInvoiceId || existing.method !== input.method || !existing.amount.eq(applied)
      || existing.receivedById !== actorId || (input.cashSessionId !== undefined && existing.cashSessionId !== input.cashSessionId)
      || (tendered === null ? existing.amountTendered !== null : !existing.amountTendered?.eq(tendered))) {
      throw new SalesOperationError('IDEMPOTENCY_KEY_REUSED', 409, 'La clave de idempotencia ya fue usada con otro pago');
    }
    return existing;
  };
  try {
    return await prisma.$transaction(async transaction => {
      const existing = await transaction.cashPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return matchExisting(existing);
      const sessions = await transaction.cashSession.findMany({ where: { status: CashSessionStatus.OPEN, ...(input.cashSessionId ? { id: input.cashSessionId } : {}) }, take: 2 });
      if (sessions.length === 0) throw new SalesOperationError('CASH_SESSION_REQUIRED', 409, 'Debe abrir una sesión de Caja');
      if (sessions.length > 1) throw new SalesOperationError('CASH_SESSION_SELECTION_REQUIRED', 409, 'Seleccione la sesión de Caja para registrar el pago');
      const session = sessions[0];
      // El cierre usa el mismo bloqueo: ningún pago puede quedar fuera de su arqueo.
      const sessionRows = await transaction.$queryRaw<Array<{ status: CashSessionStatus }>>`SELECT "status" FROM "cash_sessions" WHERE "id" = ${session.id} FOR UPDATE`;
      if (sessionRows[0]?.status !== CashSessionStatus.OPEN) throw new SalesOperationError('CASH_SESSION_CLOSED', 409, 'La sesión de Caja ya está cerrada');
      const invoice = await transaction.salesPreInvoice.findUnique({ where: { id: input.preInvoiceId }, select: { salesOrderId: true } });
      if (!invoice) throw new SalesOperationError('PREFINVOICE_NOT_ACTIVE', 409, 'La prefactura ya no está activa');
      // Orden de bloqueo compartido con generación y settlement: pedido → prefactura.
      await transaction.$queryRaw`SELECT "id" FROM "sales_orders" WHERE "id" = ${invoice.salesOrderId} FOR UPDATE`;
      const retry = await transaction.cashPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (retry) return matchExisting(retry);
      await lockOrder(transaction, invoice.salesOrderId);
      const invoiceRows = await transaction.$queryRaw<Array<{ totalSnapshot: Prisma.Decimal; consumptionTaxAmountSnapshot: Prisma.Decimal; serviceAmountSnapshot: Prisma.Decimal; status: SalesPreInvoiceStatus }>>`SELECT "totalSnapshot", "consumptionTaxAmountSnapshot", "serviceAmountSnapshot", "status" FROM "sales_pre_invoices" WHERE "id" = ${input.preInvoiceId} FOR UPDATE`;
      if (invoiceRows[0]?.status !== SalesPreInvoiceStatus.ACTIVE) throw new SalesOperationError('PREFINVOICE_NOT_ACTIVE', 409, 'La prefactura ya no está activa');
      const paidRow = await transaction.cashPayment.aggregate({ where: { preInvoiceId: input.preInvoiceId }, _sum: { amount: true } });
      const remaining = decimal(invoiceRows[0].totalSnapshot).sub(paidRow._sum.amount ?? ZERO);
      if (applied.gt(remaining)) throw new SalesOperationError('PAYMENT_EXCEEDS_TOTAL', 400, 'El pago supera el saldo pendiente');
      const split = splitCashPayment(invoiceRows[0].totalSnapshot, invoiceRows[0].consumptionTaxAmountSnapshot, invoiceRows[0].serviceAmountSnapshot, paidRow._sum.amount ?? ZERO, applied);
      const payment = await transaction.cashPayment.create({ data: { preInvoiceId: input.preInvoiceId, cashSessionId: session.id, method: input.method, amount: applied, ...split, amountTendered: tendered, change: tendered?.sub(applied) ?? ZERO, idempotencyKey: input.idempotencyKey, receivedById: actorId } });
      // Cubrir el total no sustituye la confirmación explícita «Cuenta pagada».
      await transaction.salesOrder.update({ where: { id: invoice.salesOrderId }, data: { paymentStatus: SalesPaymentStatus.PARTIALLY_PAID }, select: { id: true } });
      return payment;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.cashPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return matchExisting(existing);
    }
    throw error;
  }
}

export async function settleCashOrder(orderId: number, actorId: number) {
  return prisma.$transaction(async transaction => {
    const rows = await transaction.$queryRaw<Array<{ status: SalesOrderStatus; paymentStatus: SalesPaymentStatus }>>`SELECT "status", "paymentStatus" FROM "sales_orders" WHERE "id" = ${orderId} FOR UPDATE`;
    if (rows[0]?.status === SalesOrderStatus.SETTLED && rows[0].paymentStatus === SalesPaymentStatus.PAID) return serializeFinancialOrder(await getFinancialOrder(orderId, transaction));
    await lockOrder(transaction, orderId);
    const order = await getFinancialOrder(orderId, transaction);
    const invoice = order.preInvoices[0];
    if (!invoice) throw new SalesOperationError('PREFINVOICE_REQUIRED', 409, 'Debe generar una prefactura antes de pagar');
    await transaction.$queryRaw`SELECT "id" FROM "sales_pre_invoices" WHERE "id" = ${invoice.id} FOR UPDATE`;
    const paid = invoice.payments.reduce((total, payment) => total.add(decimal(payment.amount)), ZERO);
    if (!paid.eq(invoice.totalSnapshot)) throw new SalesOperationError('PAYMENT_NOT_COMPLETE', 409, 'La cuenta no está completamente cubierta');
    const pendingDispatch = await transaction.kitchenDispatch.findFirst({ where: { salesOrderId: orderId, OR: [{ status: { in: ['NEXT', 'PREPARING'] } }, { status: 'READY', deliveredAt: null }] }, select: { id: true, status: true } });
    if (pendingDispatch) throw new SalesOperationError('ORDER_NOT_READY_FOR_SETTLEMENT', 409, 'El pedido todavía tiene productos pendientes de entrega', { dispatchId: pendingDispatch.id });
    const unsent = await transaction.salesOrderItem.findFirst({ where: { salesOrderId: orderId, kitchenDispatchItem: null }, select: { id: true } });
    if (unsent) throw new SalesOperationError('ORDER_NOT_READY_FOR_SETTLEMENT', 409, 'El pedido todavía tiene productos pendientes de entrega', { itemId: unsent.id });
    await transaction.salesOrder.update({ where: { id: orderId }, data: { status: SalesOrderStatus.SETTLED, paymentStatus: SalesPaymentStatus.PAID, settledAt: new Date(), settledById: actorId }, select: { id: true } });
    return serializeFinancialOrder(await transaction.salesOrder.findUniqueOrThrow({ where: { id: orderId }, select: financialOrderSelect }));
  });
}

export async function closeCashSession(sessionId: number, countedCashValue: Prisma.Decimal.Value, actorId: number) {
  return prisma.$transaction(async transaction => {
    const rows = await transaction.$queryRaw<Array<{ id: number; openingCash: Prisma.Decimal; status: CashSessionStatus }>>`SELECT "id", "openingCash", "status" FROM "cash_sessions" WHERE "id" = ${sessionId} FOR UPDATE`;
    if (rows.length === 0) throw new SalesOperationError('CASH_SESSION_NOT_FOUND', 404, 'Sesión de Caja no encontrada');
    if (rows[0].status !== CashSessionStatus.OPEN) throw new SalesOperationError('CASH_SESSION_CLOSED', 409, 'La sesión de Caja ya está cerrada');
    const payments = await transaction.cashPayment.findMany({ where: { cashSessionId: sessionId }, select: { method: true, amount: true } });
    const expected = calculateExpectedCash(rows[0].openingCash, payments.filter(payment => payment.method === CashPaymentMethod.CASH).map(payment => payment.amount));
    const counted = amount(countedCashValue);
    if (counted.lt(0)) throw new SalesOperationError('INVALID_COUNTED_CASH', 400, 'El efectivo contado no puede ser negativo');
    const session = await transaction.cashSession.update({ where: { id: sessionId }, data: { status: CashSessionStatus.CLOSED, closedById: actorId, closedAt: new Date(), expectedCash: expected, countedCash: counted, difference: counted.sub(expected) }, include: { cashRegister: true, openedBy: { select: { id: true, fullName: true, email: true } }, closedBy: { select: { id: true, fullName: true, email: true } } } });
    const methods: Record<CashPaymentMethod, Prisma.Decimal> = { CASH: ZERO, CARD: ZERO, TRANSFER: ZERO, OTHER: ZERO };
    for (const payment of payments) methods[payment.method] = methods[payment.method].add(payment.amount);
    return { ...session, reconciliation: { byMethod: Object.fromEntries(Object.entries(methods).map(([method, value]) => [method, money(value)])) } };
  });
}

function dayRange(dateText?: string) {
  // Día operativo del restaurante en Colombia (UTC-05:00).
  const localDate = dateText ?? new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = new Date(`${localDate}T00:00:00.000-05:00`);
  if (Number.isNaN(start.getTime())) throw new SalesOperationError('INVALID_SALES_DATE', 400, 'La fecha no es válida');
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function listDailyCashSales(dateText?: string, client: CashClient = prisma) {
  const { start, end } = dayRange(dateText);
  const orders = await client.salesOrder.findMany({ where: { status: SalesOrderStatus.SETTLED, paymentStatus: SalesPaymentStatus.PAID, settledAt: { gte: start, lt: end } }, orderBy: { settledAt: 'asc' }, select: { id: true, settledAt: true, diningTable: { select: { code: true } }, settledBy: { select: { id: true, fullName: true, email: true } }, preInvoices: { where: { status: SalesPreInvoiceStatus.ACTIVE }, take: 1, include: { payments: { select: { method: true, amount: true } } } } } });
  const rows = orders.map(order => {
    const invoice = order.preInvoices[0];
    const sales = invoice ? decimal(invoice.salesAmountSnapshot) : ZERO;
    const tax = invoice ? decimal(invoice.consumptionTaxAmountSnapshot) : ZERO;
    const service = invoice ? decimal(invoice.serviceAmountSnapshot) : ZERO;
    const total = invoice ? decimal(invoice.totalSnapshot) : ZERO;
    return { id: order.id, settledAt: order.settledAt?.toISOString() ?? null, table: order.diningTable.code, salesAmount: money(sales), consumptionTaxAmount: money(tax), serviceAmount: money(service), totalCollected: money(total), payments: invoice?.payments.map(payment => ({ method: payment.method, amount: money(payment.amount) })) ?? [], settledBy: order.settledBy };
  });
  const summary = rows.reduce((acc, row) => { acc.sales = acc.sales.add(decimal(row.salesAmount)); acc.tax = acc.tax.add(decimal(row.consumptionTaxAmount)); acc.service = acc.service.add(decimal(row.serviceAmount)); acc.total = acc.total.add(decimal(row.totalCollected)); for (const payment of row.payments) acc.methods[payment.method] = (acc.methods[payment.method] ?? ZERO).add(decimal(payment.amount)); return acc; }, { sales: ZERO, tax: ZERO, service: ZERO, total: ZERO, methods: {} as Record<string, Prisma.Decimal> });
  return { date: dateText ?? new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10), rows, summary: { salesAmount: money(summary.sales), consumptionTaxAmount: money(summary.tax), serviceAmount: money(summary.service), totalCollected: money(summary.total), closedOrders: rows.length, byMethod: Object.fromEntries(Object.entries(summary.methods).map(([method, amount]) => [method, money(amount)])) } };
}

export async function cashDashboard(access: { reports: boolean; configure: boolean }, date?: string) {
  const [session, pending] = await Promise.all([getOpenCashSession(), listPendingCashOrders()]);
  return {
    session,
    pending,
    ...(access.configure ? { config: await getCashServiceConfig() } : {}),
    ...(access.reports ? {
      sessionSummary: session ? await getCashSessionSummary(session.id) : null,
      daily: await listDailyCashSales(date),
      history: await listCashSessionHistory(),
    } : {}),
  };
}

export async function getCashSessionReconciliation(sessionId: number) {
  return prisma.$transaction(async transaction => {
    const rows = await transaction.$queryRaw<Array<{ openingCash: Prisma.Decimal; status: CashSessionStatus }>>`SELECT "openingCash", "status" FROM "cash_sessions" WHERE "id" = ${sessionId} FOR UPDATE`;
    if (!rows[0]) throw new SalesOperationError('CASH_SESSION_NOT_FOUND', 404, 'Sesión de Caja no encontrada');
    if (rows[0].status !== CashSessionStatus.OPEN) throw new SalesOperationError('CASH_SESSION_CLOSED', 409, 'La sesión de Caja ya está cerrada');
    const payments = await transaction.cashPayment.findMany({ where: { cashSessionId: sessionId }, select: { method: true, amount: true } });
    const methods: Record<CashPaymentMethod, Prisma.Decimal> = { CASH: ZERO, CARD: ZERO, TRANSFER: ZERO, OTHER: ZERO };
    for (const payment of payments) methods[payment.method] = methods[payment.method].add(payment.amount);
    return {
      sessionId,
      openingCash: money(rows[0].openingCash),
      expectedCash: money(decimal(rows[0].openingCash).add(methods.CASH)),
      byMethod: Object.fromEntries(Object.entries(methods).map(([method, value]) => [method, money(value)])),
    };
  });
}

export async function getCashSessionSummary(sessionId: number, client: CashClient = prisma) {
  const session = await client.cashSession.findUniqueOrThrow({ where: { id: sessionId }, select: { openingCash: true } });
  const payments = await client.cashPayment.findMany({ where: { cashSessionId: sessionId }, select: { amount: true, salesAmount: true, consumptionTaxAmount: true, serviceAmount: true, method: true } });
  let sales = ZERO;
  let service = ZERO;
  let tax = ZERO;
  let collected = ZERO;
  const methods: Record<string, Prisma.Decimal> = { CASH: ZERO, CARD: ZERO, TRANSFER: ZERO, OTHER: ZERO };
  for (const payment of payments) {
    sales = sales.add(payment.salesAmount);
    tax = tax.add(payment.consumptionTaxAmount);
    service = service.add(payment.serviceAmount);
    collected = collected.add(payment.amount);
    methods[payment.method] = methods[payment.method].add(payment.amount);
  }
  return { salesAmount: money(sales), consumptionTaxAmount: money(tax), serviceAmount: money(service), totalCollected: money(collected), byMethod: Object.fromEntries(Object.entries(methods).map(([method, value]) => [method, money(value)])), expectedCash: money(decimal(session.openingCash).add(methods.CASH)) };
}

export async function listCashSessionHistory(client: CashClient = prisma) {
  const sessions = await client.cashSession.findMany({ where: { status: CashSessionStatus.CLOSED }, orderBy: { closedAt: 'desc' }, take: 50, include: { cashRegister: { select: { id: true, name: true } }, openedBy: { select: { id: true, fullName: true } }, closedBy: { select: { id: true, fullName: true } } } });
  return Promise.all(sessions.map(async session => ({ ...session, summary: await getCashSessionSummary(session.id, client) })));
}
