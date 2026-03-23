const supabase = require('../config/supabase');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const createDOMPurify = require('isomorphic-dompurify');
const logger = require('../utils/logger');
const { SYSTEM, LOGS } = require('../constants/messages');
const { applyTranslations } = require('../utils/i18n.util');

const DOMPurify = createDOMPurify;

class PolicyService {
    async normalizeHtml(html) {
        // Sanitize using allowlist
        const sanitized = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'table', 'thead', 'tbody', 'tr', 'td'],
            ALLOWED_ATTR: ['href', 'target'],
        });

        // Clean up multiple <br> tags
        let normalized = sanitized.replace(/(<br\s*\/?>){2,}/gi, '<br>');

        // Extra cleaning for PDF artifacts (like "Page 1 of 5" or common footer patterns)
        normalized = normalized.replace(/Page \d+ of \d+/gi, '');

        return normalized;
    }

    async parseDocument(buffer, mimetype) {
        try {
            if (mimetype === 'application/pdf') {
                const data = await pdf(buffer);
                let text = data.text || '';

                // Remove null characters
                text = text.replace(/\0/g, '');

                // Basic PDF to Semantic HTML logic
                // 1. Detect all-caps lines or short lines as headings
                // 2. Detect bullet points
                const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                let html = '';
                let inList = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    // List item detection (starting with bullet points or dashes)
                    if (/^[\u2022\u00B7\u25CF\-\*]\s+/.test(line)) {
                        if (!inList) {
                            html += '<ul>';
                            inList = true;
                        }
                        html += `<li>${line.replace(/^[\u2022\u00B7\u25CF\-\*]\s+/, '')}</li>`;
                        continue;
                    }

                    if (inList) {
                        html += '</ul>';
                        inList = false;
                    }

                    // Heading detection (all caps or starting with a number like "1. Section")
                    if (/^[A-Z0-9\s\.\:\-]+$/.test(line) && line.length < 100) {
                        // Determine heading level by length or numbering
                        if (/^\d+\./.test(line)) {
                            html += `<h2>${line}</h2>`;
                        } else {
                            html += `<h3>${line}</h3>`;
                        }
                    } else {
                        html += `<p>${line}</p>`;
                    }
                }

                if (inList) html += '</ul>';

                return this.normalizeHtml(html);
            } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimetype === 'application/msword') {
                const options = {
                    styleMap: [
                        "p[style-name='Title'] => h1:fresh",
                        "p[style-name='Heading 1'] => h2:fresh",
                        "p[style-name='Heading 2'] => h3:fresh",
                        "p[style-name='Normal'] => p:fresh",
                        "r[style-name='Strong'] => strong"
                    ]
                };
                const result = await mammoth.convertToHtml({ buffer }, options);
                return this.normalizeHtml(result.value);
            } else {
                throw new Error(SYSTEM.UNSUPPORTED_FILE_TYPE);
            }
        } catch (error) {
            logger.error({ err: error }, 'Error parsing document');
            throw new Error(SYSTEM.PARSE_ERROR);
        }
    }

    async parseMultiLanguageDocument(buffer, mimetype) {
        // 1. Parse entire document to HTML
        const fullHtml = await this.parseDocument(buffer, mimetype);

        // 2. Define language markers (support multiple formats)
        const languageMarkers = {
            en: [
                /===\s*ENGLISH\s*===/i,
                /---\s*ENGLISH\s*---/i,
                /\[\s*ENGLISH\s*\]/i,
                /ENGLISH:/i
            ],
            hi: [
                /===\s*(?:हिंदी|HINDI)\s*===/i,
                /---\s*(?:हिंदी|HINDI)\s*---/i,
                /\[\s*(?:हिंदी|HINDI)\s*\]/i,
                /(?:हिंदी|HINDI):/i
            ],
            ta: [
                /===\s*(?:தமிழ்|TAMIL)\s*===/i,
                /---\s*(?:தமிழ்|TAMIL)\s*---/i,
                /\[\s*(?:தமிழ்|TAMIL)\s*\]/i,
                /(?:தமிழ்|TAMIL):/i
            ],
            te: [
                /===\s*(?:తెలుగు|TELUGU)\s*===/i,
                /---\s*(?:తెలుగు|TELUGU)\s*---/i,
                /\[\s*(?:తెలుగు|TELUGU)\s*\]/i,
                /(?:తెలుగు|TELUGU):/i
            ]
        };

        // 3. Find all language sections
        const result = { en: '', hi: '', ta: '', te: '' };
        const markerPositions = [];

        // Find all marker positions
        for (const [lang, patterns] of Object.entries(languageMarkers)) {
            for (const pattern of patterns) {
                const match = fullHtml.match(pattern);
                if (match) {
                    markerPositions.push({
                        lang,
                        position: match.index,
                        markerLength: match[0].length
                    });
                    break; // Found marker for this language, move to next
                }
            }
        }

        // Sort by position
        markerPositions.sort((a, b) => a.position - b.position);

        // 4. Extract content between markers
        if (markerPositions.length > 0) {
            for (let i = 0; i < markerPositions.length; i++) {
                const current = markerPositions[i];
                const next = markerPositions[i + 1];

                const startPos = current.position + current.markerLength;
                const endPos = next ? next.position : fullHtml.length;

                const content = fullHtml.substring(startPos, endPos).trim();
                result[current.lang] = content;
            }

            // 5. Fallback: if any language is missing, use English content
            const englishContent = result.en;
            for (const lang of ['hi', 'ta', 'te']) {
                if (!result[lang] && englishContent) {
                    logger.info(`Language ${lang} not found, using English as fallback`);
                    result[lang] = englishContent;
                }
            }
        } else {
            // No markers found - treat entire content as English and use for all languages
            logger.info('No language markers found, using entire content for all languages');
            result.en = fullHtml;
            result.hi = fullHtml;
            result.ta = fullHtml;
            result.te = fullHtml;
        }

        return result;
    }

    async uploadPolicy(file, policyType, title, userId) {
        // 1. Upload to Supabase Storage
        const fileExt = file.originalname.split('.').pop().toLowerCase();
        const filePath = `${policyType}/${Date.now()}_${file.originalname}`;

        const { error: uploadError } = await supabase.storage
            .from('policy-documents')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            logger.error({ err: uploadError }, 'Supabase storage upload failed');
            throw new Error(`Failed to upload to storage: ${uploadError.message}`);
        }

        // 2. Parse Multi-Language Content
        logger.info(`Parsing ${policyType} document with multi-language support...`);
        const contentI18n = await this.parseMultiLanguageDocument(file.buffer, file.mimetype);

        // 3. Update DB
        // Determine next version
        const { data: latest, error: versionError } = await supabase
            .from('policy_pages')
            .select('version')
            .eq('policy_type', policyType)
            .order('version', { ascending: false })
            .limit(1)
            .limit(1)
            .maybeSingle();

        let nextVersion = 1;
        if (!versionError && latest) {
            nextVersion = latest.version + 1;
        }

        // Deactivate old policies
        await supabase
            .from('policy_pages')
            .update({ is_active: false })
            .eq('policy_type', policyType);

        // Prepare title i18n (use same title for all languages for now)
        const titleI18n = {
            en: title,
            hi: title,
            ta: title,
            te: title
        };

        // Insert new policy with i18n content
        const { data, error: insertError } = await supabase
            .from('policy_pages')
            .insert({
                policy_type: policyType,
                title,
                title_i18n: titleI18n,
                content_html: contentI18n.en, // Keep English in main column for backward compatibility
                content_html_i18n: contentI18n,
                storage_path: filePath,
                file_type: fileExt,
                version: nextVersion,
                is_active: true
            })
            .select()
            .single();

        if (insertError) {
            logger.error({ err: insertError }, 'Database insert failed');
            throw new Error(`Failed to save policy metadata: ${insertError.message}`);
        }

        return data;
    }

    async getActivePolicy(policyType, lang = 'en') {
        const { data, error } = await supabase
            .from('policy_pages')
            .select('*')
            .eq('policy_type', policyType)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return applyTranslations(data, lang);
    }
}

module.exports = new PolicyService();
