import { describe, expect, test } from 'bun:test';
import {
  getModelModalities,
  getModelEndpointDetails,
} from './models-explorer-data';

describe('models-explorer-data', () => {
  test('prefers backend supported_endpoint_types when deriving modalities', () => {
    const modalities = getModelModalities({
      model_name: 'gpt-image-1',
      supported_endpoint_types: ['image-generation', 'embeddings'],
    });

    expect(modalities.has('image')).toBe(true);
    expect(modalities.has('embeddings')).toBe(true);
    expect(modalities.has('text')).toBe(false);
  });

  test('falls back to text heuristics when endpoint types are unavailable', () => {
    const modalities = getModelModalities({
      model_name: 'gpt-4.1',
      description: 'chat model',
    });

    expect(modalities.has('text')).toBe(true);
  });

  test('builds endpoint details from backend endpoint map and replaces model placeholders', () => {
    const details = getModelEndpointDetails(
      {
        model_name: 'gemini-2.5-pro',
        supported_endpoint_types: ['gemini', 'openai-response'],
      },
      {
        gemini: {
          path: '/v1beta/models/{model}:generateContent',
          method: 'POST',
        },
        'openai-response': {
          path: '/v1/responses',
          method: 'POST',
        },
      },
    );

    expect(details).toEqual([
      {
        endpoint: 'gemini',
        path: '/v1beta/models/gemini-2.5-pro:generateContent',
        method: 'POST',
      },
      {
        endpoint: 'openai-response',
        path: '/v1/responses',
        method: 'POST',
      },
    ]);
  });
});
