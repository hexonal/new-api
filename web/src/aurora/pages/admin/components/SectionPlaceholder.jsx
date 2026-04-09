import React from 'react';

const defaultMessage =
  '该区块目前显示占位内容，后续会接入完整的 Aurora 表单/列表/操作能力；当前用于保持页面结构可见。';

export default function SectionPlaceholder({
  title = '功能占位',
  description = defaultMessage,
  children,
}) {
  return (
    <section className='rounded-lg border border-dashed border-border bg-card/70 p-4 text-sm'>
      <div className='font-medium text-foreground'>{title}</div>
      <p className='mt-1 text-muted-foreground leading-6'>{description}</p>
      {children ? <div className='mt-3'>{children}</div> : null}
    </section>
  );
}
