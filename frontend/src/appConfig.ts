// The visible application title and the browser tab title are the same string,
// so both read it from here instead of hard-coding it in two places.
export const APP_TITLE = 'Drilling Map';

/** Pages the sidebar can navigate between. */
export const APP_PAGE_IDS = Object.freeze({
  drillMap: 'drill-map',
  technoMap: 'techno-map',
} as const);

export type AppPageId = (typeof APP_PAGE_IDS)[keyof typeof APP_PAGE_IDS];
