import { z } from "zod";
import { WIDGET_LABEL_MAX_LENGTH } from "@/lib/widget/limits";

export const createWidgetTokenSchema = z.object({
  label: z.string().trim().min(1).max(WIDGET_LABEL_MAX_LENGTH),
});

export const deleteWidgetTokenSchema = z.object({
  id: z.string().uuid(),
});
