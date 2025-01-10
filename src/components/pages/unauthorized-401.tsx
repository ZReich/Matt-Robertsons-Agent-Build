import Link from "next/link";
import { Lock } from "lucide-react";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/types";

import { Button } from "@/components/ui/button";

export function Unauthorized401({ locale }: { locale: LocaleType }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center text-center text-foreground bg-gradient-to-b from-primary/15 to-background p-4">
      <Lock size={120} className="text-primary mb-8 animate-rotate-slight" />
      <h1 className="text-6xl font-bold mb-4">401</h1>
      <h2 className="text-3xl font-semibold mb-6">Unauthorized Access</h2>
      <p className="text-xl text-muted-foreground mb-8">
        You don&apos;t have permission to access this page. If you&apos;re
        logged in, check your access or contact support.
      </p>
      <div className="space-x-4">
        <Button size="lg" asChild>
          <Link href={ensureLocalizedPathname("/sign-in", locale)}>
            Sign In
          </Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
