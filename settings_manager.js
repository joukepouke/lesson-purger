/**
 * Manages application settings using localStorage.
 * This class is designed to be shared between different pages.
 */
class SettingsManager {
    constructor() {
        this.defaultSettings = {
            theme: 'dark',
            customTheme: {
                '--bg': '#1a1a1a',
                '--text': '#e0e0e0',
                '--accent': '#7f5af0',
                '--accent-secondary': '#2cb67d',
                '--card-bg': '#252525',
                '--border-color': '#333',
            },
            display: {
                heroDecimals: 1,
            },
            deletedLessons: [],
            dev: {
                enabled: false,
                timeLoop: { enabled: false, duration: 60 },
            },
            statCards: {
                currentLesson: {
                    id: 'currentLesson', title: 'Current Segment', type: 'segment', enabled: true,
                    units: [
                        { type: 'progress', unit: 'percent', decimals: 1 },
                        { type: 'elapsed', unit: 'minutes_seconds', decimals: 0 },
                        { type: 'remaining', unit: 'minutes_seconds', decimals: 0 },
                        { type: 'end', unit: 'time_hh_mm', decimals: 0 },
                    ]
                },
                currentPhase: {
                    id: 'currentPhase', title: 'Current Phase', type: 'phase', enabled: true,
                    units: [
                        { type: 'progress', unit: 'percent', decimals: 2 },
                        { type: 'elapsed', unit: 'minutes_decimal', decimals: 1 },
                        { type: 'remaining', unit: 'minutes_decimal', decimals: 1 },
                        { type: 'total', unit: 'minutes_decimal', decimals: 0 },
                    ]
                },
                dayProgress: {
                    id: 'dayProgress', title: 'Day Progress', type: 'day', enabled: true,
                    units: [
                        { type: 'progress', unit: 'percent', decimals: 2 },
                        { type: 'elapsed', unit: 'hours_decimal', decimals: 2 },
                        { type: 'remaining', unit: 'hours_decimal', decimals: 2 },
                        { type: 'total', unit: 'hours_decimal', decimals: 1 },
                    ]
                },
                weekProgress: {
                    id: 'weekProgress', title: 'Week Progress', type: 'week', enabled: true,
                    units: [
                        { type: 'progress', unit: 'percent', decimals: 1 },
                        { type: 'elapsed', unit: 'hours_decimal', decimals: 1 },
                        { type: 'remaining', unit: 'hours_decimal', decimals: 1 },
                    ]
                },
                termProgress: {
                    id: 'termProgress', title: 'Term Progress', type: 'term', enabled: true,
                    units: [
                        { type: 'progress', unit: 'percent', decimals: 1 },
                        { type: 'elapsed', unit: 'days_decimal', decimals: 0 },
                        { type: 'remaining', unit: 'days_decimal', decimals: 0 },
                    ]
                },
                yearProgress: {
                    id: 'yearProgress', title: 'Year Progress', type: 'year', enabled: true,
                    units: [
                        { type: 'progress', unit: 'percent', decimals: 1 },
                        { type: 'elapsed', unit: 'days_decimal', decimals: 0 },
                        { type: 'remaining', unit: 'days_decimal', decimals: 0 },
                    ]
                }
            }
        };
        const loadedSettings = this.load();
        this.settings = this.deepMerge(this.defaultSettings, loadedSettings || {});
        this.save();
    }

    deepMerge(target, source) {
        const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);
        const output = { ...target };

        Object.keys(source).forEach(key => {
            const targetValue = output[key];
            const sourceValue = source[key];
            if (isObject(targetValue) && isObject(sourceValue)) {
                output[key] = this.deepMerge(targetValue, sourceValue);
            } else if (sourceValue !== undefined) {
                output[key] = sourceValue;
            }
        });
        return output;
    }

    load() {
        try {
            const stored = localStorage.getItem('schoolDayTrackerSettings');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error("Failed to load settings from localStorage", e);
            return null;
        }
    }

    save() {
        try {
            localStorage.setItem('schoolDayTrackerSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.error("Failed to save settings to localStorage", e);
        }
    }



    get(key) {
        return key.split('.').reduce((o, i) => (o ? o[i] : undefined), this.settings);
    }

    getDefault(key) {
        return key.split('.').reduce((o, i) => (o ? o[i] : undefined), this.defaultSettings);
    }
    
    getAll() {
        return this.settings;
    }

    set(path, value) {
        let schema = this.settings;
        const pList = path.split('.');
        const len = pList.length;
        for (let i = 0; i < len - 1; i++) {
            const elem = pList[i];
            if (schema[elem] === undefined) schema[elem] = {};
            schema = schema[elem];
        }
        schema[pList[len - 1]] = value;
        this.save();
        window.dispatchEvent(new Event('settings-updated'));
    }
}
