import type { Editor } from "@tiptap/react";

// #331: the editor, the EditingBar link button and the bubble menu share one
// LinkPopover (components/organisms/LinkPopover.tsx). They ask for it through
// a DOM event on the editor's own element, so none of them needs to know where
// the popover is mounted.
export const OPEN_LINK_POPOVER_EVENT = "note-link-popover:open";

export interface OpenLinkPopoverDetail {
  /** Element the popover anchors to; `null` anchors it to the selection. */
  anchor: HTMLElement | null;
}

export function requestLinkPopover(editor: Editor, anchor: HTMLElement | null = null) {
  editor.view.dom.dispatchEvent(
    new CustomEvent<OpenLinkPopoverDetail>(OPEN_LINK_POPOVER_EVENT, { detail: { anchor } }),
  );
}
