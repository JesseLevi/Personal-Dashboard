"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { SaveController } from "@/lib/notes/save-controller";
import { updateNoteContent } from "../actions";

// Autosave debounce: coalesces a typing burst into one write. Rationale in
// design/notes/NoteEditor.md.
const AUTOSAVE_DEBOUNCE_MS = 1000;

// Wires SaveController to the real `updateNoteContent` result (#334): status
// is never optimistic, and the tab warns while a save is pending or failed.
export function useNoteSave(noteId: string, initialVersion: number | null) {
  const router = useRouter();
  const ref = useRef<SaveController | null>(null);
  if (!ref.current) {
    ref.current = new SaveController(
      async (content, expectedVersion) => {
        const result = await updateNoteContent({ noteId, content, expectedVersion });
        return result.success
          ? { success: true, version: result.data.version }
          : { success: false, conflict: result.error === "conflict" };
      },
      AUTOSAVE_DEBOUNCE_MS,
      initialVersion,
    );
  }
  const controller = ref.current;
  const status = useSyncExternalStore(controller.subscribe, controller.getStatus, () => "saved" as const);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") controller.flush();
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (controller.getStatus() === "saved") return;
      controller.flush();
      event.preventDefault();
      event.returnValue = "";
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      controller.flush();
      // Autosaves do not revalidate (see updateNoteContent). Once the editor
      // closes, one refresh drops the router cache so /notities, also when
      // reached with the browser's back button, shows the new title.
      void controller.settled().then(() => {
        if (controller.hasSaved()) router.refresh();
      });
    };
  }, [controller, router]);

  return {
    status,
    change: (content: unknown) => controller.change(content),
    retry: () => controller.retry(),
    discard: () => controller.discard(),
    /** Conflict exit: drop the local copy and load the server version. */
    reload: () => {
      controller.discard();
      window.location.reload();
    },
  };
}
