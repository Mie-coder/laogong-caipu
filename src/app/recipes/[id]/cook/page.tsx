import { AppShell } from "@/components/app-shell";
import { CookingMode } from "@/components/cooking/cooking-mode";

export default async function CookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><CookingMode recipeId={Number(id)} /></AppShell>;
}
