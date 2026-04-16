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

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { MODALITY_OPTIONS } from './constants';

const ExplorerSectionTitle = ({ children }) => (
  <h3
    className='text-[13px] font-extrabold uppercase tracking-[0.20em] text-[#182238]'
    style={{ fontFamily: 'Public Sans, sans-serif' }}
  >
    {children}
  </h3>
);

const SectionToggleButton = ({ expanded, onClick, title }) => (
  <button type='button' className='flex w-full items-center justify-between' onClick={onClick}>
    <ExplorerSectionTitle>{title}</ExplorerSectionTitle>
    <ChevronDown
      className={`h-5 w-5 text-[#97a0af] transition-transform ${
        expanded ? 'rotate-180' : ''
      }`}
    />
  </button>
);

const ModalityPanel = ({ selectedModalities, t, toggleModality }) => (
  <div className='mb-8'>
    <h3
      className='mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#98a0af]'
      style={{ fontFamily: 'Public Sans, sans-serif' }}
    >
      {t('输入类型')}
    </h3>
    <div className='space-y-3'>
      {MODALITY_OPTIONS.map((item) => (
        <label key={item.key} className='group flex cursor-pointer items-center gap-3'>
          <input
            type='checkbox'
            checked={selectedModalities.includes(item.key)}
            onChange={() => toggleModality(item.key)}
            className='h-6 w-6 rounded-md border-gray-300 text-[#3b74e6] focus:ring-[#3b74e6]'
          />
          <span className='text-[15px] font-semibold text-[#414c5e] transition-colors group-hover:text-[#355fc8]'>
            {t(item.labelKey)}
          </span>
        </label>
      ))}
    </div>
  </div>
);

const HiddenSectionDivider = () => (
  <div className='hidden border-t border-gray-200 pt-4' aria-hidden={true} />
);

const SeriesOptionButtons = ({ selectedSeries, toggleSeries, visibleSeries }) => (
  <div className='max-h-56 space-y-1 overflow-y-auto pr-1'>
    {visibleSeries.map((series) => {
      const active = selectedSeries.includes(series);
      return (
        <button
          type='button'
          key={series}
          onClick={() => toggleSeries(series)}
          className={`block w-full rounded-[10px] border px-4 py-2 text-left text-[15px] transition-colors ${
            active
              ? 'border-[#9db6ea] bg-[#eaf1ff] font-semibold text-[#355fc8]'
              : 'border-[#cfd4dd] bg-transparent text-[#4a5568] hover:border-[#9db6ea]'
          }`}
        >
          {series}
        </button>
      );
    })}
  </div>
);

const SeriesToggleButtons = ({
  hiddenSeriesCount,
  seriesOptions,
  setShowAllSeries,
  showAllSeries,
  t,
}) => (
  <>
    {hiddenSeriesCount > 0 && !showAllSeries && (
      <button
        type='button'
        className='text-left text-sm italic text-gray-500 transition-colors hover:text-indigo-600'
        onClick={() => setShowAllSeries(true)}
      >
        + {hiddenSeriesCount} {t('更多')}
      </button>
    )}
    {showAllSeries && seriesOptions.length > 6 && (
      <button
        type='button'
        className='text-left text-sm italic text-gray-500 transition-colors hover:text-indigo-600'
        onClick={() => setShowAllSeries(false)}
      >
        {t('收起')}
      </button>
    )}
  </>
);

const SeriesOptions = ({
  hiddenSeriesCount,
  selectedSeries,
  seriesOptions,
  setShowAllSeries,
  showAllSeries,
  t,
  toggleSeries,
  visibleSeries,
}) => (
  <div className='mt-1 space-y-2'>
    <SeriesOptionButtons
      selectedSeries={selectedSeries}
      toggleSeries={toggleSeries}
      visibleSeries={visibleSeries}
    />
    <SeriesToggleButtons
      hiddenSeriesCount={hiddenSeriesCount}
      seriesOptions={seriesOptions}
      setShowAllSeries={setShowAllSeries}
      showAllSeries={showAllSeries}
      t={t}
    />
    {seriesOptions.length === 0 && <span className='text-xs text-gray-400'>-</span>}
  </div>
);

const SeriesSection = ({
  expanded,
  hiddenSeriesCount,
  selectedSeries,
  seriesOptions,
  setExpanded,
  setShowAllSeries,
  showAllSeries,
  t,
  toggleSeries,
  visibleSeries,
}) => (
  <div className='border-t border-[#d7dbe2] pt-6'>
    <div className='mb-4'>
      <SectionToggleButton
        expanded={expanded.series}
        onClick={() => setExpanded((prev) => ({ ...prev, series: !prev.series }))}
        title={t('系列')}
      />
    </div>
    {expanded.series && (
      <SeriesOptions
        hiddenSeriesCount={hiddenSeriesCount}
        selectedSeries={selectedSeries}
        seriesOptions={seriesOptions}
        setShowAllSeries={setShowAllSeries}
        showAllSeries={showAllSeries}
        t={t}
        toggleSeries={toggleSeries}
        visibleSeries={visibleSeries}
      />
    )}
  </div>
);

const ProviderOptions = ({
  hiddenProviderCount,
  providerOptions,
  selectedProviders,
  setShowAllProviders,
  showAllProviders,
  t,
  toggleProvider,
  visibleProviders,
}) => (
  <div className='mt-4 space-y-2'>
    {visibleProviders.map((provider) => {
      const active = selectedProviders.includes(provider);
      return (
        <button
          type='button'
          key={provider}
          onClick={() => toggleProvider(provider)}
          className={`block text-left text-[18px] leading-9 transition-colors ${
            active ? 'font-semibold text-[#355fc8]' : 'text-[#4a5568] hover:text-[#355fc8]'
          }`}
        >
          {provider}
        </button>
      );
    })}
    {hiddenProviderCount > 0 && !showAllProviders && (
      <button
        type='button'
        className='text-left text-[18px] italic text-[#6b7688] transition-colors hover:text-[#355fc8]'
        onClick={() => setShowAllProviders(true)}
      >
        + {hiddenProviderCount} {t('更多')}
      </button>
    )}
    {showAllProviders && providerOptions.length > 3 && (
      <button
        type='button'
        className='text-left text-[18px] italic text-[#6b7688] transition-colors hover:text-[#355fc8]'
        onClick={() => setShowAllProviders(false)}
      >
        {t('收起')}
      </button>
    )}
  </div>
);

const ProviderSection = ({
  expanded,
  hiddenProviderCount,
  providerOptions,
  selectedProviders,
  setExpanded,
  setShowAllProviders,
  showAllProviders,
  t,
  toggleProvider,
  visibleProviders,
}) => (
  <div className='border-t border-[#d7dbe2] pt-6'>
    <SectionToggleButton
      expanded={expanded.providers}
      onClick={() => setExpanded((prev) => ({ ...prev, providers: !prev.providers }))}
      title={t('供应商')}
    />
    {expanded.providers && (
      <ProviderOptions
        hiddenProviderCount={hiddenProviderCount}
        providerOptions={providerOptions}
        selectedProviders={selectedProviders}
        setShowAllProviders={setShowAllProviders}
        showAllProviders={showAllProviders}
        t={t}
        toggleProvider={toggleProvider}
        visibleProviders={visibleProviders}
      />
    )}
  </div>
);

const ExpandablePanels = (props) => (
  <div className='space-y-6'>
    <HiddenSectionDivider />
    <HiddenSectionDivider />
    <SeriesSection {...props} />
    <ProviderSection {...props} />
  </div>
);

const ModelsExplorerSidebar = ({ optionPanels, selectedModalities, selections, t }) => {
  const {
    expanded,
    hiddenProviderCount,
    hiddenSeriesCount,
    providerOptions,
    setExpanded,
    setShowAllProviders,
    setShowAllSeries,
    showAllProviders,
    showAllSeries,
    seriesOptions,
    visibleProviders,
    visibleSeries,
  } = optionPanels;

  return (
    <aside className='my-4 ml-4 w-[252px] flex-shrink-0 self-start rounded-[30px] border border-[#d8dde5] border-r-[#cfd5de] bg-[#f1f3f6] px-6 py-7'>
      <ModalityPanel
        selectedModalities={selectedModalities}
        t={t}
        toggleModality={selections.toggleModality}
      />
      <ExpandablePanels
        expanded={expanded}
        hiddenProviderCount={hiddenProviderCount}
        hiddenSeriesCount={hiddenSeriesCount}
        providerOptions={providerOptions}
        selectedProviders={selections.selectedProviders}
        selectedSeries={selections.selectedSeries}
        setExpanded={setExpanded}
        setShowAllProviders={setShowAllProviders}
        setShowAllSeries={setShowAllSeries}
        showAllProviders={showAllProviders}
        showAllSeries={showAllSeries}
        seriesOptions={seriesOptions}
        t={t}
        toggleProvider={selections.toggleProvider}
        toggleSeries={selections.toggleSeries}
        visibleProviders={visibleProviders}
        visibleSeries={visibleSeries}
      />
    </aside>
  );
};

export default ModelsExplorerSidebar;
