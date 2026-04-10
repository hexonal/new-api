/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export const MODEL_CAPABILITIES = [
  { key: 'chat', label: '聊天', endpointKey: 'chat' },
  { key: 'text_to_image', label: '文生图', endpointKey: 'text_to_image' },
  { key: 'image_to_image', label: '图生图', endpointKey: 'image_to_image' },
  {
    key: 'speech_to_text',
    label: '语音转文本',
    endpointKey: 'speech_to_text',
  },
  {
    key: 'text_to_speech',
    label: '文本转语音',
    endpointKey: 'text_to_speech',
  },
  {
    key: 'audio_translation',
    label: '音频翻译',
    endpointKey: 'audio_translation',
  },
  { key: 'embeddings', label: '向量', endpointKey: 'embeddings' },
  {
    key: 'text_to_video',
    label: '文生视频',
    endpointKey: 'text_to_video',
  },
  {
    key: 'image_to_video',
    label: '图生视频',
    endpointKey: 'image_to_video',
  },
  { key: 'rerank', label: '重排序', endpointKey: 'rerank' },
  {
    key: 'music_generation',
    label: '音乐生成',
    endpointKey: 'music_generation',
  },
  { key: 'realtime', label: '实时对话', endpointKey: 'realtime' },
];
