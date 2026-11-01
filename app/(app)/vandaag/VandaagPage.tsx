"use client";

import { useRouter } from "next/navigation";
import { addDays } from "@/lib/agenda/time";
import { actOnAssistantSignal, dismissAssistantSignal } from "@/lib/assistant/actions";
import { sendWeekToBasket } from "../agenda/meal-actions";
import { VandaagView, type VandaagViewProps } from "./VandaagView";

// Wires the Vandaag view to the router and the server actions (ADR-0053).
export function VandaagPage(props: Omit<VandaagViewProps, "onNavigate" | "onSignal" | "onDayToBasket">) {
  const router = useRouter();
  return (
    <VandaagView
      {...props}
      onNavigate={(href) => router.push(href)}
      onSignal={async (signal, act) => {
        const result = act ? await actOnAssistantSignal(signal.id) : await dismissAssistantSignal(signal.id);
        if (result.success && result.href) router.push(result.href);
        else if (result.success) router.refresh();
      }}
      onDayToBasket={async (listId) => {
        const result = await sendWeekToBasket({ from: props.today, to: addDays(props.today, 1), listId });
        if (result.success) router.refresh();
        return result.success ? { success: true, data: undefined } : { success: false, error: "generic" };
      }}
    />
  );
}
