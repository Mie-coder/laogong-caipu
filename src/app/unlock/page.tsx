import { Heart } from "lucide-react";
import { UnlockForm } from "@/components/auth/unlock-form";
import { PageTransition } from "@/components/page-transition";
import { sanitizeReturnPath } from "@/lib/auth/family-gate";

type UnlockPageProps = {
  searchParams?: { next?: string | string[] };
};

export default function UnlockPage({ searchParams }: UnlockPageProps): JSX.Element {
  const next = typeof searchParams?.next === "string" ? searchParams.next : null;
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
