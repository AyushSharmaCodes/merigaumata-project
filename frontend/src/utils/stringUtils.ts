export const stripHtml = (html: string): string => {
    if (!html) return '';
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    } catch (e) {
        // Fallback for non-browser environments or parser failure
        return html.replace(/<[^>]*>?/gm, '');
    }
};

/**
 * Splits a string into an array of items based on common list delimiters.
 * Robust heuristic:
 * 1. Always splits by newlines.
 * 2. For each line, checks if it's a comma-separated list of short items (e.g., tags/keywords).
 * 3. Prevents splitting on commas in long sentences.
 * 4. Strips common bullet character prefixes.
 */
export const splitIntoList = (text: string): string[] => {
    if (!text) return [];

    // 1. Initial split by newlines as the primary separator
    const rawLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const finalItems: string[] = [];

    rawLines.forEach(line => {
        // If the line explicitly starts with a bullet, we treat the whole line as one item (minus the bullet)
        const isBulletLine = /^[•\*\-\d+\.]+\s+/.test(line);
        if (isBulletLine) {
            finalItems.push(line.replace(/^[•\*\-\d+\.]+\s*/, '').trim());
            return;
        }

        // 2. Comma heuristic: Only split by commas if it looks like a list of brief items (tags/keywords)
        // If a segment after comma splitting is long (e.g. > 4 words), we assume it's a sentence and don't split.
        const commaSegments = line.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        const looksLikeCommaList = commaSegments.length >= 3 && 
            commaSegments.every(segment => segment.split(/\s+/).length <= 4);

        if (looksLikeCommaList) {
            finalItems.push(...commaSegments);
        } else {
            // Treat the whole line (or remaining part) as a single item, stripping any bullets at the start
            finalItems.push(line.replace(/^[•\*\-\d+\.]+\s*/, '').trim());
        }
    });

    return finalItems.filter(item => item.length > 0);
};

/**
 * Cleans a rejection reason string that might contain translation keys or prefixes.
 * Example: "common.order.returnRejectedNote: Reason text" -> "Reason text"
 */
export const cleanRejectionReason = (reason: string): string => {
    if (!reason) return '';
    
    // Remove the common prefix if it exists
    const prefix = "common.order.returnRejectedNote:";
    if (reason.includes(prefix)) {
        return reason.split(prefix)[1].trim();
    }

    // Generic dots-and-colon check (e.g. some.key: value)
    if (reason.includes(':') && reason.includes('.')) {
        const parts = reason.split(':');
        const firstPart = parts[0].trim();
        if (firstPart.includes('.') && !firstPart.includes(' ')) {
            return parts.slice(1).join(':').trim();
        }
    }

    return reason;
};
