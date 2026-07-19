import { createRecipeRepository } from "@/lib/db/recipe-repository";
import { createIngredientImagePostHandler } from "@/lib/images/ingredient-image-route-handlers";
import { createIngredientImageService } from "@/lib/images/ingredient-image-service";

const images = createIngredientImageService();
export const POST = createIngredientImagePostHandler({
  getRecipeById: (id) => createRecipeRepository().getRecipeById(id),
  images
});
