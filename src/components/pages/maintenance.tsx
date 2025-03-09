"use client"

import { useRouter } from "next/navigation"
import { Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Maintenance() {
  const router = useRouter()

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center text-center text-foreground bg-background p-4">
      <Wrench size={120} className="text-primary mb-8" />
      <h1 className="text-6xl font-bold mb-4">Under Maintenance</h1>
      <h2 className="text-3xl font-semibold mb-6">We&apos;ll be back soon!</h2>
      <p className="text-xl text-muted-foreground mb-8">
        We&apos;re currently performing some scheduled maintenance. We&apos;ll
        be back up shortly. Thank you for your patience!
      </p>
      <Button size="lg" onClick={() => router.refresh()}>
        Refresh Page
      </Button>
    </div>
  )
}
