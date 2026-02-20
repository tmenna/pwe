import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, LogOut, UserCog } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import pweLogo from "@assets/pwc_logo_1771579613297.jpg";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Children", url: "/children", icon: Users },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"
    : "U";

  const allNavItems = user?.role === "admin"
    ? [...navItems, { title: "User Management", url: "/admin/users", icon: UserCog }]
    : navItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={pweLogo} alt="Partners with Ethiopia" className="h-9 w-9 rounded-md object-cover" data-testid="img-sidebar-logo" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground" data-testid="text-app-name">Records Portal</span>
          </div>
        </div>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allNavItems.map((item) => {
                const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive} className={isActive ? "bg-sidebar-accent" : ""}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
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
        <Separator className="mb-4" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-medium" data-testid="text-user-name">
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username}
            </span>
            <span className="truncate text-xs text-muted-foreground" data-testid="text-user-role">
              {user?.role === "admin" ? "Administrator" : user?.role === "case_worker" ? "Case Worker" : "Read Only"}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
