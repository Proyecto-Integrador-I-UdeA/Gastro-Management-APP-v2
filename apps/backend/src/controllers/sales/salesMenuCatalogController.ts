import { Request, Response } from 'express';
import {
  getSalesMenuCatalog,
  SalesMenuCatalogInconsistencyError,
} from '../../services/sales/salesMenuCatalogService';

export const listSalesMenuCatalog = async (_req: Request, res: Response) => {
  try {
    return res.json(await getSalesMenuCatalog());
  } catch (error) {
    if (error instanceof SalesMenuCatalogInconsistencyError) {
      console.error('Inconsistencia en catálogo de ventas:', error.message);
      return res.status(500).json({
        error: 'Inconsistencia de precios vigentes en el catálogo de ventas',
      });
    }

    console.error('Error consultando catálogo de ventas:', error);
    return res.status(500).json({ error: 'Error interno consultando catálogo de ventas' });
  }
};
