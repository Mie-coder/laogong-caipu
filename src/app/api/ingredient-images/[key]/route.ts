import { createIngredientImageGetHandler } from "@/lib/images/ingredient-image-route-handlers";
import { createIngredientImageService } from "@/lib/images/ingredient-image-service";

const images = createIngredientImageService();
export const GET = createIngredientImageGetHandler(images);
