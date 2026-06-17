import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeList } from "@/components/recipe-list";
import { SkeletonCard } from "@/components/skeleton-card";

export default function RecipesPage() {
  return (
    <AppShell>
      <PageTransition>
        <Suspense fallback={<div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>}>
          <RecipeList />
        </Suspense>
      </PageTransition>
    </AppShell>
  );
}
