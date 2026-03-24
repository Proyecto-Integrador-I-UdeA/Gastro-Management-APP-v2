import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import supplierRoutes from './routes/suppliers/index';
import productRoutes from './routes/products/index';

const app = express();
const PORT = process.env.PORT || 3001;

// 🔥 CORS DINÁMICO (MEJOR SOLUCIÓN)
app.use(cors({
  origin: function (origin, callback) {
    // permitir requests sin origin (postman, etc.)
    if (!origin) return callback(null, true);

    // permitir localhost
    if (origin.includes('localhost')) {
      return callback(null, true);
    }

    // permitir cualquier deploy de vercel
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// 🔥 IMPORTANTE PARA PREFLIGHT
app.options('*', cors());

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/products', productRoutes);

app.get('/', (req, res) => {
  res.json({ message: '¡Backend de Gastro Management API funcionando!' });
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
























