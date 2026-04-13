export const getModelsExplorerLayoutClasses = (isMobile) => ({
  wrapperClassName: isMobile
    ? 'flex w-full flex-col gap-4 px-4 py-4'
    : 'flex w-full gap-6 px-8 py-6 2xl:px-12',
  asideClassName: isMobile
    ? 'w-full shrink-0 rounded-xl border border-border bg-[#f9fafb] p-3'
    : 'sticky top-20 h-[calc(100vh-6rem)] w-60 shrink-0 overflow-y-auto rounded-xl border border-border bg-[#f9fafb] p-3',
  mainClassName: isMobile ? 'min-w-0 w-full' : 'flex-1 min-w-0',
});
