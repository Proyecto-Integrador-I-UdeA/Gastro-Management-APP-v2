import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { listRecipes, createRecipe, getRecipeSummary } from '../../controllers/recipes/recipeController';


const router = Router();
router.get('/', authenticate, listRecipes); 
router.get('/:id/summary', authenticate, getRecipeSummary);
router.post('/', authenticate, createRecipe);/*OJO SE  DEBE agregar authorize recipes.read(es solo para prueba en postman)*/

export default router;  