import * as React from "react";

import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/dynamic-icon";

declare global {
  interface Document {
    webkitExitFullscreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
  }
}

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    const element = document.documentElement;

    if (!isFullscreen) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        // For Safari
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        // For IE/Edge
        element.msRequestFullscreen();
      } else {
        alert("Fullscreen mode is not supported in this browser.");
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        // For Safari
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        // For IE/Edge
        document.msExitFullscreen();
      }
    }
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(
      !!document.fullscreenElement ||
        !!document.webkitFullscreenElement ||
        !!document.msFullscreenElement
    );
  };

  React.useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  return (
    <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
      <DynamicIcon
        name={isFullscreen ? "Shrink" : "Expand"}
        className="size-4"
      />
    </Button>
  );
}
