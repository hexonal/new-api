import React from 'react';

const UsageLogExpandedRow = ({ record = {}, t = (value) => value }) => (
  <div className='rounded-md bg-muted border border-border p-3 text-xs space-y-2'>
    <div>
      <span className='text-muted-foreground mr-2'>{t('请求 ID')}:</span>
      <span className='font-mono'>{record.request_id || '-'}</span>
    </div>
    <div>
      <span className='text-muted-foreground mr-2'>{t('Token')}:</span>
      <span className='font-mono'>{record.token_name || '-'}</span>
    </div>
    <div>
      <span className='text-muted-foreground mr-2'>{t('响应码')}:</span>
      <span>{record.status_code || '-'}</span>
    </div>
    <div>
      <span className='text-muted-foreground mr-2'>{t('原始请求体')}:</span>
      <pre className='mt-1 whitespace-pre-wrap break-all text-[11px]'>
        {JSON.stringify(record.request_body || {}, null, 2)}
      </pre>
    </div>
  </div>
);

export default UsageLogExpandedRow;
