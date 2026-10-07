"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CategoryPanel, type CategoryPanelTarget } from "@/app/(app)/_components/CategoryPanel";
import { TODO_COLUMN_ICONS } from "./column-icons";
import { createColumn, deleteColumn, renameColumn } from "./actions";

// Single owner of the shared column CategoryPanel: header "Categorie" (create)
// and every column pencil (edit) open it via context. Adapters map the
// panel's `categoryId` shape onto te-doen's `columnId`/`boardId` actions and
// are the only "use server" import site for this flow.
// Decisions: design/notes/TeDoenBoard.md.
interface TeDoenColumnPanelApi {
  openCreate: () => void;
  openEdit: (column: { id: string; name: string; icon: string }) => void;
}

const TeDoenColumnPanelContext = createContext<TeDoenColumnPanelApi | null>(null);

export function useTeDoenColumnPanel(): TeDoenColumnPanelApi {
  const api = useContext(TeDoenColumnPanelContext);
  if (!api) throw new Error("useTeDoenColumnPanel must be used inside TeDoenColumnPanelProvider");
  return api;
}

export function TeDoenColumnPanelProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  // `open`/`target` independent so the close transition keeps its content.
  const [panel, setPanel] = useState<{ open: boolean; target: CategoryPanelTarget }>({
    open: false,
    target: { mode: "create" },
  });

  const api: TeDoenColumnPanelApi = {
    openCreate: () => setPanel({ open: true, target: { mode: "create" } }),
    openEdit: (column) => setPanel({ open: true, target: { mode: "edit", category: column } }),
  };

  return (
    <TeDoenColumnPanelContext.Provider value={api}>
      {children}
      <CategoryPanel
        open={panel.open}
        onClose={() => setPanel((current) => ({ ...current, open: false }))}
        target={panel.target}
        icons={TODO_COLUMN_ICONS}
        translationNamespace="components.todoColumnPanel"
        errorsNamespace="boards.errors"
        onCreateCategory={(input) => createColumn({ ...(input as object), boardId })}
        onUpdateCategory={(input) => {
          const { categoryId, ...rest } = input as { categoryId: string };
          return renameColumn({ ...rest, columnId: categoryId });
        }}
        onDeleteCategory={(input) =>
          deleteColumn({ columnId: (input as { categoryId: string }).categoryId })
        }
        onMutated={() => router.refresh()}
      />
    </TeDoenColumnPanelContext.Provider>
  );
}
