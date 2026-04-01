require('dotenv').config();

const {
    SESv2Client,
    CreateConfigurationSetCommand,
    CreateConfigurationSetEventDestinationCommand,
    UpdateConfigurationSetEventDestinationCommand
} = require('@aws-sdk/client-sesv2');

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function parseCsv(value, fallback) {
    const raw = value || fallback;
    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function isEnabled(value, defaultValue = false) {
    if (value === undefined) return defaultValue;
    return value === 'true';
}

function getClient() {
    const region = requiredEnv('AWS_SES_REGION');
    const options = { region };

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        options.credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };

        if (process.env.AWS_SESSION_TOKEN) {
            options.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
        }
    }

    return new SESv2Client(options);
}

async function ensureConfigurationSet(client, configurationSetName) {
    try {
        await client.send(new CreateConfigurationSetCommand({
            ConfigurationSetName: configurationSetName,
            SendingOptions: {
                SendingEnabled: true
            }
        }));

        console.log(`Created configuration set: ${configurationSetName}`);
    } catch (error) {
        if (error.name === 'AlreadyExistsException') {
            console.log(`Configuration set already exists: ${configurationSetName}`);
            return;
        }

        throw error;
    }
}

async function upsertEventDestination(client, configurationSetName, eventDestinationName, eventDestination) {
    try {
        await client.send(new CreateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: configurationSetName,
            EventDestinationName: eventDestinationName,
            EventDestination: eventDestination
        }));

        console.log(`Created event destination: ${eventDestinationName}`);
    } catch (error) {
        if (error.name !== 'AlreadyExistsException') {
            throw error;
        }

        await client.send(new UpdateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: configurationSetName,
            EventDestinationName: eventDestinationName,
            EventDestination: eventDestination
        }));

        console.log(`Updated event destination: ${eventDestinationName}`);
    }
}

async function main() {
    const client = getClient();
    const configurationSetName = requiredEnv('AWS_SES_CONFIGURATION_SET');

    await ensureConfigurationSet(client, configurationSetName);

    const matchingEventTypes = parseCsv(
        process.env.AWS_SES_EVENT_TYPES,
        'SEND,DELIVERY,BOUNCE,COMPLAINT,REJECT,RENDERING_FAILURE,DELIVERY_DELAY'
    );

    const enableEventBridge = isEnabled(process.env.AWS_SES_EVENTBRIDGE_ENABLED, true);
    const enableSns = isEnabled(process.env.AWS_SES_SNS_ENABLED, false);

    if (enableEventBridge) {
        const eventBusArn = requiredEnv('AWS_SES_EVENTBRIDGE_BUS_ARN');
        const eventDestinationName = process.env.AWS_SES_EVENTBRIDGE_DESTINATION_NAME || 'eventbridge-monitoring';

        await upsertEventDestination(client, configurationSetName, eventDestinationName, {
            Enabled: true,
            MatchingEventTypes: matchingEventTypes,
            EventBridgeDestination: {
                EventBusArn: eventBusArn
            }
        });
    }

    if (enableSns) {
        const topicArn = requiredEnv('AWS_SES_SNS_TOPIC_ARN');
        const eventDestinationName = process.env.AWS_SES_SNS_DESTINATION_NAME || 'sns-alerts';

        await upsertEventDestination(client, configurationSetName, eventDestinationName, {
            Enabled: true,
            MatchingEventTypes: matchingEventTypes,
            SnsDestination: {
                TopicArn: topicArn
            }
        });
    }

    if (!enableEventBridge && !enableSns) {
        console.log('No event destinations were enabled. Set AWS_SES_EVENTBRIDGE_ENABLED=true and/or AWS_SES_SNS_ENABLED=true.');
    }

    console.log('SES configuration set setup complete.');
}

main().catch((error) => {
    console.error('SES configuration set setup failed.');
    console.error(error.message);
    process.exit(1);
});
