require('dotenv').config();
const { SESv2Client, CreateEmailTemplateCommand, UpdateEmailTemplateCommand, GetEmailTemplateCommand, DeleteEmailTemplateCommand, ListEmailTemplatesCommand } = require('@aws-sdk/client-sesv2');
const { allTemplates } = require('../services/email/ses-templates');

// Initialize AWS SES v2 Client
const client = new SESv2Client({
    region: process.env.AWS_SES_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Check if a template exists in SES
 */
async function templateExists(templateName) {
    try {
        const command = new GetEmailTemplateCommand({ TemplateName: templateName });
        await client.send(command);
        return true;
    } catch (error) {
        if (error.name === 'NotFoundException') {
            return false;
        }
        throw error;
    }
}

/**
 * Create or update a template
 */
async function deployTemplate(templateDef, isDryRun) {
    const { TemplateName, SubjectPart, HtmlPart, TextPart } = templateDef;

    console.log(`\n⏳ Processing: ${TemplateName}`);

    if (isDryRun) {
        console.log(`   ✅ [DRY RUN] Would deploy template (Subject: "${SubjectPart}")`);
        return true;
    }

    try {
        const exists = await templateExists(TemplateName);

        const params = {
            TemplateName,
            TemplateContent: {
                Subject: SubjectPart,
                Html: HtmlPart,
                Text: TextPart
            }
        };

        if (exists) {
            console.log(`   🔄 Updating existing template...`);
            const command = new UpdateEmailTemplateCommand(params);
            await client.send(command);
            console.log(`   ✅ Successfully updated!`);
        } else {
            console.log(`   🆕 Creating new template...`);
            const command = new CreateEmailTemplateCommand(params);
            await client.send(command);
            console.log(`   ✅ Successfully created!`);
        }
        return true;

    } catch (error) {
        console.error(`   ❌ Failed to deploy ${TemplateName}:`, error.message);
        if (error.$metadata) {
            console.error(`      AWS Request ID: ${error.$metadata.requestId}`);
        }
        return false;
    }
}

/**
 * Delete all mgm_ templates
 */
async function deleteAllTemplates() {
    console.log('\n🗑️  Starting Deletion of MGM Templates...');
    try {
        const command = new ListEmailTemplatesCommand({});
        const result = await client.send(command);
        let count = 0;

        for (const tmpl of result.TemplatesMetadata) {
            if (tmpl.TemplateName.startsWith('mgm_')) {
                console.log(`   🗑️  Deleting ${tmpl.TemplateName}...`);
                await client.send(new DeleteEmailTemplateCommand({ TemplateName: tmpl.TemplateName }));
                count++;
            }
        }
        console.log(`\n✅ Deleted ${count} templates.`);
    } catch (error) {
        console.error('❌ Failed to list/delete templates:', error);
    }
}

/**
 * Main execution
 */
async function run() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isDelete = args.includes('--delete');
    
    // Support filtering by prefix, e.g. --filter=order
    const filterArg = args.find(a => a.startsWith('--filter='));
    const filterPrefix = filterArg ? filterArg.split('=')[1] : null;

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error('❌ Missing AWS Credentials in .env');
        process.exit(1);
    }

    if (isDelete) {
        await deleteAllTemplates();
        process.exit(0);
    }

    console.log(`\n🚀 Starting SES Template Deployment...`);
    console.log(`   Total templates defined locally: ${allTemplates.length}`);
    if (isDryRun) console.log(`   (DRY RUN MODE - No changes will be made)`);
    if (filterPrefix) console.log(`   (FILTER: 'mgm_${filterPrefix}_*')`);

    let successCount = 0;
    let failCount = 0;

    for (const template of allTemplates) {
        if (filterPrefix && !template.TemplateName.includes(`_${filterPrefix}_`)) {
            continue;
        }

        const success = await deployTemplate(template, isDryRun);
        if (success) successCount++;
        else failCount++;
        
        // Add a 1.5-second delay to avoid AWS SES Rate Exceeded limit
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log('\n========================================');
    console.log(`🎉 Deployment Complete!`);
    console.log(`   ✅ Supported: ${successCount}`);
    if (failCount > 0) console.log(`   ❌ Failed: ${failCount}`);
    console.log('========================================\n');
}

run();
