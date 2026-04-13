export const filterExistingTokenIds = (selectedTokenIds = [], tokens = []) => {
  const existingIds = new Set((tokens || []).map((item) => item.id));
  const nextIds = selectedTokenIds.filter((id) => existingIds.has(id));

  if (nextIds.length === selectedTokenIds.length) {
    return selectedTokenIds;
  }

  return nextIds;
};
