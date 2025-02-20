import { Footer } from "./footer";
import { Header } from "./header";

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grow">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
