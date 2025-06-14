export async function buildOccupancyGrid(
  pngUrl:    string,
  x0_px:     number,
  y0_px:     number,
  xEnd_px:   number,
  yEnd_px:   number,
  pixPerM:   number,
  gridStep:  number
): Promise<boolean[][]> {

  return new Promise<boolean[][]>((resolve, reject) => {
    const img = new Image();
    img.src = pngUrl;
    img.crossOrigin = 'anonymous'; 
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      console.log(
        'buildOccupancyGrid: image is', w, '×', h,
        'px; x0_px,y0_px =', x0_px, y0_px,
        'xEnd_px,yEnd_px =', xEnd_px, yEnd_px,
        'pixPerM =', pixPerM.toFixed(2),
        'gridStep =', gridStep
      );

      // 1) Draw onto a hidden canvas
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // 2) How many meters across & up?
      const widthMeters  = (xEnd_px - x0_px) / pixPerM;
      const heightMeters = (y0_px - yEnd_px) / pixPerM;
      const nCols = Math.ceil(widthMeters  / gridStep) + 1;
      const nRows = Math.ceil(heightMeters / gridStep) + 1;
      console.log(`grid dims: ${nRows} rows × ${nCols} cols`);

      // 3) Initialize occupancy[ row ][ col ]
      const occupancy: boolean[][] = [];
      for (let r = 0; r < nRows; r++) {
        occupancy.push(new Array(nCols).fill(true));
      }

      // 4) Sample each “1 m × 1 m” center
      for (let r = 0; r < nRows; r++) {
        const y_m   = r * gridStep;              // meters up from bottom
        const pxY   = y0_px - y_m * pixPerM;     // Canvas y‐coordinate
        for (let c = 0; c < nCols; c++) {
          const x_m   = c * gridStep;            // meters right from left
          const pxX   = x0_px + x_m * pixPerM;   // Canvas x‐coordinate
          const sampleX = Math.round(pxX);
          const sampleY = Math.round(pxY);

          // Out of bounds → BLOCKED
          if (
            sampleX < 0  || sampleX >= w ||
            sampleY < 0  || sampleY >= h
          ) {
            occupancy[r][c] = false;
            console.warn(`Cell r=${r},c=${c} out‐of‐bounds at px (${sampleX},${sampleY})`);
            continue;
          }

          // Read one pixel RGBA
          const pix = ctx.getImageData(sampleX, sampleY, 1, 1).data;
          // If “near black,” treat as obstacle
          if (pix[0] < 50 && pix[1] < 50 && pix[2] < 50) {
            occupancy[r][c] = false;
            // console.log(`Cell r=${r},c=${c} is WALL at rgba=(${pix[0]},${pix[1]},${pix[2]})`);
          }
          else {
            occupancy[r][c] = true;
          }
        }
      }

      resolve(occupancy);
    };

    img.onerror = (err) => {
      reject(`Could not load floorplan PNG “${pngUrl}”: ${err}`);
    };
  });
}
