export function buildApiEndpointKey(url, route, index) {
  return `${route}-${url}-${index}`;
}

export function normalizeApiEndpoint(item, index) {
  const url = item?.url || item?.api_url || item?.endpoint || item;

  if (!url) {
    return null;
  }

  const route = item?.route || `Endpoint ${index + 1}`;
  const description = item?.description || '';

  return {
    key: buildApiEndpointKey(url, route, index),
    url,
    route,
    description,
  };
}
