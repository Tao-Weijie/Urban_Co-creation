/**
 * components/global.ts
 * 存放整个网页组件通用的全局辅助类、计算类或配置转换函数
 */

/**
 * 将 Hex 格式 (#RRGGBB) 或 RGB 格式 (rgb(r, g, b)) 颜色字符串自适应转换为带有指定透明度的 RGBA 字符串。
 * @param colorStr 颜色字符串（如 '#ec4899' 或 'rgb(236, 72, 153)'）
 * @param alpha 透明度值 (0 ~ 1)
 */
export function hexToRgba(colorStr: string, alpha: number): string {
  if (!colorStr) return `rgba(255, 255, 255, ${alpha})`;
  
  // 自适应处理：如果已经是 rgb / rgba 格式，则直接通过字符串处理附加透明度
  if (colorStr.startsWith('rgb')) {
    return colorStr.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  
  // 处理 HEX 格式
  const cleanHex = colorStr.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
