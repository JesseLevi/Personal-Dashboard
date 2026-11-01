// @vitest-environment jsdom
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), listeners: new Set<() => void>() }));
vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    useRouter: () => ({ replace: nav.replace }),
    usePathname: () => "/agenda",
    useSearchParams: () => {
      const [, force] = React.useReducer((n: number) => n + 1, 0);
      React.useEffect(() => {
        nav.listeners.add(force as () => void);
        return () => void nav.listeners.delete(force as () => void);
      }, []);
      return new URLSearchParams(nav.search);
    },
  };
});

import { useNewParam } from "@/lib/dom/use-new-param";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setSearch(search: string) {
  nav.search = search;
  act(() => nav.listeners.forEach((l) => l()));
}

describe("useNewParam", () => {
  it("fires once under strict mode, again on a soft navigation, and strips the param", () => {
    const onNew = vi.fn();
    function Probe() {
      useNewParam(onNew);
      return null;
    }
    nav.search = "date=2026-11-01&nieuw=1";
    const root = createRoot(document.createElement("div"));
    act(() => root.render(createElement(StrictMode, null, createElement(Probe))));
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith("/agenda?date=2026-11-01", { scroll: false });

    setSearch("date=2026-11-01"); // replace landed
    expect(onNew).toHaveBeenCalledTimes(1);

    setSearch("date=2026-11-01&nieuw=1"); // soft navigation while mounted
    expect(onNew).toHaveBeenCalledTimes(2);
    expect(nav.replace).toHaveBeenCalledTimes(2);

    setSearch("date=2026-11-01&nieuw=1&x=1"); // re-render with param still present
    expect(onNew).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });
});
