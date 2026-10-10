// #336: the Details node view renders a plain DOM toggle button outside React,
// and the static extension whitelist has no access to next-intl. The editor
// page sets the translated labels here before it creates the editor.
let labels = { open: "", close: "" };

export function setDetailsToggleLabels(next: { open: string; close: string }): void {
  labels = next;
}

export function detailsToggleLabel(isOpen: boolean): string {
  return isOpen ? labels.close : labels.open;
}
