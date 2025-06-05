// ─── astar.ts ───────────────────────────────────────────────────────────

/**
 * A* on a 2D boolean grid.  false=obstacle, true=free.
 * Returns a list of [r,c] steps from start → goal, or [] if no path.
 */
export function astarGrid(
  occupancy: boolean[][],
  start: [number, number],
  goal:  [number, number]
): Array<[number, number]> {
  const nRows = occupancy.length;
  const nCols = occupancy[0].length;

  // 4‐connected moves: (dr,dc) and their cost = 1.0
  const neighbors: Array<[number, number]> = [
    [-1,  0],
    [ 1,  0],
    [ 0, -1],
    [ 0,  1]
  ];

  // Heuristic: Manhattan distance in meters (since grid step=1)
  function heuristic(a: [number, number], b: [number, number]): number {
    return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]);
  }

  // Keyed priority queue using a simple binary‐heap (min‐heap)
  class MinHeap<T> {
    data: Array<{ key: number, value: T }> = [];
    size() { return this.data.length; }
    push(key: number, value: T) {
      this.data.push({key,value});
      let i = this.data.length - 1;
      while (i > 0) {
        const parent = Math.floor((i-1)/2);
        if (this.data[parent].key <= this.data[i].key) break;
        [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
        i = parent;
      }
    }
    pop(): { key: number, value: T } | undefined {
      if (!this.data.length) return undefined;
      const ret = this.data[0];
      const last = this.data.pop()!;
      if (this.data.length > 0) {
        this.data[0] = last;
        let i = 0;
        while (true) {
          let left = 2*i + 1, right = 2*i + 2, smallest = i;
          if (left < this.data.length && this.data[left].key < this.data[smallest].key) {
            smallest = left;
          }
          if (right < this.data.length && this.data[right].key < this.data[smallest].key) {
            smallest = right;
          }
          if (smallest === i) break;
          [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
          i = smallest;
        }
      }
      return ret;
    }
  }

  // A* data structures
  const openSet = new MinHeap<[number, number]>();
  const gScore: number[][] = Array.from({ length: nRows }, () => Array(nCols).fill(Infinity));
  const fScore: number[][] = Array.from({ length: nRows }, () => Array(nCols).fill(Infinity));
  const cameFrom: Array<Array<[number, number] | null>> =
    Array.from({ length: nRows }, () => Array(nCols).fill(null));

  const [sr, sc] = start,
        [gr, gc] = goal;

  // If start or goal is blocked, return no solution
  if (
    sr < 0 || sr >= nRows || sc < 0 || sc >= nCols ||
    gr < 0 || gr >= nRows || gc < 0 || gc >= nCols ||
    !occupancy[sr][sc] || !occupancy[gr][gc]
  ) {
    return [];
  }

  gScore[sr][sc] = 0;
  fScore[sr][sc] = heuristic(start, goal);
  openSet.push(fScore[sr][sc], [sr, sc]);

  const visited = new Set<string>();

  while (openSet.size() > 0) {
    const popped = openSet.pop();
    if (!popped) break;
    const [r, c] = popped.value;

    // If we reached the goal, reconstruct path
    if (r === gr && c === gc) {
      const path: Array<[number, number]> = [];
      let cur: [number, number] | null = [r, c];
      while (cur) {
        path.push(cur);
        const [cr, cc] = cur;
        cur = cameFrom[cr]?.[cc] as [number, number] | null;
      }
      return path.reverse();
    }

    visited.add(`${r},${c}`);

    // Examine each neighbor
    for (const [dr, dc] of neighbors) {
      const nr = r + dr, nc = c + dc;
      // Bounds + blocked check
      if (
        nr < 0 || nr >= nRows || nc < 0 || nc >= nCols ||
        !occupancy[nr][nc]
      ) {
        continue;
      }
      // Tentative g score
      const tentativeG = gScore[r][c] + 1; // cost=1 per move
      if (tentativeG < gScore[nr][nc]) {
        cameFrom[nr][nc] = [r, c];
        gScore[nr][nc] = tentativeG;
        fScore[nr][nc] = tentativeG + heuristic([nr, nc], [gr, gc]);
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          openSet.push(fScore[nr][nc], [nr, nc]);
        }
      }
    }
  }

  // No path found
  return [];
}
