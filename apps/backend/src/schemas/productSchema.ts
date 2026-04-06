import { z } from 'zod';

const baseUnitSchema = z.enum(['g', 'ml', 'und']);

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const expirationNotInPastMessage =
  'La fecha de vencimiento no puede ser anterior a la fecha actual';

const minStockNonNegativeMessage =
  'El stock mínimo no puede ser negativo';
const maxStockNonNegativeMessage =
  'El stock máximo no puede ser negativo';
const currentStockNonNegativeMessage =
  'El stock actual no puede ser negativo';
const unitCostNonNegativeMessage =
  'El costo unitario no puede ser negativo';

/** Número ≥ 0; acepta string numérico del cliente y rechaza NaN. */
const nonNegativeNumber = (message: string) =>
  z.union([
    z.number(),
    z.string().transform((v) => Number(v)),
  ]).pipe(
    z
      .number()
      .finite('Valor numérico inválido')
      .min(0, message)
  );

const optionalNonNegativeNumber = (message: string) =>
  z
    .union([z.number(), z.string(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return typeof v === 'string' ? Number(v) : v;
    })
    .superRefine((val, ctx) => {
      if (val === undefined) return;
      if (!Number.isFinite(val)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor numérico inválido' });
        return;
      }
      if (val < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      }
    });

/** Fecha opcional; si viene vacía → null. Si viene con valor, debe ser hoy o futura (solo día calendario, hora local). */
const createExpirationDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === '') return null;
    return new Date(v);
  })
  .pipe(
    z.union([
      z.null(),
      z.date().refine((d) => !Number.isNaN(d.getTime()), { message: 'Fecha de vencimiento inválida' }),
    ])
  )
  .superRefine((val, ctx) => {
    if (val === null) return;
    const today = startOfLocalDay(new Date());
    const exp = startOfLocalDay(val);
    if (exp.getTime() < today.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: expirationNotInPastMessage });
    }
  });

/** En actualización: undefined = no tocar; null o string vacío = sin fecha; string con fecha = validar. */
const updateExpirationDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    return new Date(v);
  })
  .superRefine((val, ctx) => {
    if (val === undefined || val === null) return;
    if (Number.isNaN(val.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha de vencimiento inválida' });
      return;
    }
    const today = startOfLocalDay(new Date());
    const exp = startOfLocalDay(val);
    if (exp.getTime() < today.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: expirationNotInPastMessage });
    }
  });

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().optional().default(''),
  isIngredient: z.boolean(),
  isSupply: z.boolean(),
  isFinishedProduct: z.boolean(),
  presentation: z.string().min(1, 'Presentación requerida'),
  unitOfMeasure: baseUnitSchema,
  inputUnit: z.string().min(1, 'Unidad ingresada requerida'),
  inputUnitQuantity: z.number().positive('Cantidad por unidad ingresada inválida'),
  expirationDate: createExpirationDateSchema,
  minStock: nonNegativeNumber(minStockNonNegativeMessage),
  maxStock: nonNegativeNumber(maxStockNonNegativeMessage),
  currentStock: nonNegativeNumber(currentStockNonNegativeMessage),
  unitCost: nonNegativeNumber(unitCostNonNegativeMessage),
  supplierId: z.number().int().positive(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  isIngredient: z.boolean().optional(),
  isSupply: z.boolean().optional(),
  isFinishedProduct: z.boolean().optional(),
  presentation: z.string().min(1).optional(),
  unitOfMeasure: baseUnitSchema.optional(),
  inputUnit: z.string().min(1).optional(),
  inputUnitQuantity: z.number().positive().optional(),
  expirationDate: updateExpirationDateSchema,
  minStock: optionalNonNegativeNumber(minStockNonNegativeMessage),
  maxStock: optionalNonNegativeNumber(maxStockNonNegativeMessage),
  currentStock: optionalNonNegativeNumber(currentStockNonNegativeMessage),
  unitCost: optionalNonNegativeNumber(unitCostNonNegativeMessage),
  supplierId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});
