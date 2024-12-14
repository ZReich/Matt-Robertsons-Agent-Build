import { ComingSoonForm } from "./coming-soon-form";
import { SocialMediaLinks } from "@/components/social-media-links";
import { CountdownTimer } from "./countdown-timer";

export function ComingSoon({ targetDate }: { targetDate: Date }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center text-foreground bg-gradient-to-b from-primary/15 to-background p-4">
      <h1 className="text-6xl text-primary font-bold mb-4">Coming Soon</h1>
      <p className="text-xl text-muted-foreground mb-8">
        We&apos;re working hard to bring you something amazing. Stay tuned!
      </p>
      <CountdownTimer targetDate={targetDate} />
      <ComingSoonForm />
      <SocialMediaLinks />
    </div>
  );
}
