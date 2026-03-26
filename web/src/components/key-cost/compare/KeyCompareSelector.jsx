import React, { useState } from 'react';
import { Tag, TagGroup, Button, Popover, Select } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { MAX_COMPARE_KEYS, COMPARE_COLORS } from '../../../constants/key-cost.constants';

const KeyCompareSelector = ({
  tokens,
  selectedTokenIds,
  onSelectedChange,
  t,
}) => {
  const [popoverVisible, setPopoverVisible] = useState(false);

  const selectedSet = new Set(selectedTokenIds);
  const availableTokens = tokens.filter((tok) => !selectedSet.has(tok.id));

  const handleAdd = (tokenId) => {
    onSelectedChange([...selectedTokenIds, tokenId]);
    setPopoverVisible(false);
  };

  const handleRemove = (tokenId) => {
    onSelectedChange(selectedTokenIds.filter((id) => id !== tokenId));
  };

  const tagList = selectedTokenIds.map((tokenId, idx) => {
    const tok = tokens.find((t) => t.id === tokenId);
    const name = tok ? tok.name : `Key #${tokenId}`;
    const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];

    return (
      <Tag
        key={tokenId}
        closable
        onClose={() => handleRemove(tokenId)}
        color='white'
        style={{
          borderColor: color,
          borderLeftWidth: 3,
          borderLeftColor: color,
        }}
        size='large'
      >
        <span style={{ color }}>{name}</span>
      </Tag>
    );
  });

  return (
    <div className='flex items-center gap-2 flex-wrap mb-4'>
      <TagGroup
        maxTagCount={10}
        tagList={tagList}
        size='large'
        showPopover
      />

      {selectedTokenIds.length < MAX_COMPARE_KEYS && (
        <Popover
          visible={popoverVisible}
          onVisibleChange={setPopoverVisible}
          trigger='click'
          position='bottomLeft'
          content={
            <div style={{ padding: 12, width: 260 }}>
              <Select
                placeholder={t('选择 Key 添加')}
                filter
                autoFocus
                optionList={availableTokens.map((tok) => ({
                  label: tok.name || `Key #${tok.id}`,
                  value: tok.id,
                }))}
                onChange={(val) => handleAdd(val)}
                style={{ width: '100%' }}
              />
            </div>
          }
        >
          <Button
            icon={<IconPlus />}
            theme='light'
            size='small'
          >
            {t('添加 Key')}
          </Button>
        </Popover>
      )}
    </div>
  );
};

export default KeyCompareSelector;
