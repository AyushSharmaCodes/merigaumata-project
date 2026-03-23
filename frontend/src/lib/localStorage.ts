// LocalStorage wrapper for non-sensitive data only
// Sensitive data (tokens, user PII) should be handled via HttpOnly cookies or memory.

export const storage = {
    getItem: (key: string) => {
        return localStorage.getItem(key);
    },
    setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        localStorage.removeItem(key);
    },
    clear: () => {
        // Be careful clearing everything if other apps usage share domain (unlikely for localhost)
        localStorage.clear();
    },

    // Specific non-sensitive helpers
    getLanguage: () => localStorage.getItem('language') || 'en',
    setLanguage: (lng: string) => localStorage.setItem('language', lng),

    getTheme: () => localStorage.getItem('theme'),
    setTheme: (theme: string) => localStorage.setItem('theme', theme),
};
