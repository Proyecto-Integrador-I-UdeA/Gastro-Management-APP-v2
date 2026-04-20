import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// CREAR PLATO
export const createMenuItem = async (req: Request, res: Response) => {
  try {
    const { name, description, hasDrink, hasDessert, components } = req.body;

   const newItem = await prisma.menuItem.create({
  data: {
    name,
    description,
    hasDrink,
    hasDessert,
    active: true,
    components: {
      create: components.map((c: any) => ({
        quantity: Number(c.quantity) || 1,
        ...(c.productId ? { productId: c.productId } : {}),
        ...(c.recipeId ? { recipeId: c.recipeId } : {}),
      })),
    },
  },
  include: {
    components: true,
  },
}); 

    res.json(newItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando plato" });
  }
};

// LISTAR PLATOS
export const listMenuItems = async (_req: Request, res: Response) => {
  const items = await prisma.menuItem.findMany({
    include: {
      components: {
        include: {
          product: true,
          recipe: true,
        },
      },
    },
  });

  res.json(items);
};
// ACTUALIZAR PLATO
export const updateMenuItem = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const {
      name,
      description,
      hasDrink,
      hasDessert,
      active,
      components,
    } = req.body;
console.log("📦 COMPONENTS UPDATE BACK:", components);
    // 🔥 eliminar componentes actuales
    await prisma.menuItemComponent.deleteMany({
      where: { menuItemId: id },
    });
      console.log("📦 COMPONENTS UPDATE:", components);
    // 🔥 actualizar plato
    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        name,
        description,
        hasDrink,
        hasDessert,
        active,
      components: {
  create: components.map((c: any) => ({
    quantity: Number(c.quantity) || 1,
    ...(c.productId ? { productId: c.productId } : {}),
    ...(c.recipeId ? { recipeId: c.recipeId } : {}),
  })),
}, 
       
       
      },
      include: {
        components: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error actualizando plato" });
  }
};
// OBTENER PLATO POR ID
export const getMenuItemById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        components: {
          include: {
            product: true,
            recipe: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Plato no encontrado" });
    }

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo plato" });
  }
};