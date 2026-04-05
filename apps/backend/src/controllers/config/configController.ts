import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createConfig = async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;

    const config = await prisma.config.create({
      data: { key, value }
    });

    res.status(201).json(config);
  } catch (error) {
    console.error('Error creando config:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const getConfigs = async (req: Request, res: Response) => {
  try {
    const configs = await prisma.config.findMany();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
};