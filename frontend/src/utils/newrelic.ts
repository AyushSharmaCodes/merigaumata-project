import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent';

const REQUIRED_NEW_RELIC_ENV_KEYS = [
  'VITE_NEW_RELIC_LICENSE_KEY',
  'VITE_NEW_RELIC_APP_ID',
  'VITE_NEW_RELIC_ACCOUNT_ID',
  'VITE_NEW_RELIC_TRUST_KEY',
] as const;

type NewRelicEnvKey = typeof REQUIRED_NEW_RELIC_ENV_KEYS[number];

const getNewRelicEnvValue = (key: NewRelicEnvKey): string => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const getMissingNewRelicEnvKeys = (): NewRelicEnvKey[] =>
  REQUIRED_NEW_RELIC_ENV_KEYS.filter((key) => !getNewRelicEnvValue(key));

export const isNewRelicBrowserConfigured = (): boolean =>
  getMissingNewRelicEnvKeys().length === 0;

const buildNewRelicOptions = () => {
  const licenseKey = getNewRelicEnvValue('VITE_NEW_RELIC_LICENSE_KEY');
  const applicationID = getNewRelicEnvValue('VITE_NEW_RELIC_APP_ID');
  const accountID = getNewRelicEnvValue('VITE_NEW_RELIC_ACCOUNT_ID');
  const trustKey = getNewRelicEnvValue('VITE_NEW_RELIC_TRUST_KEY');

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

export const initializeNewRelic = () => {
  if (!import.meta.env.PROD || !isNewRelicBrowserConfigured()) {
    return null;
  }

  return new BrowserAgent(buildNewRelicOptions());
};
