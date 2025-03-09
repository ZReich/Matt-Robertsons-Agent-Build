import { PreviewSignIn } from "./preview-sign-in"
import { ThemePreviewWrapper } from "./theme-preview-wrapper"

export function ThemePreview() {
  return (
    <div className="col-span-2 h-[30rem] min-w-0 flex flex-col items-stretch gap-4">
      <h3 className="text-xl">Preview</h3>
      <ThemePreviewWrapper>
        <PreviewSignIn />
      </ThemePreviewWrapper>
    </div>
  )
}
