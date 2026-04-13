export function shouldRenderPieLabel(percent, minPercent = 1) {
  return Number(percent) * 100 >= minPercent;
}

export function formatPieLabel({ name, percent }) {
  return `${name} ${(Number(percent) * 100).toFixed(1)}%`;
}

export function buildPieChartData(data = [], options = {}) {
  const { minPercent = 1, otherLabel = '其他' } = options;
  const normalized = Array.isArray(data)
    ? data.filter((item) => Number(item?.value || 0) > 0)
    : [];

  const total = normalized.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!total) {
    return [];
  }

  const major = [];
  let otherValue = 0;

  normalized.forEach((item) => {
    const value = Number(item.value || 0);
    const percent = (value / total) * 100;

    if (percent >= minPercent) {
      major.push({
        name: item.name,
        value,
      });
      return;
    }

    otherValue += value;
  });

  if (otherValue > 0) {
    major.push({
      name: otherLabel,
      value: Number(otherValue.toFixed(4)),
    });
  }

  return major;
}

export function buildPieLegendItems(data = []) {
  const total = (Array.isArray(data) ? data : []).reduce(
    (sum, item) => sum + Number(item?.value || 0),
    0,
  );

  if (!total) {
    return [];
  }

  return data.map((item) => ({
    name: item.name,
    value: Number(item.value || 0),
    percentText: `${((Number(item.value || 0) / total) * 100).toFixed(1)}%`,
  }));
}

export function buildPieLabelAllowList(data = [], options = {}) {
  const { minPercent = 5, maxLabels = 3 } = options;
  const legendItems = buildPieLegendItems(data);

  return new Set(
    legendItems
      .filter((item) => Number.parseFloat(item.percentText) >= minPercent)
      .slice(0, maxLabels)
      .map((item) => item.name),
  );
}
