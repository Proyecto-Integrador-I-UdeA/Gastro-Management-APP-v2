import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ingredients = [
  // PROTEÍNAS
  { name: "Pechuga de pollo", category: "Proteína", caloriesPer100g: 165, carbsPer100g: 0, fatPer100g: 3.6, proteinPer100g: 31, sugarPer100g: 0, sodiumPer100g: 74 },
  { name: "Carne de res", category: "Proteína", caloriesPer100g: 250, carbsPer100g: 0, fatPer100g: 15, proteinPer100g: 26, sugarPer100g: 0, sodiumPer100g: 72 },
  { name: "Cerdo", category: "Proteína", caloriesPer100g: 242, carbsPer100g: 0, fatPer100g: 14, proteinPer100g: 27, sugarPer100g: 0, sodiumPer100g: 62 },
  { name: "Pescado blanco", category: "Proteína", caloriesPer100g: 96, carbsPer100g: 0, fatPer100g: 2, proteinPer100g: 20, sugarPer100g: 0, sodiumPer100g: 65 },
  { name: "Atún", category: "Proteína", caloriesPer100g: 132, carbsPer100g: 0, fatPer100g: 1, proteinPer100g: 28, sugarPer100g: 0, sodiumPer100g: 37 },
  { name: "Huevo", category: "Proteína", caloriesPer100g: 155, carbsPer100g: 1.1, fatPer100g: 11, proteinPer100g: 13, sugarPer100g: 1.1, sodiumPer100g: 124 },

  // VEGETALES
  { name: "Tomate", category: "Vegetal", caloriesPer100g: 18, carbsPer100g: 3.9, fatPer100g: 0.2, proteinPer100g: 0.9, sugarPer100g: 2.6, sodiumPer100g: 5 },
  { name: "Cebolla blanca", category: "Vegetal", caloriesPer100g: 40, carbsPer100g: 9.3, fatPer100g: 0.1, proteinPer100g: 1.1, sugarPer100g: 4.2, sodiumPer100g: 4 },
  { name: "Ajo", category: "Vegetal", caloriesPer100g: 149, carbsPer100g: 33, fatPer100g: 0.5, proteinPer100g: 6.4, sugarPer100g: 1, sodiumPer100g: 17 },
  { name: "Zanahoria", category: "Vegetal", caloriesPer100g: 41, carbsPer100g: 10, fatPer100g: 0.2, proteinPer100g: 0.9, sugarPer100g: 4.7, sodiumPer100g: 69 },
  { name: "Papa", category: "Vegetal", caloriesPer100g: 77, carbsPer100g: 17, fatPer100g: 0.1, proteinPer100g: 2, sugarPer100g: 0.8, sodiumPer100g: 6 },
  { name: "Pimentón rojo", category: "Vegetal", caloriesPer100g: 31, carbsPer100g: 6, fatPer100g: 0.3, proteinPer100g: 1, sugarPer100g: 4.2, sodiumPer100g: 4 },
  { name: "Lechuga", category: "Vegetal", caloriesPer100g: 15, carbsPer100g: 2.9, fatPer100g: 0.2, proteinPer100g: 1.4, sugarPer100g: 0.8, sodiumPer100g: 28 },

  // CARBOHIDRATOS
  { name: "Arroz blanco", category: "Carbohidrato", caloriesPer100g: 130, carbsPer100g: 28, fatPer100g: 0.3, proteinPer100g: 2.7, sugarPer100g: 0.1, sodiumPer100g: 1 },
  { name: "Pasta", category: "Carbohidrato", caloriesPer100g: 131, carbsPer100g: 25, fatPer100g: 1.1, proteinPer100g: 5, sugarPer100g: 0.6, sodiumPer100g: 1 },
  { name: "Harina de trigo", category: "Carbohidrato", caloriesPer100g: 364, carbsPer100g: 76, fatPer100g: 1, proteinPer100g: 10, sugarPer100g: 0.3, sodiumPer100g: 2 },

  // LÁCTEOS
  { name: "Leche entera", category: "Lácteo", caloriesPer100g: 61, carbsPer100g: 4.8, fatPer100g: 3.3, proteinPer100g: 3.2, sugarPer100g: 5, sodiumPer100g: 43 },
  { name: "Queso mozzarella", category: "Lácteo", caloriesPer100g: 280, carbsPer100g: 3.1, fatPer100g: 17, proteinPer100g: 28, sugarPer100g: 1, sodiumPer100g: 627 },
  { name: "Mantequilla", category: "Lácteo", caloriesPer100g: 717, carbsPer100g: 0.1, fatPer100g: 81, proteinPer100g: 0.9, sugarPer100g: 0.1, sodiumPer100g: 11 },

  // ACEITES
  { name: "Aceite vegetal", category: "Grasa", caloriesPer100g: 884, carbsPer100g: 0, fatPer100g: 100, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 0 },
  { name: "Aceite de oliva", category: "Grasa", caloriesPer100g: 884, carbsPer100g: 0, fatPer100g: 100, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 2 },

  // CONDIMENTOS
  { name: "Azúcar", category: "Condimento", caloriesPer100g: 387, carbsPer100g: 100, fatPer100g: 0, proteinPer100g: 0, sugarPer100g: 100, sodiumPer100g: 1 },
  { name: "Sal", category: "Condimento", caloriesPer100g: 0, carbsPer100g: 0, fatPer100g: 0, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 38758 },
 
    // PROTEÍNAS ADICIONALES
  { name: "Pavo", category: "Proteína", caloriesPer100g: 189, carbsPer100g: 0, fatPer100g: 7.4, proteinPer100g: 29, sugarPer100g: 0, sodiumPer100g: 109 },
  { name: "Muslo de pollo", category: "Proteína", caloriesPer100g: 209, carbsPer100g: 0, fatPer100g: 10.9, proteinPer100g: 26, sugarPer100g: 0, sodiumPer100g: 95 },
  { name: "Carne molida de res", category: "Proteína", caloriesPer100g: 254, carbsPer100g: 0, fatPer100g: 17, proteinPer100g: 26, sugarPer100g: 0, sodiumPer100g: 72 },
  { name: "Costilla de cerdo", category: "Proteína", caloriesPer100g: 292, carbsPer100g: 0, fatPer100g: 21, proteinPer100g: 23, sugarPer100g: 0, sodiumPer100g: 82 },
  { name: "Jamón cocido", category: "Proteína", caloriesPer100g: 145, carbsPer100g: 1.5, fatPer100g: 5.5, proteinPer100g: 21, sugarPer100g: 1.2, sodiumPer100g: 1200 },
  { name: "Tocino", category: "Proteína", caloriesPer100g: 541, carbsPer100g: 1.4, fatPer100g: 42, proteinPer100g: 37, sugarPer100g: 0, sodiumPer100g: 1717 },
  { name: "Chorizo", category: "Proteína", caloriesPer100g: 455, carbsPer100g: 2, fatPer100g: 38, proteinPer100g: 24, sugarPer100g: 1, sodiumPer100g: 1810 },
  { name: "Salchicha", category: "Proteína", caloriesPer100g: 301, carbsPer100g: 2.3, fatPer100g: 27, proteinPer100g: 12, sugarPer100g: 1.4, sodiumPer100g: 1090 },
  { name: "Salmón", category: "Proteína", caloriesPer100g: 208, carbsPer100g: 0, fatPer100g: 13, proteinPer100g: 20, sugarPer100g: 0, sodiumPer100g: 59 },
  { name: "Tilapia", category: "Proteína", caloriesPer100g: 96, carbsPer100g: 0, fatPer100g: 1.7, proteinPer100g: 20, sugarPer100g: 0, sodiumPer100g: 52 },
  { name: "Merluza", category: "Proteína", caloriesPer100g: 90, carbsPer100g: 0, fatPer100g: 1.3, proteinPer100g: 19, sugarPer100g: 0, sodiumPer100g: 70 },
  { name: "Camarón", category: "Proteína", caloriesPer100g: 99, carbsPer100g: 0.2, fatPer100g: 0.3, proteinPer100g: 24, sugarPer100g: 0, sodiumPer100g: 111 },
  { name: "Calamar", category: "Proteína", caloriesPer100g: 92, carbsPer100g: 3.1, fatPer100g: 1.4, proteinPer100g: 15.6, sugarPer100g: 0, sodiumPer100g: 44 },
  { name: "Mejillones", category: "Proteína", caloriesPer100g: 172, carbsPer100g: 7.4, fatPer100g: 4.5, proteinPer100g: 24, sugarPer100g: 0, sodiumPer100g: 286 },
  { name: "Pulpo", category: "Proteína", caloriesPer100g: 82, carbsPer100g: 2.2, fatPer100g: 1, proteinPer100g: 15, sugarPer100g: 0, sodiumPer100g: 230 },

  // VEGETALES ADICIONALES
  { name: "Cebolla morada", category: "Vegetal", caloriesPer100g: 40, carbsPer100g: 9.3, fatPer100g: 0.1, proteinPer100g: 1.1, sugarPer100g: 4.7, sodiumPer100g: 4 },
  { name: "Brócoli", category: "Vegetal", caloriesPer100g: 34, carbsPer100g: 6.6, fatPer100g: 0.4, proteinPer100g: 2.8, sugarPer100g: 1.7, sodiumPer100g: 33 },
  { name: "Coliflor", category: "Vegetal", caloriesPer100g: 25, carbsPer100g: 5, fatPer100g: 0.3, proteinPer100g: 1.9, sugarPer100g: 1.9, sodiumPer100g: 30 },
  { name: "Espinaca", category: "Vegetal", caloriesPer100g: 23, carbsPer100g: 3.6, fatPer100g: 0.4, proteinPer100g: 2.9, sugarPer100g: 0.4, sodiumPer100g: 79 },
  { name: "Repollo", category: "Vegetal", caloriesPer100g: 25, carbsPer100g: 6, fatPer100g: 0.1, proteinPer100g: 1.3, sugarPer100g: 3.2, sodiumPer100g: 18 },
  { name: "Pepino", category: "Vegetal", caloriesPer100g: 15, carbsPer100g: 3.6, fatPer100g: 0.1, proteinPer100g: 0.7, sugarPer100g: 1.7, sodiumPer100g: 2 },
  { name: "Apio", category: "Vegetal", caloriesPer100g: 16, carbsPer100g: 3, fatPer100g: 0.2, proteinPer100g: 0.7, sugarPer100g: 1.3, sodiumPer100g: 80 },
  { name: "Berenjena", category: "Vegetal", caloriesPer100g: 25, carbsPer100g: 6, fatPer100g: 0.2, proteinPer100g: 1, sugarPer100g: 3.5, sodiumPer100g: 2 },
  { name: "Zucchini", category: "Vegetal", caloriesPer100g: 17, carbsPer100g: 3.1, fatPer100g: 0.3, proteinPer100g: 1.2, sugarPer100g: 2.5, sodiumPer100g: 8 },
  { name: "Champiñones", category: "Vegetal", caloriesPer100g: 22, carbsPer100g: 3.3, fatPer100g: 0.3, proteinPer100g: 3.1, sugarPer100g: 2, sodiumPer100g: 5 },
  { name: "Maíz dulce", category: "Vegetal", caloriesPer100g: 86, carbsPer100g: 19, fatPer100g: 1.4, proteinPer100g: 3.2, sugarPer100g: 6.3, sodiumPer100g: 15 },
  { name: "Yuca", category: "Vegetal", caloriesPer100g: 160, carbsPer100g: 38, fatPer100g: 0.3, proteinPer100g: 1.4, sugarPer100g: 1.7, sodiumPer100g: 14 },
  { name: "Batata", category: "Vegetal", caloriesPer100g: 86, carbsPer100g: 20, fatPer100g: 0.1, proteinPer100g: 1.6, sugarPer100g: 4.2, sodiumPer100g: 55 },
  { name: "Remolacha", category: "Vegetal", caloriesPer100g: 43, carbsPer100g: 10, fatPer100g: 0.2, proteinPer100g: 1.6, sugarPer100g: 6.8, sodiumPer100g: 78 },
  { name: "Puerro", category: "Vegetal", caloriesPer100g: 61, carbsPer100g: 14, fatPer100g: 0.3, proteinPer100g: 1.5, sugarPer100g: 3.9, sodiumPer100g: 20 },

  // FRUTAS
  { name: "Banano", category: "Fruta", caloriesPer100g: 89, carbsPer100g: 23, fatPer100g: 0.3, proteinPer100g: 1.1, sugarPer100g: 12, sodiumPer100g: 1 },
  { name: "Manzana", category: "Fruta", caloriesPer100g: 52, carbsPer100g: 14, fatPer100g: 0.2, proteinPer100g: 0.3, sugarPer100g: 10, sodiumPer100g: 1 },
  { name: "Pera", category: "Fruta", caloriesPer100g: 57, carbsPer100g: 15, fatPer100g: 0.1, proteinPer100g: 0.4, sugarPer100g: 10, sodiumPer100g: 1 },
  { name: "Mango", category: "Fruta", caloriesPer100g: 60, carbsPer100g: 15, fatPer100g: 0.4, proteinPer100g: 0.8, sugarPer100g: 14, sodiumPer100g: 1 },
  { name: "Piña", category: "Fruta", caloriesPer100g: 50, carbsPer100g: 13, fatPer100g: 0.1, proteinPer100g: 0.5, sugarPer100g: 10, sodiumPer100g: 1 },
  { name: "Fresa", category: "Fruta", caloriesPer100g: 32, carbsPer100g: 7.7, fatPer100g: 0.3, proteinPer100g: 0.7, sugarPer100g: 4.9, sodiumPer100g: 1 },
  { name: "Mora", category: "Fruta", caloriesPer100g: 43, carbsPer100g: 10, fatPer100g: 0.5, proteinPer100g: 1.4, sugarPer100g: 4.9, sodiumPer100g: 1 },
  { name: "Arándanos", category: "Fruta", caloriesPer100g: 57, carbsPer100g: 14, fatPer100g: 0.3, proteinPer100g: 0.7, sugarPer100g: 10, sodiumPer100g: 1 },
  { name: "Uvas", category: "Fruta", caloriesPer100g: 69, carbsPer100g: 18, fatPer100g: 0.2, proteinPer100g: 0.7, sugarPer100g: 16, sodiumPer100g: 2 },
  { name: "Naranja", category: "Fruta", caloriesPer100g: 47, carbsPer100g: 12, fatPer100g: 0.1, proteinPer100g: 0.9, sugarPer100g: 9.4, sodiumPer100g: 0 },
  { name: "Mandarina", category: "Fruta", caloriesPer100g: 53, carbsPer100g: 13, fatPer100g: 0.3, proteinPer100g: 0.8, sugarPer100g: 10.6, sodiumPer100g: 2 },
  { name: "Limón", category: "Fruta", caloriesPer100g: 29, carbsPer100g: 9.3, fatPer100g: 0.3, proteinPer100g: 1.1, sugarPer100g: 2.5, sodiumPer100g: 2 },
  { name: "Aguacate", category: "Fruta", caloriesPer100g: 160, carbsPer100g: 8.5, fatPer100g: 15, proteinPer100g: 2, sugarPer100g: 0.7, sodiumPer100g: 7 },

    // CARBOHIDRATOS ADICIONALES
  { name: "Arroz integral", category: "Carbohidrato", caloriesPer100g: 123, carbsPer100g: 25.6, fatPer100g: 1, proteinPer100g: 2.7, sugarPer100g: 0.4, sodiumPer100g: 4 },
  { name: "Quinoa", category: "Carbohidrato", caloriesPer100g: 120, carbsPer100g: 21.3, fatPer100g: 1.9, proteinPer100g: 4.4, sugarPer100g: 0.9, sodiumPer100g: 7 },
  { name: "Avena", category: "Carbohidrato", caloriesPer100g: 389, carbsPer100g: 66, fatPer100g: 6.9, proteinPer100g: 16.9, sugarPer100g: 0.9, sodiumPer100g: 2 },
  { name: "Cebada", category: "Carbohidrato", caloriesPer100g: 354, carbsPer100g: 73.5, fatPer100g: 2.3, proteinPer100g: 12.5, sugarPer100g: 0.8, sodiumPer100g: 12 },
  { name: "Cuscús", category: "Carbohidrato", caloriesPer100g: 112, carbsPer100g: 23.2, fatPer100g: 0.2, proteinPer100g: 3.8, sugarPer100g: 0.1, sodiumPer100g: 5 },
  { name: "Maíz", category: "Carbohidrato", caloriesPer100g: 96, carbsPer100g: 21, fatPer100g: 1.5, proteinPer100g: 3.4, sugarPer100g: 4.5, sodiumPer100g: 15 },
  { name: "Harina de maíz", category: "Carbohidrato", caloriesPer100g: 365, carbsPer100g: 76.9, fatPer100g: 3.9, proteinPer100g: 8.1, sugarPer100g: 1.6, sodiumPer100g: 7 },
  { name: "Pan blanco", category: "Carbohidrato", caloriesPer100g: 265, carbsPer100g: 49, fatPer100g: 3.2, proteinPer100g: 9, sugarPer100g: 5, sodiumPer100g: 491 },
  { name: "Pan integral", category: "Carbohidrato", caloriesPer100g: 247, carbsPer100g: 41, fatPer100g: 4.2, proteinPer100g: 13, sugarPer100g: 6, sodiumPer100g: 430 },
  { name: "Tortilla de trigo", category: "Carbohidrato", caloriesPer100g: 310, carbsPer100g: 52, fatPer100g: 7.9, proteinPer100g: 8.2, sugarPer100g: 2.8, sodiumPer100g: 560 },
  { name: "Tortilla de maíz", category: "Carbohidrato", caloriesPer100g: 218, carbsPer100g: 45, fatPer100g: 2.9, proteinPer100g: 5.7, sugarPer100g: 0.6, sodiumPer100g: 45 },
  { name: "Arepa", category: "Carbohidrato", caloriesPer100g: 218, carbsPer100g: 45, fatPer100g: 1.8, proteinPer100g: 4.5, sugarPer100g: 1.2, sodiumPer100g: 210 },
  { name: "Galletas saladas", category: "Carbohidrato", caloriesPer100g: 430, carbsPer100g: 71, fatPer100g: 12, proteinPer100g: 8, sugarPer100g: 7, sodiumPer100g: 780 },

  // LEGUMBRES
  { name: "Lentejas", category: "Legumbre", caloriesPer100g: 116, carbsPer100g: 20, fatPer100g: 0.4, proteinPer100g: 9, sugarPer100g: 1.8, sodiumPer100g: 2 },
  { name: "Garbanzos", category: "Legumbre", caloriesPer100g: 164, carbsPer100g: 27, fatPer100g: 2.6, proteinPer100g: 8.9, sugarPer100g: 4.8, sodiumPer100g: 7 },
  { name: "Frijol negro", category: "Legumbre", caloriesPer100g: 132, carbsPer100g: 24, fatPer100g: 0.5, proteinPer100g: 8.9, sugarPer100g: 0.3, sodiumPer100g: 1 },
  { name: "Frijol rojo", category: "Legumbre", caloriesPer100g: 127, carbsPer100g: 22.8, fatPer100g: 0.5, proteinPer100g: 8.7, sugarPer100g: 0.3, sodiumPer100g: 2 },
  { name: "Arvejas", category: "Legumbre", caloriesPer100g: 84, carbsPer100g: 15, fatPer100g: 0.4, proteinPer100g: 5.4, sugarPer100g: 5.7, sodiumPer100g: 3 },
  { name: "Habas", category: "Legumbre", caloriesPer100g: 110, carbsPer100g: 19.7, fatPer100g: 0.4, proteinPer100g: 7.6, sugarPer100g: 1.8, sodiumPer100g: 5 },
  { name: "Soya", category: "Legumbre", caloriesPer100g: 173, carbsPer100g: 10, fatPer100g: 9, proteinPer100g: 16.6, sugarPer100g: 3, sodiumPer100g: 2 },

  // LÁCTEOS
  { name: "Leche descremada", category: "Lácteo", caloriesPer100g: 34, carbsPer100g: 5, fatPer100g: 0.1, proteinPer100g: 3.4, sugarPer100g: 5, sodiumPer100g: 42 },
  { name: "Yogurt natural", category: "Lácteo", caloriesPer100g: 61, carbsPer100g: 4.7, fatPer100g: 3.3, proteinPer100g: 3.5, sugarPer100g: 4.7, sodiumPer100g: 46 },
  { name: "Crema de leche", category: "Lácteo", caloriesPer100g: 340, carbsPer100g: 2.8, fatPer100g: 36, proteinPer100g: 2.1, sugarPer100g: 2.9, sodiumPer100g: 38 },
  { name: "Queso cheddar", category: "Lácteo", caloriesPer100g: 403, carbsPer100g: 1.3, fatPer100g: 33, proteinPer100g: 25, sugarPer100g: 0.5, sodiumPer100g: 621 },
  { name: "Queso parmesano", category: "Lácteo", caloriesPer100g: 431, carbsPer100g: 4.1, fatPer100g: 29, proteinPer100g: 38, sugarPer100g: 0.9, sodiumPer100g: 1529 },
  { name: "Queso crema", category: "Lácteo", caloriesPer100g: 342, carbsPer100g: 4.1, fatPer100g: 34, proteinPer100g: 6.2, sugarPer100g: 3.2, sodiumPer100g: 321 },
  { name: "Queso fresco", category: "Lácteo", caloriesPer100g: 299, carbsPer100g: 2.2, fatPer100g: 24, proteinPer100g: 18, sugarPer100g: 1.5, sodiumPer100g: 505 },
  { name: "Ricotta", category: "Lácteo", caloriesPer100g: 174, carbsPer100g: 3, fatPer100g: 13, proteinPer100g: 11, sugarPer100g: 0.3, sodiumPer100g: 84 },

  // GRASAS
  { name: "Aceite de canola", category: "Grasa", caloriesPer100g: 884, carbsPer100g: 0, fatPer100g: 100, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 0 },
  { name: "Aceite de coco", category: "Grasa", caloriesPer100g: 892, carbsPer100g: 0, fatPer100g: 100, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 0 },
  { name: "Aceite de girasol", category: "Grasa", caloriesPer100g: 884, carbsPer100g: 0, fatPer100g: 100, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 0 },
  { name: "Margarina", category: "Grasa", caloriesPer100g: 717, carbsPer100g: 0.7, fatPer100g: 81, proteinPer100g: 0.2, sugarPer100g: 0, sodiumPer100g: 700 },
  { name: "Mayonesa", category: "Grasa", caloriesPer100g: 680, carbsPer100g: 1, fatPer100g: 75, proteinPer100g: 1, sugarPer100g: 1, sodiumPer100g: 635 },
  { name: "Manteca vegetal", category: "Grasa", caloriesPer100g: 884, carbsPer100g: 0, fatPer100g: 100, proteinPer100g: 0, sugarPer100g: 0, sodiumPer100g: 0 },
  { name: "Maní", category: "Grasa", caloriesPer100g: 567, carbsPer100g: 16, fatPer100g: 49, proteinPer100g: 26, sugarPer100g: 4.7, sodiumPer100g: 18 },
  { name: "Almendras", category: "Grasa", caloriesPer100g: 579, carbsPer100g: 22, fatPer100g: 50, proteinPer100g: 21, sugarPer100g: 4.4, sodiumPer100g: 1 },
  { name: "Nueces", category: "Grasa", caloriesPer100g: 654, carbsPer100g: 14, fatPer100g: 65, proteinPer100g: 15, sugarPer100g: 2.6, sodiumPer100g: 2 },

    // CONDIMENTOS Y BÁSICOS
  { name: "Pimienta negra", category: "Condimento", caloriesPer100g: 251, carbsPer100g: 64, fatPer100g: 3.3, proteinPer100g: 10.4, sugarPer100g: 0.6, sodiumPer100g: 20 },
  { name: "Comino", category: "Condimento", caloriesPer100g: 375, carbsPer100g: 44, fatPer100g: 22, proteinPer100g: 18, sugarPer100g: 2.3, sodiumPer100g: 168 },
  { name: "Orégano seco", category: "Condimento", caloriesPer100g: 265, carbsPer100g: 69, fatPer100g: 4.3, proteinPer100g: 9, sugarPer100g: 4.1, sodiumPer100g: 25 },
  { name: "Paprika", category: "Condimento", caloriesPer100g: 282, carbsPer100g: 54, fatPer100g: 13, proteinPer100g: 14, sugarPer100g: 10, sodiumPer100g: 68 },
  { name: "Canela", category: "Condimento", caloriesPer100g: 247, carbsPer100g: 81, fatPer100g: 1.2, proteinPer100g: 4, sugarPer100g: 2.2, sodiumPer100g: 10 },
  { name: "Vinagre blanco", category: "Condimento", caloriesPer100g: 21, carbsPer100g: 0.9, fatPer100g: 0, proteinPer100g: 0, sugarPer100g: 0.4, sodiumPer100g: 5 },
  { name: "Vinagre balsámico", category: "Condimento", caloriesPer100g: 88, carbsPer100g: 17, fatPer100g: 0, proteinPer100g: 0.5, sugarPer100g: 15, sodiumPer100g: 23 },
  { name: "Miel", category: "Condimento", caloriesPer100g: 304, carbsPer100g: 82, fatPer100g: 0, proteinPer100g: 0.3, sugarPer100g: 82, sodiumPer100g: 4 },
  { name: "Panela", category: "Condimento", caloriesPer100g: 383, carbsPer100g: 98, fatPer100g: 0, proteinPer100g: 0, sugarPer100g: 96, sodiumPer100g: 30 },
  { name: "Mostaza", category: "Condimento", caloriesPer100g: 66, carbsPer100g: 5.8, fatPer100g: 4.4, proteinPer100g: 4.4, sugarPer100g: 0.9, sodiumPer100g: 1135 },

  // SALSAS
  { name: "Ketchup", category: "Salsa", caloriesPer100g: 112, carbsPer100g: 27, fatPer100g: 0.2, proteinPer100g: 1.3, sugarPer100g: 22, sodiumPer100g: 907 },
  { name: "Salsa soya", category: "Salsa", caloriesPer100g: 53, carbsPer100g: 4.9, fatPer100g: 0.6, proteinPer100g: 8.1, sugarPer100g: 0.4, sodiumPer100g: 5493 },
  { name: "Salsa BBQ", category: "Salsa", caloriesPer100g: 172, carbsPer100g: 40, fatPer100g: 0.5, proteinPer100g: 1.1, sugarPer100g: 33, sodiumPer100g: 856 },
  { name: "Salsa inglesa", category: "Salsa", caloriesPer100g: 78, carbsPer100g: 19, fatPer100g: 0, proteinPer100g: 0.8, sugarPer100g: 10, sodiumPer100g: 980 },
  { name: "Pasta de tomate", category: "Salsa", caloriesPer100g: 82, carbsPer100g: 19, fatPer100g: 0.5, proteinPer100g: 4.3, sugarPer100g: 12, sodiumPer100g: 59 },
  { name: "Salsa de tomate", category: "Salsa", caloriesPer100g: 29, carbsPer100g: 6.7, fatPer100g: 0.2, proteinPer100g: 1.4, sugarPer100g: 4.1, sodiumPer100g: 430 },
  { name: "Pesto", category: "Salsa", caloriesPer100g: 454, carbsPer100g: 6, fatPer100g: 47, proteinPer100g: 4, sugarPer100g: 1.5, sodiumPer100g: 590 },

  // PESCADOS / MARISCOS EXTRA
  { name: "Bacalao", category: "Proteína", caloriesPer100g: 82, carbsPer100g: 0, fatPer100g: 0.7, proteinPer100g: 18, sugarPer100g: 0, sodiumPer100g: 54 },
  { name: "Trucha", category: "Proteína", caloriesPer100g: 141, carbsPer100g: 0, fatPer100g: 6.2, proteinPer100g: 20.5, sugarPer100g: 0, sodiumPer100g: 52 },
  { name: "Sardinas", category: "Proteína", caloriesPer100g: 208, carbsPer100g: 0, fatPer100g: 11.5, proteinPer100g: 25, sugarPer100g: 0, sodiumPer100g: 307 },
  { name: "Cangrejo", category: "Proteína", caloriesPer100g: 97, carbsPer100g: 0, fatPer100g: 1.5, proteinPer100g: 19, sugarPer100g: 0, sodiumPer100g: 911 },

  // LATAM / OPERACIÓN GASTRONÓMICA
  { name: "Plátano verde", category: "Latam", caloriesPer100g: 122, carbsPer100g: 32, fatPer100g: 0.4, proteinPer100g: 1.3, sugarPer100g: 15, sodiumPer100g: 4 },
  { name: "Plátano maduro", category: "Latam", caloriesPer100g: 116, carbsPer100g: 31, fatPer100g: 0.2, proteinPer100g: 1.3, sugarPer100g: 15, sodiumPer100g: 3 },
  { name: "Guacamole", category: "Latam", caloriesPer100g: 167, carbsPer100g: 9, fatPer100g: 15, proteinPer100g: 2, sugarPer100g: 1.5, sodiumPer100g: 240 },
  { name: "Hogao", category: "Latam", caloriesPer100g: 65, carbsPer100g: 8, fatPer100g: 3.2, proteinPer100g: 1.2, sugarPer100g: 5, sodiumPer100g: 220 },
  { name: "Ají", category: "Latam", caloriesPer100g: 40, carbsPer100g: 9, fatPer100g: 0.4, proteinPer100g: 2, sugarPer100g: 5.3, sodiumPer100g: 9 },
  { name: "Chimichurri", category: "Latam", caloriesPer100g: 250, carbsPer100g: 8, fatPer100g: 24, proteinPer100g: 1.5, sugarPer100g: 2, sodiumPer100g: 680 },
  { name: "Frijoles refritos", category: "Latam", caloriesPer100g: 137, carbsPer100g: 18, fatPer100g: 4.8, proteinPer100g: 6.8, sugarPer100g: 1.2, sodiumPer100g: 450 },

  // PANADERÍA / OPERACIÓN
  { name: "Croissant", category: "Panadería", caloriesPer100g: 406, carbsPer100g: 45, fatPer100g: 21, proteinPer100g: 8.2, sugarPer100g: 11, sodiumPer100g: 384 },
  { name: "Pan hamburguesa", category: "Panadería", caloriesPer100g: 295, carbsPer100g: 49, fatPer100g: 6.3, proteinPer100g: 9, sugarPer100g: 6, sodiumPer100g: 510 },
  { name: "Pan hot dog", category: "Panadería", caloriesPer100g: 287, carbsPer100g: 50, fatPer100g: 5.1, proteinPer100g: 8.5, sugarPer100g: 7, sodiumPer100g: 490 },

  // BEBIDAS BASE
  { name: "Café", category: "Bebida", caloriesPer100g: 1, carbsPer100g: 0, fatPer100g: 0, proteinPer100g: 0.1, sugarPer100g: 0, sodiumPer100g: 2 },
  { name: "Chocolate en polvo", category: "Bebida", caloriesPer100g: 228, carbsPer100g: 58, fatPer100g: 14, proteinPer100g: 20, sugarPer100g: 1.8, sodiumPer100g: 21 },

    // EMBUTIDOS / PROTEÍNAS EXTRA
  { name: "Pepperoni", category: "Proteína", caloriesPer100g: 494, carbsPer100g: 1.2, fatPer100g: 44, proteinPer100g: 23, sugarPer100g: 0.5, sodiumPer100g: 1582 },
  { name: "Mortadela", category: "Proteína", caloriesPer100g: 311, carbsPer100g: 3.1, fatPer100g: 25, proteinPer100g: 16, sugarPer100g: 0.5, sodiumPer100g: 1100 },
  { name: "Prosciutto", category: "Proteína", caloriesPer100g: 195, carbsPer100g: 0, fatPer100g: 8.1, proteinPer100g: 29, sugarPer100g: 0, sodiumPer100g: 1500 },
  { name: "Pechuga de pavo ahumada", category: "Proteína", caloriesPer100g: 135, carbsPer100g: 2, fatPer100g: 2.5, proteinPer100g: 25, sugarPer100g: 1, sodiumPer100g: 1050 },

  // QUESOS EXTRA
  { name: "Queso gouda", category: "Lácteo", caloriesPer100g: 356, carbsPer100g: 2.2, fatPer100g: 27, proteinPer100g: 25, sugarPer100g: 2.2, sodiumPer100g: 819 },
  { name: "Queso azul", category: "Lácteo", caloriesPer100g: 353, carbsPer100g: 2.3, fatPer100g: 28, proteinPer100g: 21, sugarPer100g: 0.5, sodiumPer100g: 1395 },
  { name: "Queso provolone", category: "Lácteo", caloriesPer100g: 351, carbsPer100g: 2.1, fatPer100g: 26, proteinPer100g: 26, sugarPer100g: 0.6, sodiumPer100g: 876 },
  { name: "Queso brie", category: "Lácteo", caloriesPer100g: 334, carbsPer100g: 0.5, fatPer100g: 28, proteinPer100g: 21, sugarPer100g: 0.5, sodiumPer100g: 629 },

  // HIERBAS FRESCAS
  { name: "Cilantro", category: "Hierba", caloriesPer100g: 23, carbsPer100g: 3.7, fatPer100g: 0.5, proteinPer100g: 2.1, sugarPer100g: 0.9, sodiumPer100g: 46 },
  { name: "Perejil", category: "Hierba", caloriesPer100g: 36, carbsPer100g: 6.3, fatPer100g: 0.8, proteinPer100g: 3, sugarPer100g: 0.9, sodiumPer100g: 56 },
  { name: "Albahaca", category: "Hierba", caloriesPer100g: 23, carbsPer100g: 2.7, fatPer100g: 0.6, proteinPer100g: 3.2, sugarPer100g: 0.3, sodiumPer100g: 4 },
  { name: "Romero", category: "Hierba", caloriesPer100g: 131, carbsPer100g: 21, fatPer100g: 5.9, proteinPer100g: 3.3, sugarPer100g: 0, sodiumPer100g: 26 },

  // HARINAS / REPOSTERÍA
  { name: "Harina de almendra", category: "Harina", caloriesPer100g: 571, carbsPer100g: 21, fatPer100g: 50, proteinPer100g: 21, sugarPer100g: 4.4, sodiumPer100g: 1 },
  { name: "Harina de avena", category: "Harina", caloriesPer100g: 404, carbsPer100g: 66, fatPer100g: 9, proteinPer100g: 14, sugarPer100g: 1.2, sodiumPer100g: 3 },
  { name: "Cacao en polvo", category: "Repostería", caloriesPer100g: 228, carbsPer100g: 58, fatPer100g: 14, proteinPer100g: 20, sugarPer100g: 1.8, sodiumPer100g: 21 },
  { name: "Chocolate oscuro", category: "Repostería", caloriesPer100g: 598, carbsPer100g: 46, fatPer100g: 43, proteinPer100g: 7.8, sugarPer100g: 24, sodiumPer100g: 20 },
  { name: "Leche condensada", category: "Repostería", caloriesPer100g: 321, carbsPer100g: 54, fatPer100g: 8.7, proteinPer100g: 7.9, sugarPer100g: 54, sodiumPer100g: 127 },

  // TOPPINGS / EXTRAS
  { name: "Aceitunas verdes", category: "Extra", caloriesPer100g: 145, carbsPer100g: 3.8, fatPer100g: 15, proteinPer100g: 1, sugarPer100g: 0, sodiumPer100g: 1556 },
  { name: "Aceitunas negras", category: "Extra", caloriesPer100g: 116, carbsPer100g: 6, fatPer100g: 10.9, proteinPer100g: 0.8, sugarPer100g: 0, sodiumPer100g: 735 },
  { name: "Pepinillos", category: "Extra", caloriesPer100g: 12, carbsPer100g: 2.4, fatPer100g: 0.2, proteinPer100g: 0.5, sugarPer100g: 1.1, sodiumPer100g: 1208 },
  { name: "Jalapeño", category: "Extra", caloriesPer100g: 29, carbsPer100g: 6.5, fatPer100g: 0.4, proteinPer100g: 0.9, sugarPer100g: 4.1, sodiumPer100g: 3 },
  { name: "Maíz tostado", category: "Extra", caloriesPer100g: 446, carbsPer100g: 72, fatPer100g: 14, proteinPer100g: 9, sugarPer100g: 1.5, sodiumPer100g: 35 },

  // POSTRES BASE
  { name: "Helado de vainilla", category: "Postre", caloriesPer100g: 207, carbsPer100g: 24, fatPer100g: 11, proteinPer100g: 3.5, sugarPer100g: 21, sodiumPer100g: 80 },
  { name: "Crema chantilly", category: "Postre", caloriesPer100g: 257, carbsPer100g: 12, fatPer100g: 22, proteinPer100g: 2.1, sugarPer100g: 10, sodiumPer100g: 39 },

  // INSUMOS DE COCINA
  { name: "Levadura seca", category: "Insumo", caloriesPer100g: 325, carbsPer100g: 41, fatPer100g: 7.6, proteinPer100g: 40, sugarPer100g: 0, sodiumPer100g: 51 },
  { name: "Gelatina sin sabor", category: "Insumo", caloriesPer100g: 335, carbsPer100g: 0, fatPer100g: 0, proteinPer100g: 86, sugarPer100g: 0, sodiumPer100g: 110 },
];


async function main() {
  for (const ingredient of ingredients) {
    await prisma.ingredientCatalog.upsert({
      where: { name: ingredient.name },
      update: {},
      create: ingredient,
    });
  }

  console.log("✅ Catálogo nutricional cargado");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });