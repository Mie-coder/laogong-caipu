import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeDetail } from "@/components/recipe-detail";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <PageTransition>
        <RecipeDetail id={Number(id)} />
      </PageTransition>
    </AppShell>
  );
}
