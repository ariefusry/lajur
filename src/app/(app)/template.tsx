/**
 * A short enter animation when moving to another section (Dashboard → Kalender, board → detail). Enter only, so
 * a navigation never waits on the old page; switching board/list or detail tabs stays inside one segment and
 * doesn't replay it. Opacity + `translate`, with nothing left behind once it ends: a leftover transform would
 * throw off dnd-kit's drag position on the board.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="motion-safe:animate-[page-in_180ms_ease-out]">{children}</div>;
}
