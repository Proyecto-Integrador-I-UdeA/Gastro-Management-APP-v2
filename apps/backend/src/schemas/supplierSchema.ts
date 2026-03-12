import { z } from 'zod';

export const createSupplierSchema = z.object({
  internalCode: z.string().min(1, 'Código interno requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  taxId: z.string().min(1, 'RUT/NIT requerido'),
  phone: z.string().min(1, 'Teléfono requerido'),
  address: z.string().min(1, 'Dirección requerida'),
  contactPerson: z.string(),
});

export const updateSupplierSchema = z.object({
  internalCode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  taxId: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  contactPerson: z.string().optional(),
});
