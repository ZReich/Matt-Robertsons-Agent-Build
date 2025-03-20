import { CreditCard } from "lucide-react"
import {
  SiAmericanexpress,
  SiDiscover,
  SiMastercard,
  SiVisa,
} from "react-icons/si"

export function CreditCardBrandIcon({ brandName }: { brandName: string }) {
  switch (brandName) {
    case "visa":
      return <SiVisa size={28} className="shrink-0 text-foreground" />
    case "mastercard":
      return <SiMastercard size={28} className="shrink-0 text-foreground" />
    case "amex":
      return (
        <SiAmericanexpress
          size={28}
          className="shrink-0 text-foreground rounded-sm"
        />
      )
    case "discover":
      return <SiDiscover size={28} className="shrink-0 text-foreground" />
    default:
      return (
        <CreditCard className="shrink-0 size-7 stroke-[1.5] text-foreground" />
      )
  }
}
