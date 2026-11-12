import data from "./app.yaml";

/** Pages the sidebar can navigate between. */
export type AppPageId = "drill-map" | "techno-map" | "drilling-details" | "drilling-by-rigs";

interface AppConfig {
  title: string;
  navigation: { id: AppPageId; label: string; icon: string }[];
  connection: { checkIntervalMs: number; timeoutMs: number; requestTimeoutMs: number };
}

export const APP_CONFIG = data as AppConfig;
