import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent';

const REQUIRED_NEW_RELIC_ENV_KEYS = [
  'VITE_NEW_RELIC_LICENSE_KEY',
  'VITE_NEW_RELIC_APP_ID',
  'VITE_NEW_RELIC_ACCOUNT_ID',
  'VITE_NEW_RELIC_TRUST_KEY',
] as const;

type NewRelicEnvKey = typeof REQUIRED_NEW_RELIC_ENV_KEYS[number];

const buildNewRelicOptions = () => {
  const licenseKey = import.meta.env.VITE_NEW_RELIC_LICENSE_KEY;
  const applicationID = import.meta.env.VITE_NEW_RELIC_APP_ID;
  const accountID = import.meta.env.VITE_NEW_RELIC_ACCOUNT_ID;
  const trustKey = import.meta.env.VITE_NEW_RELIC_TRUST_KEY;

  return {
    init: {
      distributed_tracing: { enabled: true },
      privacy: { cookies_enabled: true },
    },
    info: {
      beacon: 'bam.nr-data.net',
      errorBeacon: 'bam.nr-data.net',
      licenseKey,
      applicationID,
    },
    loader_config: {
      accountID,
      trustKey,
      agentID: applicationID,
      licenseKey,
      applicationID,
    },
  };
};

export const getMissingNewRelicEnvKeys = (): string[] => {
  const missing: string[] = [];
  if (!import.meta.env.VITE_NEW_RELIC_LICENSE_KEY) missing.push('VITE_NEW_RELIC_LICENSE_KEY');
  if (!import.meta.env.VITE_NEW_RELIC_APP_ID) missing.push('VITE_NEW_RELIC_APP_ID');
  if (!import.meta.env.VITE_NEW_RELIC_ACCOUNT_ID) missing.push('VITE_NEW_RELIC_ACCOUNT_ID');
  if (!import.meta.env.VITE_NEW_RELIC_TRUST_KEY) missing.push('VITE_NEW_RELIC_TRUST_KEY');
  return missing;
};

export const isNewRelicBrowserConfigured = (): boolean =>
  !!(import.meta.env.VITE_NEW_RELIC_LICENSE_KEY && 
     import.meta.env.VITE_NEW_RELIC_APP_ID && 
     import.meta.env.VITE_NEW_RELIC_ACCOUNT_ID && 
     import.meta.env.VITE_NEW_RELIC_TRUST_KEY);

export const initializeNewRelic = () => {
  if (!import.meta.env.PROD || !isNewRelicBrowserConfigured()) {
    return null;
  }

  return new BrowserAgent(buildNewRelicOptions());
};
