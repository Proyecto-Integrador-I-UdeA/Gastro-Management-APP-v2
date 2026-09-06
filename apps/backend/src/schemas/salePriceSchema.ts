import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { SALE_PRICE_RATE_DECIMAL_PLACES } from '../services/pricing/salePriceCalculator';

const decimalRate = z.string().regex(
  new RegExp(
    `^(?:0|[1-9]\\d*)(?:\\.\\d{1,${SALE_PRICE_RATE_DECIMAL_PLACES}})?$`,
  ),
  `Debe ser un decimal no negativo con máximo ${SALE_PRICE_RATE_DECIMAL_PLACES} posiciones decimales enviado como string`,
);

export const salePriceInputSchema = z
  .object({
    marginRate: decimalRate.refine(
      value => new Prisma.Decimal(value).lt(1),
      'marginRate debe ser menor que 1',
    ),
    taxRate: decimalRate.refine(
      value => new Prisma.Decimal(value).lte(1),
      'taxRate debe ser menor o igual a 1',
    ),
  })
  .strict();
