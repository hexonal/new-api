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
import { Check, ChevronDown } from 'lucide-react';
import { getLobeHubIcon } from '../../../../helpers';
import { MODALITY_OPTIONS } from './constants';

const ExplorerSectionTitle = ({ children }) => (
  <h3
    className='text-[12px] font-bold uppercase tracking-[0.16em] text-[#667084]'
    style={{ fontFamily: 'Public Sans, sans-serif' }}
  >
    {children}
  </h3>
);

const SectionCounter = ({ count }) => {
  if (count <= 0) {
    return null;
  }

  return (
    <span className='inline-flex min-w-6 items-center justify-center rounded-full bg-[#e9f0ff] px-2 py-1 text-[11px] font-semibold text-[#2f63d8]'>
      {count}
    </span>
  );
};

const SectionToggleButton = ({ expanded, onClick, selectedCount, title }) => (
  <button
    type='button'
    className='flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-1 py-1'
    onClick={onClick}
  >
    <div className='flex items-center gap-2'>
      <ExplorerSectionTitle>{title}</ExplorerSectionTitle>
      <SectionCounter count={selectedCount} />
    </div>
    <ChevronDown
      className={`h-[18px] w-[18px] text-[#9aa4b5] transition-transform ${
        expanded ? 'rotate-180' : ''
      }`}
    />
  </button>
);

const FilterTagButton = ({ active, icon, label, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className={`group inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
      active
        ? 'border-[#89aaf2] bg-[#edf3ff] text-[#2f63d8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
        : 'border-[#d7dde7] bg-white text-[#455062] hover:border-[#9fb7ea] hover:text-[#2f63d8]'
    }`}
  >
    {active ? <Check className='h-3.5 w-3.5 flex-shrink-0' /> : null}
    {icon ? <span className='inline-flex items-center'>{icon}</span> : null}
    <span className='truncate'>{label}</span>
  </button>
);

const FilterOptionCloud = ({
  emptyText = '-',
  options,
  selectedOptions,
  toggleOption,
}) => {
  if (options.length === 0) {
    return <span className='text-xs text-[#9aa4b5]'>{emptyText}</span>;
  }

  return (
    <div className='max-h-56 overflow-y-auto pr-1'>
      <div className='flex flex-wrap gap-2'>
        {options.map((option) => (
          <FilterTagButton
            key={option}
            active={selectedOptions.includes(option)}
            label={option}
            onClick={() => toggleOption(option)}
          />
        ))}
      </div>
    </div>
  );
};

const SectionDivider = () => (
  <div
    className='h-px w-full bg-gradient-to-r from-transparent via-[#d8e0ec] to-transparent'
    aria-hidden={true}
  />
);

const ModalityPanel = ({ selectedModalities, t, toggleModality }) => (
  <div className='space-y-3'>
    <ExplorerSectionTitle>{t('输入类型')}</ExplorerSectionTitle>
    <div className='flex flex-wrap gap-2'>
      {MODALITY_OPTIONS.map((item) => (
        <FilterTagButton
          key={item.key}
          active={selectedModalities.includes(item.key)}
          label={t(item.labelKey)}
          onClick={() => toggleModality(item.key)}
        />
      ))}
    </div>
  </div>
);

const SeriesSection = ({
  expanded,
  selectedSeries,
  setExpanded,
  t,
  toggleSeries,
  visibleSeries,
}) => (
  <div className='space-y-3'>
    <SectionToggleButton
      expanded={expanded.series}
      onClick={() => setExpanded((prev) => ({ ...prev, series: !prev.series }))}
      selectedCount={selectedSeries.length}
      title={t('系列')}
    />
    {expanded.series ? (
      <FilterOptionCloud
        options={visibleSeries}
        selectedOptions={selectedSeries}
        toggleOption={toggleSeries}
      />
    ) : null}
  </div>
);

const ProviderSection = ({
  expanded,
  selectedProviders,
  setExpanded,
  t,
  toggleProvider,
  visibleProviders,
}) => (
  <div className='space-y-3'>
    <SectionToggleButton
      expanded={expanded.providers}
      onClick={() =>
        setExpanded((prev) => ({ ...prev, providers: !prev.providers }))
      }
      selectedCount={selectedProviders.length}
      title={t('供应商')}
    />
    {expanded.providers ? (
      <div className='max-h-56 overflow-y-auto pr-1'>
        <div className='flex flex-wrap gap-2'>
          {visibleProviders.map((provider) => (
            <FilterTagButton
              key={provider}
              active={selectedProviders.includes(provider)}
              icon={
                <span className='inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'>
                  {getLobeHubIcon(provider, 14)}
                </span>
              }
              label={provider}
              onClick={() => toggleProvider(provider)}
            />
          ))}
        </div>
      </div>
    ) : null}
  </div>
);

const ModelsExplorerSidebar = ({
  className = '',
  isMobile = false,
  optionPanels,
  selectedModalities,
  selections,
  t,
}) => {
  const { expanded, setExpanded, visibleProviders, visibleSeries } =
    optionPanels;

  const sidebarClassName = isMobile
    ? 'w-full rounded-[22px] border border-[#dbe2ea] bg-white px-4 py-5 shadow-[0_14px_32px_rgba(25,39,73,0.08)]'
    : 'my-4 ml-4 w-[276px] flex-shrink-0 self-start rounded-[28px] border border-[#d8e0ec] bg-gradient-to-b from-[#fcfdff] to-[#f4f7fc] px-5 py-6 shadow-[0_18px_42px_rgba(22,34,60,0.08)]';

  return (
    <aside className={`${sidebarClassName} ${className}`.trim()}>
      <div className='space-y-5'>
        <ProviderSection
          expanded={expanded}
          selectedProviders={selections.selectedProviders}
          setExpanded={setExpanded}
          t={t}
          toggleProvider={selections.toggleProvider}
          visibleProviders={visibleProviders}
        />
        <SectionDivider />
        <SeriesSection
          expanded={expanded}
          selectedSeries={selections.selectedSeries}
          setExpanded={setExpanded}
          t={t}
          toggleSeries={selections.toggleSeries}
          visibleSeries={visibleSeries}
        />
        <SectionDivider />
        <ModalityPanel
          selectedModalities={selectedModalities}
          t={t}
          toggleModality={selections.toggleModality}
        />
      </div>
    </aside>
  );
};

export default ModelsExplorerSidebar;
