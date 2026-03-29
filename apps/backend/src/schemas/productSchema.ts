import { z } from 'zod';

const baseUnitSchema = z.enum(['g', 'ml', 'und']);

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const expirationNotInPastMessage =
  'La fecha de vencimiento no puede ser anterior a la fecha actual';

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
  internalCode: z.string().min(1, 'Código interno requerido'),
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
  minStock: z.number().min(0),
  maxStock: z.number().min(0),
  currentStock: z.number().min(0),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))),
  supplierId: z.number().int().positive(),
});

export const updateProductSchema = z.object({
  internalCode: z.string().min(1).optional(),
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
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))).optional(),
  supplierId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});
