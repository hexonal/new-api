import { useCallback, useEffect, useState } from 'react';
import { API, showError, showSuccess } from '../../../helpers';

const toOptionMap = (raw) => {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return raw.reduce((acc, item) => {
      if (item && item.key) {
        acc[item.key] = item.value;
      }
      return acc;
    }, {});
  }
  if (typeof raw === 'object') {
    return raw;
  }
  return {};
};

export const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return fallback;
};

export const parseString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

export default function useSettingsOptions() {
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/option/');
      const { success, message, data } = res.data || {};
      if (!success) {
        showError(message || '加载配置失败');
        return;
      }
      setOptions(toOptionMap(data));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const saveOptions = useCallback(async (entries, successMessage = '保存成功') => {
    const validEntries = (entries || []).filter(
      (entry) => entry && entry.key && entry.value !== undefined,
    );

    if (!validEntries.length) return false;

    try {
      const responses = await Promise.all(
        validEntries.map((entry) =>
          API.put('/api/option/', {
            key: entry.key,
            value:
              typeof entry.value === 'boolean'
                ? String(entry.value)
                : String(entry.value),
          }),
        ),
      );

      const failed = responses.find((response) => !response?.data?.success);
      if (failed) {
        showError(failed?.data?.message || '保存失败');
        return false;
      }

      setOptions((prev) => {
        const next = { ...prev };
        validEntries.forEach((entry) => {
          next[entry.key] = entry.value;
        });
        return next;
      });

      showSuccess(successMessage);
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }, []);

  return {
    options,
    loading,
    loadOptions,
    saveOptions,
  };
}
