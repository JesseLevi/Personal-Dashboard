import { getTranslations } from "next-intl/server";
import { Button } from "@/components/atoms/Button";
import { PageHeader } from "@/components/organisms/PageHeader";
import { getBoardsForUser, getBoardWithColumns } from "@/lib/boards/queries";
import { TeDoenBoard } from "./TeDoenBoard";

// Server Component: fetches data only, hands it to the client wrapper
// (TeDoenBoard) as plain data — BoardView's `renderItem` is a function prop
// and can't itself cross the server/client boundary, so the boundary starts
// as low as it can (see TeDoenBoard.tsx). No board switcher / `[boardId]`
// route yet (#95), so "the active board" is the user's favorite
// (`getBoardsForUser` sorts favorite-first) — documented in
// design/notes/TeDoenBoard.md. `title` stays board data, never an i18n
// key, per design/notes/PageHeader.md; the switcher/star/sort controls stay
// inert placeholders (#95 wires them up).
export default async function TeDoenPage() {
  const t = await getTranslations("components.pageHeader.todo");
  const boards = await getBoardsForUser();
  const board = boards[0] ? await getBoardWithColumns(boards[0].id) : null;

  // Shouldn't happen (the seed trigger guarantees a default board per user),
  // but a signed-in user with zero/deleted boards is a real reachable state
  // — show it, don't crash.
  if (!board) {
    return (
      <>
        <PageHeader title={t("emptyBoardTitle")} />
        <p className="text-base text-text-muted">{t("emptyBoardBody")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={board.name}
        titleAdornments={
          <>
            <Button icon="ChevronDown" aria-label={t("boardSwitcherLabel")} />
            <Button icon="Star" aria-label={t("favoriteLabel")} />
          </>
        }
        actions={<Button icon="ArrowUpDown">{t("sortLabel")}</Button>}
      />
      <TeDoenBoard board={board} />
    </>
  );
}
