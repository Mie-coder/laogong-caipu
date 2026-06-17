import { AppShell } from "@/components/app-shell";
import { ImportFlow } from "@/components/import-flow";
import { PageTransition } from "@/components/page-transition";

export default function ImportPage() {
  return (
    <AppShell>
      <PageTransition>
        <ImportFlow />
      </PageTransition>
    </AppShell>
  );
}
