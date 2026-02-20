import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Shield, FileText, Clock, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Child Profiles",
    description: "Comprehensive records for every child in your program with status tracking, enrollment data, and sponsor assignments.",
  },
  {
    icon: FileText,
    title: "Document Management",
    description: "Upload and organize report cards, attendance records, case notes, and progress photos all in one secure location.",
  },
  {
    icon: Clock,
    title: "Progress Timeline",
    description: "Track milestones, follow-ups, and key events chronologically to visualize each child's journey over time.",
  },
  {
    icon: Shield,
    title: "Secure Access",
    description: "Role-based access ensures case workers and admins have the right level of control over sensitive records.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold" data-testid="text-landing-logo">CareTrack</span>
          </div>
          <Button asChild data-testid="button-landing-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Secure Case Management</span>
            </div>
            <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" data-testid="text-landing-headline">
              Every child's story,{" "}
              <span className="text-primary">carefully documented</span>
            </h1>
            <p className="mb-10 text-lg text-muted-foreground sm:text-xl">
              A secure internal records portal for nonprofit organizations to store documents, track progress, and manage child sponsorship records over time.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild data-testid="button-landing-get-started">
                <a href="/api/login">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>Encrypted & Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>Full Document Trail</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>Progress Tracking</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 font-serif text-3xl font-bold" data-testid="text-features-heading">Built for case workers</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Everything you need to manage child records, upload documents, and track progress milestones in one place.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6 hover-elevate">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold" data-testid={`text-feature-${feature.title.toLowerCase().replace(/\s/g, "-")}`}>
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">CareTrack Records Portal</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} CareTrack. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
