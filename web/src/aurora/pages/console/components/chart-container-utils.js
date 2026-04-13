export const hasRenderableChartSize = ({ width = 0, height = 0 } = {}) =>
  Number(width) > 0 && Number(height) > 0;

export const normalizeChartContainerRect = (rect = {}) => {
  const width = Math.max(0, Math.floor(Number(rect.width) || 0));
  const height = Math.max(0, Math.floor(Number(rect.height) || 0));

  return {
    width,
    height,
    ready: hasRenderableChartSize({ width, height }),
  };
};
