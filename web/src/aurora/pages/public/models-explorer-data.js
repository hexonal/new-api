const TEXT_ENDPOINT_TYPES = new Set([
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
]);

const MODALITY_ENDPOINT_TYPES = {
  embeddings: 'embeddings',
  rerank: 'jina-rerank',
  image: 'image-generation',
  video: 'openai-video',
};

const buildModelHaystack = (model) =>
  [
    model?.model_name || '',
    model?.description || '',
    model?.tags || '',
    ...(Array.isArray(model?.supported_endpoint_types)
      ? model.supported_endpoint_types
      : []),
  ]
    .join(' ')
    .toLowerCase();

export const getModelModalities = (model) => {
  const haystack = buildModelHaystack(model);
  const endpointTypes = Array.isArray(model?.supported_endpoint_types)
    ? model.supported_endpoint_types.map((item) => String(item || '').trim())
    : [];
  const set = new Set();

  endpointTypes.forEach((endpointType) => {
    if (endpointType === MODALITY_ENDPOINT_TYPES.embeddings) {
      set.add('embeddings');
    }
    if (endpointType === MODALITY_ENDPOINT_TYPES.rerank) {
      set.add('rerank');
    }
    if (endpointType === MODALITY_ENDPOINT_TYPES.image) {
      set.add('image');
    }
    if (endpointType === MODALITY_ENDPOINT_TYPES.video) {
      set.add('video');
    }
    if (TEXT_ENDPOINT_TYPES.has(endpointType)) {
      set.add('text');
    }
  });

  if (
    haystack.includes('image') ||
    haystack.includes('vision') ||
    haystack.includes('midjourney') ||
    haystack.includes('dall') ||
    haystack.includes('flux') ||
    haystack.includes('seedream')
  ) {
    set.add('image');
  }

  if (
    haystack.includes('video') ||
    haystack.includes('sora') ||
    haystack.includes('kling') ||
    haystack.includes('vidu') ||
    haystack.includes('pixverse') ||
    haystack.includes('cogvideo')
  ) {
    set.add('video');
  }

  if (
    haystack.includes('audio') ||
    haystack.includes('speech') ||
    haystack.includes('voice') ||
    haystack.includes('whisper') ||
    haystack.includes('tts')
  ) {
    set.add('audio');
  }

  if (
    endpointTypes.length === 0 &&
    (set.size === 0 ||
      haystack.includes('chat') ||
      haystack.includes('text') ||
      haystack.includes('completion'))
  ) {
    set.add('text');
  }

  return set;
};

export const getModelSeries = (model) => {
  const text =
    `${model?.model_name || ''} ${model?.description || ''}`.toLowerCase();

  if (text.includes('gpt')) return 'GPT';
  if (text.includes('claude')) return 'Claude';
  if (text.includes('gemini')) return 'Gemini';
  if (text.includes('seed')) return 'Seed';
  if (text.includes('kling')) return 'Kling';
  if (text.includes('vidu')) return 'Vidu';

  return null;
};

export const getModelEndpointDetails = (model, endpointMap = {}) => {
  const modelName = model?.model_name || model?.modelName || '';
  const endpointTypes = Array.isArray(model?.supported_endpoint_types)
    ? model.supported_endpoint_types.filter(Boolean)
    : [];

  return endpointTypes.map((endpoint) => {
    const info = endpointMap[endpoint] || {};
    const rawPath = String(info.path || '');
    return {
      endpoint,
      path: rawPath.includes('{model}')
        ? rawPath.replaceAll('{model}', modelName)
        : rawPath,
      method: info.method || 'POST',
    };
  });
};
