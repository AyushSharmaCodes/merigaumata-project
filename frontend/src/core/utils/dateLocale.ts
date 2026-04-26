import { enUS, hi } from 'date-fns/locale';
import i18n from 'i18next';

const localeMap: { [key: string]: any } = {
    en: enUS,
    hi: hi,
};

export const getDateLocale = () => {
    const lang = i18n.language || 'en';
    // Handle cases like 'en-US' by taking the first part
    const shortLang = lang.split('-')[0];
    return localeMap[shortLang] || enUS;
};
