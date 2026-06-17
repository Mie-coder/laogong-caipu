import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeDetail } from "@/components/recipe-detail";

export default function RecipeDetailPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <PageTransition>
        <RecipeDetail id={Number(params.id)} />
      </PageTransition>
    </AppShell>
  );
}
