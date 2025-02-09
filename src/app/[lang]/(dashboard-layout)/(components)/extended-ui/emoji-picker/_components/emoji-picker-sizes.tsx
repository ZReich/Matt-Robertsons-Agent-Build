import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmojiPicker } from "@/components/ui/emoji-picker";

export function EmojiPickerSizes() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emoji Picker Sizes</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Default</h4>
          <EmojiPicker />
        </div>
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Small</h4>
          <EmojiPicker emojiSize={12} emojiButtonSize={24} />
        </div>
        <div className="flex flex-col items-center space-y-1.5">
          <h4>Large</h4>
          <EmojiPicker emojiSize={24} />
        </div>
      </CardContent>
    </Card>
  );
}
