import { describe, expect, it } from "vitest";
import {
  DELETE_CONFIRM_INITIAL,
  deleteConfirmReducer,
} from "@/lib/dom/delete-confirm";

describe("deleteConfirmReducer", () => {
  it("starts idle", () => {
    expect(DELETE_CONFIRM_INITIAL.confirming).toBe(false);
  });

  it("first click asks for confirmation", () => {
    expect(deleteConfirmReducer(DELETE_CONFIRM_INITIAL, "ask").confirming).toBe(true);
  });

  it("cancel returns to idle", () => {
    const asked = deleteConfirmReducer(DELETE_CONFIRM_INITIAL, "ask");
    expect(deleteConfirmReducer(asked, "cancel").confirming).toBe(false);
  });

  it("is idempotent and keeps state identity when nothing changes", () => {
    const asked = deleteConfirmReducer(DELETE_CONFIRM_INITIAL, "ask");
    expect(deleteConfirmReducer(asked, "ask")).toBe(asked);
    expect(deleteConfirmReducer(DELETE_CONFIRM_INITIAL, "cancel")).toBe(DELETE_CONFIRM_INITIAL);
  });
});
