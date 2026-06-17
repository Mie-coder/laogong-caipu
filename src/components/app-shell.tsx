import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-[430px] bg-cream px-4 pb-28 pt-5">
      {children}
      <BottomNav />
    </main>
  );
}
