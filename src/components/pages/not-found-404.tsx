import Link from "next/link";
import { Frown } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotFound404() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center text-center text-foreground bg-background p-4">
      <Frown size={120} className="text-primary mb-8" />
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-3xl font-semibold mb-6">Page Not Found</h2>
      <p className="text-xl text-muted-foreground mb-8">
        We couldn&apos;t find the page you&apos;re looking for. It might have
        been moved or doesn&apos;t exist.
      </p>
      <Button size="lg" asChild>
        <Link href="/">Home Page</Link>
      </Button>
    </div>
  );
}
