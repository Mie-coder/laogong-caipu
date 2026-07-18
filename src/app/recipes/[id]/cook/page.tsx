import { AppShell } from "@/components/app-shell";
import { CookingMode } from "@/components/cooking/cooking-mode";

export default function CookingPage({ params }: { params: { id: string } }) {
  return <AppShell><CookingMode recipeId={Number(params.id)} /></AppShell>;
}
