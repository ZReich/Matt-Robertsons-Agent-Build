"use client";

import * as React from "react";

import { EmailContext } from "../contexts/email-context";

export function useEmailContext() {
  const context = React.useContext(EmailContext);
  if (context === undefined) {
    throw new Error("useEmailContext must be used within a EmailProvider");
  }
  return context;
}
