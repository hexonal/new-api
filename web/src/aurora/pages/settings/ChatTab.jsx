import React from 'react';
import OptionCard from './OptionCard';
import useSettingsOptions from './useSettingsOptions';

export default function ChatTab() {
  const { options, saveOptions } = useSettingsOptions();

  return (
    <div className='grid gap-4 md:grid-cols-2'>
      <OptionCard
        title='聊天设置'
        description='会话、上下文和回复策略。'
        optionPrefix='aurora.chat.general'
        options={options}
        saveOptions={saveOptions}
      />
    </div>
  );
}
