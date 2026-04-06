import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import supplierRoutes from './routes/suppliers/index';
import productRoutes from './routes/products/index';
import warehouseRoutes from './routes/warehouses/index';
import inventoryRoutes from './routes/inventories/index';
import inventoryMovementRoutes from './routes/inventory-movements/index';
import recipeRoutes from './routes/recipes/index';
import costRoutes from './routes/costs';
import configRoutes from './routes/config';

const app = express();
const PORT = process.env.PORT || 3001;

// 🔥 CONFIGURACIÓN CORS ROBUSTA
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://gastro-management-app-v2.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // permitir herramientas sin origin (Postman, curl, etc.)
      if (!origin) return callback(null, true);

      // permitir localhost
      if (origin.includes("localhost")) {
        return callback(null, true);
      }

      // permitir vercel (todos los deploys)
      if (origin.includes("vercel.app")) {
        return callback(null, true);
      }

      // permitir lista explícita
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("❌ CORS bloqueado para:", origin);
      return callback(null, false); // ⚠️ importante: no lanzar error
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);

// 🔥 PREFLIGHT (IMPORTANTE)
app.options("*", cors());

app.use(express.json());

// 🔥 RUTAS
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/products', productRoutes);
app.use('/warehouses', warehouseRoutes);
app.use('/inventories', inventoryRoutes);
app.use('/inventory-movements', inventoryMovementRoutes);
app.use('/recipes', recipeRoutes);
app.use('/costs', costRoutes);
app.use('/config', configRoutes);

// 🔥 HEALTH CHECK
app.get('/', (req, res) => {
  res.json({ message: '¡Backend de Gastro Management API funcionando!' });
});

// 🔥 START SERVER
app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

