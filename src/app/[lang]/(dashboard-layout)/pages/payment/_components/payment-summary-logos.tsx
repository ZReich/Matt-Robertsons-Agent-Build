import Image from "next/image"

const paymentLogos = [
  {
    src: "/images/logos/paypal.svg",
    alt: "Paypal logo",
    width: 96,
    height: 96,
  },
  { src: "/images/logos/visa.svg", alt: "Visa logo", width: 72, height: 72 },
  {
    src: "/images/logos/mastercard.svg",
    alt: "Mastercard logo",
    width: 48,
    height: 48,
  },
]

export function PaymentSummaryLogos() {
  return (
    <div className="mt-6 flex justify-center items-center gap-8">
      {paymentLogos.map((logo) => (
        <Image
          key={logo.alt}
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
        />
      ))}
    </div>
  )
}
