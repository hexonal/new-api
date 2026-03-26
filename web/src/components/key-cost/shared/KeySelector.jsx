import React from 'react';
import { Select } from '@douyinfe/semi-ui';

const KeySelector = ({
  tokens = [],
  value,
  onChange,
  multiple = false,
  placeholder,
  t,
}) => {
  const options = tokens.map((token) => ({
    label: token.name || `Key #${token.id}`,
    value: token.id,
  }));

  return (
    <Select
      placeholder={placeholder || t('选择 Key')}
      value={value}
      onChange={onChange}
      multiple={multiple}
      filter
      style={{ minWidth: 200 }}
      optionList={options}
      showClear={!multiple}
      maxTagCount={2}
    />
  );
};

export default KeySelector;
