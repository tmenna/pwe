import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, LogOut, UserCog, Building2, Heart, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import pweLogo from "@assets/pwe-large-logo_1772038246752.jpg";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    iconBg: "bg-violet-50 dark:bg-violet-500/12",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    title: "Children",
    url: "/children",
    icon: Users,
    iconBg: "bg-emerald-50 dark:bg-emerald-500/12",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
];

const adminNavItems: NavItem[] = [
  {
    title: "Organizations",
    url: "/organizations",
    icon: Building2,
    iconBg: "bg-orange-50 dark:bg-orange-500/12",
    iconColor: "text-orange-500 dark:text-orange-400",
  },
  {
    title: "User Management",
    url: "/admin/users",
    icon: UserCog,
    iconBg: "bg-violet-50 dark:bg-violet-500/12",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
];

const roleBadgeStyles: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  case_worker: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25",
  sponsor: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/25",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  case_worker: "Case Worker",
  sponsor: "Sponsor",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"
    : "U";

  const sponsorNavItems: NavItem[] = [
    {
      title: "My Portal",
      url: "/",
      icon: Heart,
      iconBg: "bg-pink-50 dark:bg-pink-500/12",
      iconColor: "text-pink-600 dark:text-pink-400",
    },
  ];

  const allNavItems = user?.role === "sponsor"
    ? sponsorNavItems
    : user?.role === "admin"
      ? [...navItems, ...adminNavItems]
      : navItems;

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.username || "User";

  return (
    <Sidebar>
      {/* ── Brand header ─────────────────────────────────── */}
      <SidebarHeader className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-2xl shadow-md ring-1 ring-border/20 overflow-hidden">
            <img
              src={pweLogo}
              alt="Partners with Ethiopia"
              className="h-[52px] w-[52px] object-cover"
              data-testid="img-sidebar-logo"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[18px] font-bold tracking-tight leading-tight text-foreground" data-testid="text-app-name">
              <span className="text-[#2e8b57]">PWE</span> Portal
            </span>
            <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#3cba88] mt-0.5">
              Child Sponsorship
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* ── MENU label with dividers ─────────────────────── */}
      <div className="px-5 mb-2">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/50" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
            Menu
          </span>
          <div className="h-px flex-1 bg-border/50" />
        </div>
      </div>

      {/* ── Nav items ────────────────────────────────────── */}
      <SidebarContent className="px-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {allNavItems.map((item) => {
                const isActive = item.url === "/"
                  ? location === "/"
                  : location.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={`
                        relative h-[54px] rounded-xl px-3 transition-all duration-200
                        ${isActive
                          ? "bg-violet-50 dark:bg-violet-500/10 shadow-sm border border-violet-100 dark:border-violet-500/15"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                        }
                      `}
                    >
                      <Link
                        href={item.url}
                        data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                        className="flex items-center gap-3.5 w-full"
                      >
                        {/* Left accent bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-7 rounded-r-full bg-violet-500" />
                        )}

                        {/* Icon container — always colored */}
                        <div className={`
                          flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
                          transition-colors duration-200
                          ${isActive
                            ? item.iconBg + " shadow-sm"
                            : "bg-slate-100/80 dark:bg-slate-800/60"
                          }
                        `}>
                          <item.icon className={`h-[18px] w-[18px] transition-colors duration-200 ${
                            isActive
                              ? item.iconColor
                              : "text-slate-400 dark:text-slate-500"
                          }`} />
                        </div>

                        {/* Label */}
                        <span className={`
                          flex-1 text-[15px] font-semibold transition-colors duration-200
                          ${isActive
                            ? "text-violet-700 dark:text-violet-300"
                            : "text-slate-600 dark:text-slate-400 group-hover:text-foreground"
                          }
                        `}>
                          {item.title}
                        </span>

                        {/* Chevron */}
                        <ChevronRight className={`h-4 w-4 shrink-0 transition-colors duration-200 ${
                          isActive
                            ? "text-violet-400 dark:text-violet-500"
                            : "text-slate-300 dark:text-slate-600"
                        }`} />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer user card ─────────────────────────────── */}
      <SidebarFooter className="px-4 pb-5 pt-3">
        <div className="h-px bg-border/40 mb-4" />
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-border/40 px-4 py-3 shadow-sm">
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm">
            <AvatarFallback className="text-sm font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <span
              className="truncate text-[14px] font-semibold leading-tight text-foreground"
              data-testid="text-user-name"
            >
              {displayName}
            </span>
            <Badge
              variant="outline"
              className={`mt-1 w-fit text-[10px] font-semibold px-2 py-0 h-[17px] rounded-full ${roleBadgeStyles[user?.role || ""] || ""}`}
              data-testid="text-user-role"
            >
              {roleLabels[user?.role || ""] || user?.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl shrink-0 text-slate-400 hover:text-destructive hover:bg-destructive/8 transition-colors"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
