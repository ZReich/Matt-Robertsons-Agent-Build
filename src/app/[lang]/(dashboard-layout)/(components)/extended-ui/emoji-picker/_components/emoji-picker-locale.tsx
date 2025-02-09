import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmojiPicker } from "@/components/ui/emoji-picker";

export function EmojiPickerLocale() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emoji Picker Locale</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Default (English)</h4>
          <EmojiPicker />
        </div>
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Arabic</h4>
          <EmojiPicker locale="ar" />
        </div>
      </CardContent>
    </Card>
  );
}
