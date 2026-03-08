var express = require('express');
var router = express.Router();
var { prisma } = require('../src/db');
var { Prisma } = require('../src/generated/prisma');

/** GET /products - listar todos los productos */
router.get('/', async function (req, res, next) {
  try {
    const includeSupplier = req.query.include === 'supplier';
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      include: includeSupplier ? { supplier: true } : undefined,
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

/** GET /products/:id - obtener un producto por id */
router.get('/:id', async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const product = await prisma.product.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});

/** POST /products - crear producto */
router.post('/', async function (req, res, next) {
  try {
    const {
      internalCode,
      name,
      isIngredient,
      isSupply,
      isFinishedProduct,
      presentation,
      unitOfMeasure,
      expirationDate,
      minStock,
      maxStock,
      currentStock,
      unitCost,
      supplierId,
    } = req.body;

    const required = [
      'internalCode',
      'name',
      'isIngredient',
      'isSupply',
      'isFinishedProduct',
      'presentation',
      'unitOfMeasure',
      'minStock',
      'maxStock',
      'currentStock',
      'unitCost',
      'supplierId',
    ];
    const missing = required.filter((key) => req.body[key] === undefined);
    if (missing.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missing,
      });
    }

    const product = await prisma.product.create({
      data: {
        internalCode: String(internalCode),
        name: String(name),
        isIngredient: Boolean(isIngredient),
        isSupply: Boolean(isSupply),
        isFinishedProduct: Boolean(isFinishedProduct),
        presentation: String(presentation),
        unitOfMeasure: String(unitOfMeasure),
        expirationDate:
          expirationDate != null && expirationDate !== ''
            ? new Date(expirationDate)
            : null,
        minStock: Number(minStock),
        maxStock: Number(maxStock),
        currentStock: Number(currentStock),
        unitCost: new Prisma.Decimal(unitCost),
        supplierId: parseInt(supplierId, 10),
      },
      include: { supplier: true },
    });
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }
    next(err);
  }
});

/** PUT /products/:id - actualizar producto */
router.put('/:id', async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const {
      internalCode,
      name,
      isIngredient,
      isSupply,
      isFinishedProduct,
      presentation,
      unitOfMeasure,
      expirationDate,
      minStock,
      maxStock,
      currentStock,
      unitCost,
      supplierId,
    } = req.body;

    const data = {};
    if (internalCode !== undefined) data.internalCode = String(internalCode);
    if (name !== undefined) data.name = String(name);
    if (isIngredient !== undefined) data.isIngredient = Boolean(isIngredient);
    if (isSupply !== undefined) data.isSupply = Boolean(isSupply);
    if (isFinishedProduct !== undefined)
      data.isFinishedProduct = Boolean(isFinishedProduct);
    if (presentation !== undefined) data.presentation = String(presentation);
    if (unitOfMeasure !== undefined)
      data.unitOfMeasure = String(unitOfMeasure);
    if (expirationDate !== undefined)
      data.expirationDate =
        expirationDate != null && expirationDate !== ''
          ? new Date(expirationDate)
          : null;
    if (minStock !== undefined) data.minStock = Number(minStock);
    if (maxStock !== undefined) data.maxStock = Number(maxStock);
    if (currentStock !== undefined) data.currentStock = Number(currentStock);
    if (unitCost !== undefined) data.unitCost = new Prisma.Decimal(unitCost);
    if (supplierId !== undefined) data.supplierId = parseInt(supplierId, 10);

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { supplier: true },
    });
    res.json(product);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }
    next(err);
  }
});

/** DELETE /products/:id - eliminar producto */
router.delete('/:id', async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    await prisma.product.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    next(err);
  }
});

module.exports = router;
