import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, LogOut, UserCog, Shield, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import pweLogo from "@assets/pwe-large-logo_1772038246752.jpg";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    activeIconBg: "bg-blue-50 dark:bg-blue-500/10",
    activeIconColor: "text-blue-600 dark:text-blue-400",
    inactiveIconColor: "text-slate-400 dark:text-slate-500",
  },
  {
    title: "Children",
    url: "/children",
    icon: Users,
    activeIconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    activeIconColor: "text-emerald-600 dark:text-emerald-400",
    inactiveIconColor: "text-slate-400 dark:text-slate-500",
  },
];

const adminNavItems = [
  {
    title: "Organizations",
    url: "/organizations",
    icon: Building2,
    activeIconBg: "bg-orange-50 dark:bg-orange-500/10",
    activeIconColor: "text-orange-500 dark:text-orange-400",
    inactiveIconColor: "text-slate-400 dark:text-slate-500",
  },
  {
    title: "User Management",
    url: "/admin/users",
    icon: UserCog,
    activeIconBg: "bg-violet-50 dark:bg-violet-500/10",
    activeIconColor: "text-violet-600 dark:text-violet-400",
    inactiveIconColor: "text-slate-400 dark:text-slate-500",
  },
];

const roleBadgeStyles: Record<string, string> = {
  admin: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20",
  case_worker: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  read_only: "bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
  sponsor: "bg-pink-50 text-pink-700 border-pink-200/60 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/20",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  case_worker: "Case Worker",
  read_only: "Read Only",
  sponsor: "Sponsor",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"
    : "U";

  const allNavItems = user?.role === "admin"
    ? [...navItems, ...adminNavItems]
    : navItems;

  return (
    <Sidebar>
      <SidebarHeader className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3.5">
          <img src={pweLogo} alt="Partners with Ethiopia" className="h-11 w-11 rounded-xl object-cover shadow-md ring-1 ring-border/30" data-testid="img-sidebar-logo" />
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-bold tracking-tight leading-tight text-foreground" data-testid="text-app-name">
              <span className="text-[#2e8b57]">PWE</span> Portal
            </span>
            <span className="text-[12px] font-semibold tracking-wide uppercase text-[#66DAB5]">Child Sponsorship</span>
          </div>
        </div>
      </SidebarHeader>

      <div className="mx-4 h-px bg-border/40" />

      <SidebarContent className="px-3 pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/50 px-3 mb-1">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {allNavItems.map((item) => {
                const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={`relative rounded-lg h-10 transition-all duration-150 ${
                        isActive
                          ? "bg-card shadow-sm border border-border/50 font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                        )}
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isActive ? item.activeIconBg : ""}`}>
                          <item.icon className={`h-4 w-4 ${isActive ? item.activeIconColor : item.inactiveIconColor}`} />
                        </div>
                        <span className="text-[13px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="mx-0 mb-3 h-px bg-border/40" />
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
          <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium leading-tight" data-testid="text-user-name">
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username}
            </span>
            <Badge
              variant="outline"
              className={`mt-1 w-fit text-[10px] font-medium px-1.5 py-0 h-[18px] ${roleBadgeStyles[user?.role || ""] || ""}`}
              data-testid="text-user-role"
            >
              {roleLabels[user?.role || ""] || user?.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/8"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
