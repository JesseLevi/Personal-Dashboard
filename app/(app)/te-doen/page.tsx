import { TeDoenPageBody } from "./TeDoenPageBody";

// #95: no boardId segment here — TeDoenPageBody/board-data.ts fall back to
// the user's favourite board, same behaviour this route always had (see
// design/notes/TeDoenBoard.md), now shared with the explicit
// `[boardId]` route below it.
export default async function TeDoenPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  return <TeDoenPageBody sortParam={sort} />;
}
