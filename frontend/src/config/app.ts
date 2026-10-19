import data from './app.yaml';
import { list, number, object, oneOf, parseConfig, text } from './schema';

export const APP_PAGE_IDS = ['drill-map', 'techno-map'] as const;

/** Pages the sidebar can navigate between. */
export type AppPageId = (typeof APP_PAGE_IDS)[number];

export const APP_CONFIG = parseConfig(
  object({
    title: text,
    navigation: list(object({ id: oneOf(...APP_PAGE_IDS), label: text, icon: text })),
    connection: object({ checkIntervalMs: number, timeoutMs: number, requestTimeoutMs: number }),
  }),
  data,
  'app.yaml',
);

export type NavItem = (typeof APP_CONFIG.navigation)[number];
