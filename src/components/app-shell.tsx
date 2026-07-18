import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main data-app-shell className="mx-auto min-h-screen max-w-[var(--app-max-width)] bg-bg px-[var(--app-gutter)] pb-[calc(var(--safe-bottom)+88px)] pt-5 text-text">
      {children}
      <BottomNav />
    </main>
  );
}
