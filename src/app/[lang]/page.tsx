import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="w-full h-[3000px]">
      <Button>Click me</Button>
      <span className="text-primary">PRIMARY</span>
      <span className="text-primary-foreground">PRIMARY-FOREGROUND</span>
    </div>
  );
}
