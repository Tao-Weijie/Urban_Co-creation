export function remap(value: number, min: number, max: number): number {
  if (max === min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}

export function getGradientToWhite(colorHex: string, factor: number): string {
  const clampedFactor = Math.max(0, Math.min(1, factor)); // 限定 factor 在 0-1 之间

  let hex = colorHex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const baseR = parseInt(hex.substring(0, 2), 16);
  const baseG = parseInt(hex.substring(2, 4), 16);
  const baseB = parseInt(hex.substring(4, 6), 16);

  // 渐变到纯白色 (255, 255, 255)
  const r = Math.round(255 * (1 - clampedFactor) + baseR * clampedFactor);
  const g = Math.round(255 * (1 - clampedFactor) + baseG * clampedFactor);
  const b = Math.round(255 * (1 - clampedFactor) + baseB * clampedFactor);

  const rHex = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0');
  const gHex = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0');
  const bHex = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

export function getGradientToBlack(colorHex: string, factor: number): string {
  const clampedFactor = Math.max(0, Math.min(1, factor)); // 限定 factor 在 0-1 之间

  let hex = colorHex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const baseR = parseInt(hex.substring(0, 2), 16);
  const baseG = parseInt(hex.substring(2, 4), 16);
  const baseB = parseInt(hex.substring(4, 6), 16);

  // 渐变到纯黑色 (0, 0, 0)
  const r = Math.round(baseR * clampedFactor);
  const g = Math.round(baseG * clampedFactor);
  const b = Math.round(baseB * clampedFactor);

  const rHex = Math.max(0, Math.min(255, r)).toString(16).padStart(2, '0');
  const gHex = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0');
  const bHex = Math.max(0, Math.min(255, b)).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * 辅助方法：使用鞋带公式计算多边形面积
 */
function calculatePolygonArea(coords: number[][]): number {
  if (!coords || coords.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[(i + 1) % coords.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/**
 * 计算单个 Unit 单元的物理体积 (净面积 * 高度)
 */
export function getUnitVolume(u: any): number {
  const boundary = u.geometry?.boundary ?? u.boundary ?? [];
  const hole = u.geometry?.hole ?? u.holes ?? [];
  const height = u.geometry?.height ?? u.height ?? 0;

  const boundaryArea = calculatePolygonArea(boundary);
  let holesArea = 0;
  if (hole && hole.length > 0) {
    for (const hPoly of hole) {
      holesArea += calculatePolygonArea(hPoly);
    }
  }
  const unitArea = Math.max(0, boundaryArea - holesArea);
  return unitArea * height;
}
