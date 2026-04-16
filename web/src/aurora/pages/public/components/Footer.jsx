import React from 'react';
import { useTranslation } from 'react-i18next';

const link = [
    { lable: 'Privacy Policy' },
    { lable: 'Terms of Service' },
    { lable: 'Status' },
    { lable: 'Twitter' },
    { lable: 'GitHub' },
]

const Footer = () => {
  const { t } = useTranslation();

  return (
    <div className='w-full h-[152px] mt-44 mb-10 border-t-[0.67px] border-[rgba(243,244,246,1)]'>
      <div className='w-[1280px] h-full flex items-center justify-between mx-auto px-4'>
        <div>
          <div className='text-lg font-black leading-[28px]'>
            ima-router
          </div>
          <div className='text-sm text-[rgba(107,114,128,1)] leading-[20px]'>
            {t('footer.subtitle')}
          </div>
        </div>
        <div className='w-[461px] h-5 flex items-center justify-between'>
          {
            link.map((item) => (
              <div className='text-sm text-[rgba(107,114,128,1)] cursor-pointer' key={item.lable}>
                {item.lable}
              </div>
            ))
          }
        </div>
        <div className='text-right'>
          <div className='text-sm text-[rgba(107,114,128,1)]'>
            &copy;2026 ima-router. All rights reserved.
          </div>
          <div className='text-xs text-[rgba(129,140,248,1)] cursor-pointer'>
            API.IMAROUTER.COM
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
