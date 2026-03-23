import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent';

// Options can be empty if you rely on the script injection from New Relic (copy-paste method)
// Or you can configure initialization options if using the NPM package purely.
// Typically for SPA, we initialise the agent.
// Make sure you have the environment variables set: VITE_NEW_RELIC_LICENSE_KEY, VITE_NEW_RELIC_APP_ID

const options = {
    init: { distributed_tracing: { enabled: true }, privacy: { cookies_enabled: true } },
    info: { beacon: 'bam.nr-data.net', errorBeacon: 'bam.nr-data.net', licenseKey: import.meta.env.VITE_NEW_RELIC_LICENSE_KEY, applicationID: import.meta.env.VITE_NEW_RELIC_APP_ID },
    loader_config: { accountID: import.meta.env.VITE_NEW_RELIC_ACCOUNT_ID, trustKey: import.meta.env.VITE_NEW_RELIC_TRUST_KEY, agentID: import.meta.env.VITE_NEW_RELIC_APP_ID, licenseKey: import.meta.env.VITE_NEW_RELIC_LICENSE_KEY, applicationID: import.meta.env.VITE_NEW_RELIC_APP_ID }
};

// Only initialize in production or if keys are present
export const initializeNewRelic = () => {
    if (import.meta.env.PROD && import.meta.env.VITE_NEW_RELIC_LICENSE_KEY) {
        const agent = new BrowserAgent(options);
        return agent;
    }
    return null;
};
