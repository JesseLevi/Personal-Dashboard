import { TeDoenPageBody } from "../TeDoenPageBody";

// #95: the board switcher's explicit, shareable/bookmarkable URL (ticket's
// own requirement — board choice belongs in the URL, not client state). An
// id that doesn't resolve to one of the signed-in user's boards falls back
// to the favourite (board-data.ts), same as visiting `/te-doen` with none at
// all — see design/notes/TeDoenBoard.md.
export default async function TeDoenBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { boardId } = await params;
  const { sort } = await searchParams;
  return <TeDoenPageBody boardId={boardId} sortParam={sort} />;
}
