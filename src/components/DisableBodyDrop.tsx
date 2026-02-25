"use client";

import { useEffect } from "react";

/**
 * Prevents the browser from navigating away when a file is dropped outside
 * a designated upload zone. Only intercepts external file drops (not internal
 * drag-and-drop reordering operations).
 */
export default function DisableBodyDrop() {
  useEffect(() => {
    function prevent(e: DragEvent) {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
      }
    }
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  return null;
}
