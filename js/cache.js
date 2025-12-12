/**
 * Smart Caching System with Hash-based Validation
 * Improves load times by caching Google Sheets data and only fetching when changes are detected
 */

const Cache = {
    // Simple hash function for data comparison
    hashData: (data) => {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    },

    // Get cached data if valid
    get: (key) => {
        try {
            const cached = localStorage.getItem(`cache_${key}`);
            if (!cached) return null;

            const { data, hash, timestamp } = JSON.parse(cached);

            // Optional: Add expiration check (e.g., 24 hours)
            const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
            if (Date.now() - timestamp > MAX_AGE) {
                console.log(`Cache expired for ${key}`);
                return null;
            }

            console.log(`✓ Cache hit for ${key}`);
            return { data, hash };
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    },

    // Store data with its hash
    set: (key, data) => {
        try {
            const hash = Cache.hashData(data);
            const cacheEntry = {
                data,
                hash,
                timestamp: Date.now()
            };
            localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
            console.log(`✓ Cached ${key} with hash ${hash}`);
            return hash;
        } catch (error) {
            console.error('Cache write error:', error);
            // Handle localStorage quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded, clearing old cache...');
                Cache.clear();
                // Try again after clearing
                try {
                    const hash = Cache.hashData(data);
                    const cacheEntry = { data, hash, timestamp: Date.now() };
                    localStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
                    return hash;
                } catch (e) {
                    console.error('Failed to cache even after clearing:', e);
                }
            }
            return null;
        }
    },

    // Check if remote data has changed
    hasChanged: (key, newData) => {
        const cached = Cache.get(key);
        if (!cached) return true; // No cache = assume changed

        const newHash = Cache.hashData(newData);
        const changed = cached.hash !== newHash;

        if (changed) {
            console.log(`✗ Data changed for ${key} (old: ${cached.hash}, new: ${newHash})`);
        } else {
            console.log(`✓ Data unchanged for ${key} (${newHash})`);
        }

        return changed;
    },

    // Clear all cache
    clear: () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
        keys.forEach(k => localStorage.removeItem(k));
        console.log(`Cleared ${keys.length} cache entries`);
    },

    // Get cache info
    getInfo: () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
        return keys.map(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                return {
                    key: key.replace('cache_', ''),
                    hash: data.hash,
                    timestamp: new Date(data.timestamp).toLocaleString(),
                    size: new Blob([localStorage.getItem(key)]).size
                };
            } catch (e) {
                return null;
            }
        }).filter(Boolean);
    }
};
