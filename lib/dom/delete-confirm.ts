// Two-step delete confirmation state machine (#288): first click "asks",
// the second (the confirm button) deletes, "cancel" returns to idle. Pure so
// it is unit-testable without a DOM; the React wrapper is
// app/(app)/_components/DeleteConfirm.tsx.

export type DeleteConfirmState = { confirming: boolean };
export type DeleteConfirmAction = "ask" | "cancel";

export const DELETE_CONFIRM_INITIAL: DeleteConfirmState = { confirming: false };

export function deleteConfirmReducer(
  state: DeleteConfirmState,
  action: DeleteConfirmAction,
): DeleteConfirmState {
  const confirming = action === "ask";
  return state.confirming === confirming ? state : { confirming };
}
