import { SiGithub } from "react-icons/si"

import { buttonVariants } from "@/components/ui/button"

export function ReadyToBuild() {
  return (
    <section
      id="ready-to-build"
      style={{
        boxShadow:
          "rgba(50, 50, 93, 0.25) 0px 30px 60px -12px inset, rgba(0, 0, 0, 0.3) 0px 18px 36px -18px inset",
        background:
          "linear-gradient(90deg, var(--color-chart-1) 0%, var(--color-chart-2) 50%, var(--color-chart-3) 100%)",
      }}
      className="text-background"
    >
      <div className="container flex flex-col justify-center items-center gap-3 text-center px-4 py-13">
        <div>
          <h1 className="text-3xl font-semibold">
            Ready to build your next project faster?
          </h1>
          <p className="max-w-prose text-sm text-muted">
            Get started with our free, open-source admin dashboard template — no
            signup required.
          </p>
        </div>
        <a
          href="https://github.com/Qualiora/shadboard"
          className={buttonVariants({ variant: "secondary", size: "lg" })}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SiGithub className="me-2 h-4 w-4" />
          View on GitHub
        </a>
      </div>
    </section>
  )
}
