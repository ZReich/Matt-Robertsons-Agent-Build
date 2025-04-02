import { ThemePreviewSignIn } from "./theme-preview-sign-in"

export function ThemePreview() {
  return (
    <div className="col-span-2 h-[30rem] min-w-0 flex flex-col items-stretch gap-4">
      <h3 className="text-xl">Preview</h3>
      <div className="size-full flex justify-center items-center bg-accent border rounded-lg overflow-hidden">
        <ThemePreviewSignIn />
      </div>
    </div>
  )
}
