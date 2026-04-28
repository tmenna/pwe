import { useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import ChildrenList from "@/pages/children-list";
import ChildForm from "@/pages/child-form";
import ChildProfile from "@/pages/child-profile";
import AdminUsers from "@/pages/admin-users";
import Organizations from "@/pages/organizations";
import SponsorPortal from "@/pages/sponsor-portal";

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
} as React.CSSProperties;

function SponsorLayout() {
  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex flex-1 flex-col overflow-hidden">
            <Switch>
              <Route path="/" component={SponsorPortal} />
              <Route>
                <Redirect to="/" />
              </Route>
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedLayout() {
  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex flex-1 flex-col overflow-hidden">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/children" component={ChildrenList} />
              <Route path="/children/new" component={ChildForm} />
              <Route path="/children/:id/edit" component={ChildForm} />
              <Route path="/children/:id" component={ChildProfile} />
              <Route path="/organizations" component={Organizations} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user && location !== "/") {
      setLocation("/");
    }
  }, [isLoading, user, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-full" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (user.role === "sponsor") {
    return <SponsorLayout />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
