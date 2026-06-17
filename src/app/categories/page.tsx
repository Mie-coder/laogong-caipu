import { AppShell } from "@/components/app-shell";
import { PageTransition } from "@/components/page-transition";
import { RecipeList } from "@/components/recipe-list";

export default function CategoriesPage() {
  return (
    <AppShell>
      <PageTransition>
        <section className="space-y-4">
          <div>
            <p className="text-sm text-muted">按分类快速找菜</p>
            <h1 className="text-2xl font-semibold text-ink">分类</h1>
          </div>
          <RecipeList />
        </section>
      </PageTransition>
    </AppShell>
  );
}
