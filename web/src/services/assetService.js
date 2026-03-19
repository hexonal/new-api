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

import { API } from '../helpers/api';

/**
 * 素材管理 API 服务层
 * 所有后端 API 均为 POST 方法
 * 响应格式统一为: { success: boolean, data: any, message: string }
 */

/**
 * 创建素材分组
 * @param {string} name - 分组名称
 * @param {string} description - 分组描述
 * @returns {Promise<Object>} { success, data: { id, name, description, created_at, updated_at }, message }
 */
export async function createAssetGroup(name, description = '') {
  const res = await API.post('/api/assets/group/create', {
    name,
    description,
  });
  return res.data;
}

/**
 * 获取素材分组列表
 * @param {Object} filters - 筛选条件 { name_search, status }
 * @param {number} page - 页码（1-based）
 * @param {number} pageSize - 每页数量
 * @returns {Promise<Object>} { success, data: { groups: Array, total, page, pageSize }, message }
 */
export async function listAssetGroups(filters = {}, page = 1, pageSize = 10) {
  const res = await API.post('/api/assets/group/list', {
    filters,
    page,
    pageSize,
  });
  return res.data;
}

/**
 * 获取单个素材分组详情
 * @param {string|number} id - 分组 ID
 * @returns {Promise<Object>} { success, data: { id, name, description, created_at, updated_at, asset_count }, message }
 */
export async function getAssetGroup(id) {
  const res = await API.post('/api/assets/group/get', {
    id,
  });
  return res.data;
}

/**
 * 更新素材分组
 * @param {string|number} id - 分组 ID
 * @param {Object} updates - 更新内容 { name, description }
 * @returns {Promise<Object>} { success, data: { id, name, description, updated_at }, message }
 */
export async function updateAssetGroup(id, updates = {}) {
  const res = await API.post('/api/assets/group/update', {
    id,
    ...updates,
  });
  return res.data;
}

/**
 * 删除素材分组
 * @param {string|number} id - 分组 ID
 * @returns {Promise<Object>} { success, data: null, message }
 */
export async function deleteAssetGroup(id) {
  const res = await API.post('/api/assets/group/delete', {
    id,
  });
  return res.data;
}

/**
 * 创建素材
 * @param {string|number} groupId - 分组 ID
 * @param {string} url - 素材 URL
 * @param {string} name - 素材名称
 * @param {Object} metadata - 素材元数据（可选） { width, height, type, tags, description }
 * @returns {Promise<Object>} { success, data: { id, groupId, url, name, metadata, created_at }, message }
 */
export async function createAsset(groupId, url, name, metadata = {}) {
  const res = await API.post('/api/assets/create', {
    groupId,
    url,
    name,
    metadata,
  });
  return res.data;
}

/**
 * 批量创建素材
 * @param {string|number} groupId - 分组 ID
 * @param {Array} assets - 素材数组 [{ url, name, metadata }, ...]
 * @returns {Promise<Object>} { success, data: { created: number, failed: number, errors: Array }, message }
 */
export async function batchCreateAssets(groupId, assets = []) {
  const res = await API.post('/api/assets/batch/create', {
    groupId,
    assets,
  });
  return res.data;
}

/**
 * 获取素材列表
 * @param {Object} filters - 筛选条件 { groupId, name_search, url_search, status, tags }
 * @param {number} page - 页码（1-based）
 * @param {number} pageSize - 每页数量
 * @param {string} sortBy - 排序字段 (CreateTime, UpdateTime, GroupId)
 * @param {string} sortOrder - 排序顺序 (Asc, Desc)
 * @returns {Promise<Object>} { success, data: { assets: Array, total, page, pageSize }, message }
 */
export async function listAssets(
  filters = {},
  page = 1,
  pageSize = 10,
  sortBy = 'CreateTime',
  sortOrder = 'Desc',
) {
  const res = await API.post('/api/assets/list', {
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });
  return res.data;
}

/**
 * 获取单个素材详情
 * @param {string|number} id - 素材 ID
 * @returns {Promise<Object>} { success, data: { id, groupId, url, name, metadata, created_at, updated_at, access_count }, message }
 */
export async function getAsset(id) {
  const res = await API.post('/api/assets/get', {
    id,
  });
  return res.data;
}

/**
 * 更新素材
 * @param {string|number} id - 素材 ID
 * @param {Object} updates - 更新内容 { name, metadata, tags }
 * @returns {Promise<Object>} { success, data: { id, name, metadata, updated_at }, message }
 */
export async function updateAsset(id, updates = {}) {
  const res = await API.post('/api/assets/update', {
    id,
    ...updates,
  });
  return res.data;
}

/**
 * 删除素材
 * @param {string|number} id - 素材 ID
 * @returns {Promise<Object>} { success, data: null, message }
 */
export async function deleteAsset(id) {
  const res = await API.post('/api/assets/delete', {
    id,
  });
  return res.data;
}

/**
 * 批量删除素材
 * @param {Array} ids - 素材 ID 数组
 * @returns {Promise<Object>} { success, data: { deleted: number }, message }
 */
export async function batchDeleteAssets(ids = []) {
  const res = await API.post('/api/assets/batch/delete', {
    ids,
  });
  return res.data;
}

/**
 * 获取素材配额信息
 * @returns {Promise<Object>} { success, data: { totalQuota: number, usedQuota: number, remaining: number, maxAssets: number, quotaUnit: string }, message }
 */
export async function getAssetQuota() {
  const res = await API.post('/api/assets/quota', {});
  return res.data;
}

/**
 * 上传素材（用于文件上传，返回 URL）
 * @param {File} file - 文件对象
 * @param {string} groupId - 分组 ID（可选）
 * @returns {Promise<Object>} { success, data: { url, fileId, name, size, uploadedAt }, message }
 */
export async function uploadAsset(file, groupId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (groupId) {
    formData.append('groupId', groupId);
  }

  const res = await API.post('/api/assets/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

/**
 * 获取素材分享链接
 * @param {string|number} id - 素材 ID
 * @param {Object} options - 分享选项 { expiresIn, maxAccesses }
 * @returns {Promise<Object>} { success, data: { shareUrl, token, expiresAt, maxAccesses }, message }
 */
export async function getAssetShareLink(id, options = {}) {
  const res = await API.post('/api/assets/share/get', {
    id,
    ...options,
  });
  return res.data;
}

/**
 * 删除素材分享链接
 * @param {string|number} id - 素材 ID
 * @param {string} token - 分享 token
 * @returns {Promise<Object>} { success, data: null, message }
 */
export async function deleteAssetShareLink(id, token) {
  const res = await API.post('/api/assets/share/delete', {
    id,
    token,
  });
  return res.data;
}

/**
 * 获取素材标签列表（用于自动完成）
 * @param {string} prefix - 标签前缀搜索
 * @returns {Promise<Object>} { success, data: { tags: Array }, message }
 */
export async function getAssetTags(prefix = '') {
  const res = await API.post('/api/assets/tags', {
    prefix,
  });
  return res.data;
}
