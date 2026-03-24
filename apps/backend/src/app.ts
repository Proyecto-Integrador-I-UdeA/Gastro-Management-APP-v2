import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import supplierRoutes from './routes/suppliers/index';
import productRoutes from './routes/products/index';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors({
  origin: [
    "http://localhost:3000",
    'https://gastro-management-app-v2-co9x9fcsd.vercel.app'
  ],
  credentials: true
}));
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