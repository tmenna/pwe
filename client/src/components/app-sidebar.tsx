import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, LogOut, UserCog, Heart, Palette } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Children", url: "/children", icon: Users },
];

const colorOptions = [
  { value: "amber" as const, label: "Amber", className: "bg-[hsl(38,85%,42%)]" },
  { value: "green" as const, label: "Green", className: "bg-[hsl(152,73%,39%)]" },
  { value: "blue" as const, label: "Blue", className: "bg-[hsl(221,83%,53%)]" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { colorTheme, setColorTheme } = useTheme();

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"
    : "U";

  const allNavItems = user?.role === "admin"
    ? [...navItems, { title: "User Management", url: "/admin/users", icon: UserCog }]
    : navItems;

  const currentColor = colorOptions.find((c) => c.value === colorTheme) || colorOptions[0];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" data-testid="text-app-name">CareTrack</span>
            <span className="text-xs text-muted-foreground">Records Portal</span>
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

        <SidebarGroup>
          <SidebarGroupLabel>Preferences</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton data-testid="button-color-theme">
                      <Palette className="h-4 w-4" />
                      <span>Color Theme</span>
                      <span className={`ml-auto h-3 w-3 rounded-full ${currentColor.className}`} />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {colorOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => setColorTheme(option.value)}
                        data-testid={`button-color-${option.value}`}
                        className="gap-2"
                      >
                        <span className={`h-3 w-3 rounded-full ${option.className}`} />
                        <span>{option.label}</span>
                        {colorTheme === option.value && (
                          <span className="ml-auto text-xs text-muted-foreground">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
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
