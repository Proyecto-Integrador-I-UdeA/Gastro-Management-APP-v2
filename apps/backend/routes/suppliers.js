var express = require('express');
var router = express.Router();
var { prisma } = require('../src/db');

/** GET /suppliers - listar todos los proveedores */
router.get('/', async function (req, res, next) {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

/** GET /suppliers/:id - obtener un proveedor por id */
router.get('/:id', async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

/** POST /suppliers - crear proveedor */
router.post('/', async function (req, res, next) {
  try {
    const { internalCode, name, taxId, phone, address, contactPerson } = req.body;
    if (!internalCode || !name || !taxId || !phone || !address || contactPerson === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: internalCode, name, taxId, phone, address, contactPerson',
      });
    }
    const supplier = await prisma.supplier.create({
      data: {
        internalCode: String(internalCode),
        name: String(name),
        taxId: String(taxId),
        phone: String(phone),
        address: String(address),
        contactPerson: String(contactPerson),
      },
    });
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

/** PUT /suppliers/:id - actualizar proveedor */
router.put('/:id', async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { internalCode, name, taxId, phone, address, contactPerson } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(internalCode !== undefined && { internalCode: String(internalCode) }),
        ...(name !== undefined && { name: String(name) }),
        ...(taxId !== undefined && { taxId: String(taxId) }),
        ...(phone !== undefined && { phone: String(phone) }),
        ...(address !== undefined && { address: String(address) }),
        ...(contactPerson !== undefined && { contactPerson: String(contactPerson) }),
      },
    });
    res.json(supplier);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    next(err);
  }
});

/** DELETE /suppliers/:id - eliminar proveedor */
router.delete('/:id', async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    await prisma.supplier.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete supplier: it has associated products',
      });
    }
    next(err);
  }
});

module.exports = router;
