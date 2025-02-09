import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmojiPicker } from "@/components/ui/emoji-picker";

export function EmojiPickerTheme() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emoji Picker Theme</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Default (Auto)</h4>
          <EmojiPicker />
        </div>
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Light</h4>
          <EmojiPicker theme="light" />
        </div>
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Dark</h4>
          <EmojiPicker theme="dark" />
        </div>
      </CardContent>
    </Card>
  );
}
