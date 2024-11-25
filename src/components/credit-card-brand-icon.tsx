import { CreditCard } from "lucide-react";
import {
  SiVisa,
  SiMastercard,
  SiAmericanexpress,
  SiDiscover,
} from "react-icons/si";

export const CreditCardBrandIcon = ({ brandName }: { brandName: string }) => {
  switch (brandName) {
    case "visa":
      return <SiVisa size={28} className="text-foreground" />;
    case "mastercard":
      return <SiMastercard size={28} className="text-foreground" />;
    case "amex":
      return (
        <SiAmericanexpress size={28} className="text-foreground rounded-sm" />
      );
    case "discover":
      return <SiDiscover size={28} className="text-foreground" />;
    default:
      return <CreditCard className="size-7 stroke-[1.5] text-foreground" />;
  }
};
