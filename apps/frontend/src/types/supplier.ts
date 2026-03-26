/** Aligned with Prisma `Supplier` / GET /suppliers */
export interface Supplier {
  id: number;
  internalCode: string;
  name: string;
  taxId: string;
  phone: string;
  address: string;
  contactPerson: string;
  active: boolean;
}
