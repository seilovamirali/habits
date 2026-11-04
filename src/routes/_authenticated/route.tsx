
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

const TABS = [
  { to: "/today", label: "Сегодня", icon: "☀️" },
  { to: "/leaderboard", label: "Рейтинг", icon: "🏆" },
  { to: "/profile", label: "Профиль", icon: "👤" },
  { to: "/jawshan", label: "Джевшен", icon: "📿" },
  { to: "/book", label: "Книга", icon: <BookOpen className="size-5" /> },
] as const;

function AppLayout() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const reading = path === "/reader";
  return (
    <div className={`min-h-screen bg-background ${reading ? "" : "pb-24"}`}>
      <div className={`mx-auto ${reading ? "max-w-3xl" : "max-w-lg"}`}>
        <Outlet />
      </div>
      {!reading && <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] font-medium leading-tight text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-10 items-center justify-center rounded-full text-lg transition-all ${isActive ? "bg-secondary scale-105" : ""}`}>
                    {t.icon}
                  </span>
                  {t.label}
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>}
    </div>
  );
}


