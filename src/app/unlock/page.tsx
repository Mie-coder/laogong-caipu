import { Heart } from "lucide-react";
import { UnlockForm } from "@/components/auth/unlock-form";
import { PageTransition } from "@/components/page-transition";
import { sanitizeReturnPath } from "@/lib/auth/family-gate";

type UnlockPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function UnlockPage({ searchParams }: UnlockPageProps) {
  const resolvedSearchParams = await searchParams;
  const next = typeof resolvedSearchParams?.next === "string" ? resolvedSearchParams.next : null;
  const returnTo = sanitizeReturnPath(next);

  return (
    <PageTransition>
      <main className="family-unlock-page" data-transaction-screen="true">
        <section className="family-unlock-card" aria-labelledby="family-unlock-title">
          <div className="family-unlock-mark" aria-hidden="true"><Heart /></div>
          <p className="family-unlock-eyebrow">老公菜谱</p>
          <h1 id="family-unlock-title">欢迎回家</h1>
          <p className="family-unlock-lead">输入家庭密码，继续查看我们一起收藏的味道。</p>
          <UnlockForm returnTo={returnTo} />
        </section>
      </main>
    </PageTransition>
  );
}
