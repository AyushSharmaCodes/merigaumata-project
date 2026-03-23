/**
 * Flattens a nested object into a single level object with dot notation keys.
 * Handles arrays by joining them with a separator.
 * 
 * @param {Object} obj - The object to flatten
 * @param {String} prefix - The prefix to add to keys
 * @returns {Object} - The flattened object
 */
const flattenObject = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, key) => {
        const pre = prefix.length ? `${prefix}_` : '';
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(acc, flattenObject(value, pre + key));
        } else if (Array.isArray(value)) {
            acc[pre + key] = value.join('; ');
        } else {
            acc[pre + key] = value;
        }
        return acc;
    }, {});
};

module.exports = { flattenObject };
