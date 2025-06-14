/**
 * Dijkstra’s algorithm on a 2D boolean grid (false = blocked, true = free).
 * Returns a list of [row, col] pairs from `start` → `goal`, or an empty array if no path.
 *
 *   - `occupancy[r][c] === false` is treated as an obstacle.
 *   - Movement is 4-connected (up/down/left/right), cost = 1 per move.
 *   - Since all moves cost 1, Dijkstra is equivalent to BFS on an unweighted grid.
 */
export function dijkstraGrid(
  occupancy: boolean[][],
  start: [number, number],
  goal:  [number, number]
): Array<[number, number]> {
  const nRows = occupancy.length;
  const nCols = (nRows > 0 ? occupancy[0].length : 0);

  // 4-connected neighbor offsets
  const neighbors: Array<[number, number]> = [
    [-1,  0],
    [ 1,  0],
    [ 0, -1],
    [ 0,  1]
  ];

  const [sr, sc] = start;
  const [gr, gc] = goal;

  // Quick check: if start or goal is out of bounds or blocked, no path
  if (
    sr < 0 || sr >= nRows || sc < 0 || sc >= nCols ||
    gr < 0 || gr >= nRows || gc < 0 || gc >= nCols ||
    !occupancy[sr][sc] || !occupancy[gr][gc]
  ) {
    return [];
  }

  // Keep track of visited cells
  const visited = Array.from({ length: nRows }, () => Array(nCols).fill(false));
  // For every cell, store “cameFrom” so we can reconstruct the path
  const cameFrom: Array<Array<[number, number] | null>> =
    Array.from({ length: nRows }, () => Array(nCols).fill(null));

  // We can implement Dijkstra on an unweighted grid exactly like a breadth‐first search (BFS).
  // Use a queue of (r, c) pairs:
  const queue: Array<[number, number]> = [];
  queue.push([sr, sc]);
  visited[sr][sc] = true;

  // Standard BFS loop
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;

    // If we reached the goal, reconstruct the path
    if (r === gr && c === gc) {
      const path: Array<[number, number]> = [];
      let cur: [number, number] | null = [r, c];
      while (cur) {
        path.push(cur);
        const [cr, cc]: [number, number] = cur;
        cur = cameFrom[cr][cc];
      }
      return path.reverse();
    }

    // Otherwise, visit all 4 neighbors
    for (const [dr, dc] of neighbors) {
      const nr = r + dr;
      const nc = c + dc;

      // Skip out‐of‐bounds or already visited or blocked
      if (
        nr < 0 || nr >= nRows || nc < 0 || nc >= nCols ||
        visited[nr][nc] || !occupancy[nr][nc]
      ) {
        continue;
      }

      visited[nr][nc] = true;
      cameFrom[nr][nc] = [r, c];
      queue.push([nr, nc]);
    }
  }

  // No path found
  return [];
}
