import { Link } from "@tanstack/react-router";
import { Compass, Flame, Home, Sparkles, User } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Início", icon: Home, exact: true },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/tendencias", label: "Tendências", icon: Flame },
  { to: "/indicacoes", label: "Indicações", icon: Sparkles },
  { to: "/meu", label: "Meu", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: "exact" in rest }}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground"
            activeProps={{ className: "!text-primary font-semibold" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
