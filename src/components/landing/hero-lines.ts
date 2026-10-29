const SVG_NS = "http://www.w3.org/2000/svg";
/** Straight stretch before a tile, room kept between the node and the fork, and the gap before a tile. */
const RUN = 20;
const FORK_GAP = 30;
const TILE_GAP = 10;
const MIN_SLOPE_RUN = 24;

/**
 * Draws the hero's route lines like a transit map. Out of the Lajur node runs one straight trunk to each side;
 * stages above and below leave it together at one fork per side, run on a 45 degree slope to their own height,
 * then straight to a dot just before the tile. Positions come from the tiles as they are on screen (they drift
 * while scrolling), so call it again whenever they move. Safe to call repeatedly: paths and dots are created once
 * and then only updated.
 */
export function drawHeroLines(box: HTMLElement) {
  const svg = box.querySelector("svg");
  const [node, ...stages] = Array.from(box.querySelectorAll<HTMLElement>('[data-lm="hero-tile"]'));
  if (!svg || !node) return;

  const b = box.getBoundingClientRect();
  // The anchors have no size: the visible tile is their child.
  const center = (anchor: HTMLElement) => {
    const r = (anchor.firstElementChild ?? anchor).getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top, half: r.width / 2 };
  };
  const n = center(node);
  // A phone's hero is narrow: the fork sits closer to the node so the stages still have room beside it.
  const forkGap = Math.min(FORK_GAP, b.width * 0.05);

  stages.forEach((tile, i) => {
    let path = svg.querySelector<SVGPathElement>(`path[data-route="${i}"]`);
    let dot = svg.querySelector<SVGCircleElement>(`circle[data-route="${i}"]`);
    let pulse = svg.querySelector<SVGPathElement>(`path[data-pulse="${i}"]`);
    if (!path || !dot || !pulse) {
      path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("data-route", String(i));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-opacity", "0.3");
      path.setAttribute("stroke-width", "1.25");
      path.setAttribute("stroke-linejoin", "round");
      path.classList.add("landing-fade");
      dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("data-route", String(i));
      dot.style.fill = "var(--brand)";
      dot.classList.add("landing-fade");
      // A short bright stretch that runs from the stage into the Lajur node (.landing-pulse in globals.css).
      pulse = document.createElementNS(SVG_NS, "path");
      pulse.setAttribute("data-pulse", String(i));
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("pathLength", "1");
      pulse.setAttribute("stroke-linejoin", "round");
      pulse.classList.add("landing-pulse");
      // The lines fade in over 0.5s to 1.3s (.landing-fade); the first dash leaves only once they are all there.
      pulse.style.animationDelay = `${1.4 + i * 0.55}s`;
      svg.append(path, dot, pulse);
    }

    const t = center(tile);
    if (!t.half) {
      // display: none on small screens
      path.removeAttribute("d");
      pulse.removeAttribute("d");
      dot.setAttribute("r", "0");
      return;
    }
    dot.setAttribute("r", "3.5");

    const dir = t.x > n.x ? 1 : -1;
    const endX = t.x - dir * (t.half + TILE_GAP);
    const rise = Math.abs(t.y - n.y);
    let d: string;
    if (rise < 6) {
      d = `M${n.x} ${n.y}H${endX}`;
    } else {
      const forkX = n.x + dir * (n.half + forkGap);
      // The slope is 45 degrees when there is room for it, and steeper when the tile sits close in (never past the dot).
      const avail = Math.max(0, dir * (endX - forkX));
      const room = Math.max(0, avail - RUN);
      const slope = Math.min(rise, Math.max(MIN_SLOPE_RUN, room), avail);
      const slopeEndX = forkX + dir * slope;
      d = `M${n.x} ${n.y}H${forkX}L${slopeEndX} ${t.y}H${endX}`;
    }
    path.setAttribute("d", d);
    pulse.setAttribute("d", d);
    dot.setAttribute("cx", String(endX));
    dot.setAttribute("cy", String(t.y));
  });
}
