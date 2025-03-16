import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { GitHubAccessForm } from "./github-access-form"

export function GitHubAccess() {
  return (
    <section className="flex justify-center items-center p-16 bg-muted/40">
      <Card>
        <CardHeader className="text-center">
          <h1 className="text-xl font-semibold leading-none tracking-tight">
            GitHub Access Request
          </h1>
          <CardDescription className="max-w-prose w-full">
            To gain access to the GitHub repository for the template, please
            fill out the form below. We&apos;ll verify your purchase and grant
            access as soon as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GitHubAccessForm />
        </CardContent>
      </Card>
    </section>
  )
}
