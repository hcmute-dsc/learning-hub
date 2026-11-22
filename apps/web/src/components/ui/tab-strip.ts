/**
 * The row of tabs under a page header (AdminTabs, TrackTabs), learning-hub#103.
 *
 * Mobile first: on a phone the tabs scroll sideways without a scrollbar and the edges
 * fade, so it shows there is more. From `sm` the fade goes away, because the tabs fit.
 */
export const TAB_STRIP =
  'relative -mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)] sm:[mask-image:none] [&::-webkit-scrollbar]:hidden';

/**
 * One tab. On a phone `min-h-11` keeps it at least 44px tall, an easy target for a
 * thumb; from `sm` (mouse and trackpad) it is the compact 38px tab.
 */
export function tabLinkClass(active: boolean): string {
  return `flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors sm:block sm:min-h-0 sm:py-2 ${
    active ? 'border-brand-500 text-brand-600' : 'muted border-transparent hover:text-brand-600'
  }`;
}
