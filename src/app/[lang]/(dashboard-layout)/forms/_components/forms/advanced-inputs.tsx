"use client";

import * as React from "react";
import { Heart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { InputPhone } from "@/components/ui/input-phone";
import { InputSpin } from "@/components/ui/input-spin";
import { Ratings } from "@/components/ui/ratings";
import { Editor } from "@/components/editor";

export function AdvancedInputs() {
  const [phoneNumbar, setPhoneNumbar] = React.useState("");
  const [spinValue, setSpinValue] = React.useState(5);
  const [ratingsValue, setRatingsValue] = React.useState(4.5);
  const [editorValue, setEditorValue] = React.useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced Inputs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="otpInput">OTP Input</Label>
          <InputOTP id="otpInput" maxLength={6}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phoneInput">Phone Input</Label>
          <InputPhone
            id="phoneInput"
            placeholder="Enter a phone number"
            value={phoneNumbar}
            onChange={setPhoneNumbar}
            defaultCountry="US"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Spin Input</Label>
          <InputSpin
            min={0}
            max={10}
            value={spinValue}
            onChange={setSpinValue}
          />
          <InputSpin
            buttonVariant="secondary"
            min={0}
            max={10}
            value={spinValue}
            onChange={setSpinValue}
          />
          <InputSpin
            buttonVariant="ghost"
            min={0}
            max={10}
            value={spinValue}
            onChange={setSpinValue}
          />
          <InputSpin
            buttonVariant="destructive"
            min={0}
            max={10}
            value={spinValue}
            onChange={setSpinValue}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Rating Input</Label>
          <Ratings value={ratingsValue} onValueChange={setRatingsValue} />
          <Ratings
            variant="yellow"
            value={ratingsValue}
            onValueChange={setRatingsValue}
          />
          <Ratings
            variant="destructive"
            value={ratingsValue}
            onValueChange={setRatingsValue}
          />
          <Ratings
            totalStars={6}
            value={ratingsValue}
            onValueChange={setRatingsValue}
          />
          <Ratings
            size={15}
            value={ratingsValue}
            onValueChange={setRatingsValue}
          />

          <Ratings
            Icon={<Heart />}
            variant="destructive"
            value={ratingsValue}
            onValueChange={setRatingsValue}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Editor</Label>
          <Editor
            value={editorValue}
            onValueChange={setEditorValue}
            placeholder="Write your message here..."
            className="h-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Editor with Bubble Menu</Label>
          <Editor
            value={editorValue}
            onValueChange={setEditorValue}
            placeholder="Write your message here..."
            className="h-40"
            bubbleMenu
          />
        </div>
      </CardContent>
    </Card>
  );
}
