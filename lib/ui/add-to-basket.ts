import type { ActionResult } from "@/lib/shopping/types";

// #290: the single rule behind AnimatedAddToBasketButton's success face --
// it plays only when the awaited action resolved with `success: true`. A
// failed or thrown action leaves the button at rest (failure display is
// undesigned: docs/open-questions.md#winkelmand-send-no-success-feedback).
export async function playsAddedFace(action: () => Promise<ActionResult>): Promise<boolean> {
  try {
    return (await action()).success;
  } catch {
    return false;
  }
}
