class SettingsPage {
    constructor() {
        this.settingsManager = new SettingsManager();
        this.dom = {
            body: document.getElementById('settings-body'),
            resetAllBtn: document.getElementById('reset-all-settings'),
        };

        // --- Data Definitions ---
        this.UNIT_DEFINITIONS = {
            'percent': { label: 'Percentage (%)', supportsDecimals: true },
            'minutes_decimal': { label: 'Minutes (decimal)', supportsDecimals: true },
            'hours_decimal': { label: 'Hours (decimal)', supportsDecimals: true },
            'minutes_seconds': { label: 'Duration (MM:SS)', supportsDecimals: false },
            'time_hh_mm': { label: 'Time (HH:MM)', supportsDecimals: false },
        };
        
        this.STAT_UNIT_MAP = {
            progress: ['percent'],
            elapsed: ['minutes_seconds', 'minutes_decimal', 'hours_decimal'],
            remaining: ['minutes_seconds', 'minutes_decimal', 'hours_decimal'],
            total: ['minutes_seconds', 'minutes_decimal', 'hours_decimal'],
            start: ['time_hh_mm'],
            end: ['time_hh_mm'],
            none: [],
        };

        this.render();
        this.attachGlobalEventListeners();
    }

    render() {
        const { statCards, dev, theme, customTheme, display } = this.settingsManager.getAll();
        
        let html = '';

        // --- Theme Settings ---
        html += `
            <div class="settings-section">
                <h3>Theme</h3>
                <div class="settings-grid">
                    ${this.renderSettingItem(
                        'Current Theme',
                        `<select id="theme-select" data-setting="theme">
                            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
                            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
                            <option value="ocean" ${theme === 'ocean' ? 'selected' : ''}>Ocean</option>
                            <option value="custom" ${theme === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>`,
                        'theme'
                    )}
                </div>
                <div id="custom-theme-settings" class="settings-grid" style="display: ${theme === 'custom' ? 'grid' : 'none'}; margin-top: 1rem;">
                    ${Object.entries(customTheme).map(([key, value]) => `
                        <div class="setting-item color-picker-item">
                            <label for="custom-${key}">${key}</label>
                            <input type="color" id="custom-${key}" data-setting="customTheme.${key}" value="${value}">
                            <span>${value}</span>
                             ${this.renderResetButton(`customTheme.${key}`)}
                        </div>
                    `).join('')}
                </div>
            </div>`;
        
        // --- Display Settings ---
        html += `
            <div class="settings-section">
                <h3>Display</h3>
                <div class="settings-grid">
                    ${this.renderSettingItem(
                        'Hero Remaining Time Decimals',
                        `<input type="number" min="0" max="3" value="${display.heroDecimals}" data-setting="display.heroDecimals">`,
                        'display.heroDecimals'
                    )}
                </div>
            </div>`;

        // --- Stat Card Settings ---
        html += Object.entries(statCards).map(([id, config]) => `
            <div class="settings-section">
                <h3>
                    ${config.title}
                    <label class="switch">
                        <input type="checkbox" data-setting="statCards.${id}.enabled" ${config.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </h3>
                <div class="settings-grid">
                    ${config.units.map((unit, index) => this.renderUnitSetting(id, index, unit)).join('')}
                </div>
            </div>`
        ).join('');
            
        // --- Dev Tools Settings ---
        html += `
            <div class="settings-section">
                <h3>
                    Developer Tools
                     <label class="switch">
                        <input type="checkbox" data-setting="dev.enabled" ${dev.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </h3>
                <div class="settings-grid">
                     <div class="setting-item">
                        <label>Loop Time</label>
                        <div class="setting-row">
                            <label class="switch">
                                <input type="checkbox" data-setting="dev.timeLoop.enabled" ${dev.timeLoop.enabled ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                             ${this.renderResetButton('dev.timeLoop.enabled')}
                        </div>
                    </div>
                     <div class="setting-item">
                        <label for="dev-loop-duration">Loop Duration (seconds)</label>
                         <div class="setting-row">
                            <input type="number" id="dev-loop-duration" data-setting="dev.timeLoop.duration" value="${dev.timeLoop.duration}">
                            ${this.renderResetButton('dev.timeLoop.duration')}
                        </div>
                    </div>
                </div>
            </div>`;

        this.dom.body.innerHTML = html;
        this.attachSettingEventListeners();
    }

    renderSettingItem(label, inputHtml, settingPath) {
        return `
            <div class="setting-item">
                <label>${label}</label>
                <div class="setting-row">
                    ${inputHtml}
                    ${this.renderResetButton(settingPath)}
                </div>
            </div>
        `;
    }
    
    renderResetButton(settingPath) {
        return `<button class="reset-btn" title="Reset to default" data-reset-path="${settingPath}">↺</button>`;
    }

    renderUnitSetting(cardId, index, unitConfig) {
        const statTypes = Object.keys(this.STAT_UNIT_MAP);
        const validUnitsForCurrentType = this.STAT_UNIT_MAP[unitConfig.type] || [];
        const currentUnitInfo = this.UNIT_DEFINITIONS[unitConfig.unit];
        const showDecimals = currentUnitInfo?.supportsDecimals ?? false;

        return `
        <div class="setting-item unit-setting">
            <label>Unit ${index + 1}</label>
            <div class="setting-row">
                <select data-setting="statCards.${cardId}.units.${index}.type" data-path="statCards.${cardId}.units.${index}">
                    ${statTypes.map(type => `<option value="${type}" ${unitConfig.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                </select>
                ${this.renderResetButton(`statCards.${cardId}.units.${index}.type`)}
            </div>
            <div class="setting-row">
                <select data-setting="statCards.${cardId}.units.${index}.unit">
                    ${validUnitsForCurrentType.map(unitValue => `
                        <option value="${unitValue}" ${unitConfig.unit === unitValue ? 'selected' : ''}>
                            ${this.UNIT_DEFINITIONS[unitValue].label}
                        </option>
                    `).join('')}
                </select>
                ${this.renderResetButton(`statCards.${cardId}.units.${index}.unit`)}
            </div>
            <div class="setting-row" style="display: ${showDecimals ? 'flex' : 'none'}">
                <input type="number" min="0" max="5" placeholder="Decimals" value="${unitConfig.decimals}" data-setting="statCards.${cardId}.units.${index}.decimals">
                ${this.renderResetButton(`statCards.${cardId}.units.${index}.decimals`)}
            </div>
        </div>`;
    }

    attachGlobalEventListeners() {
        this.dom.resetAllBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all settings to their defaults? This cannot be undone.")) {
                localStorage.removeItem('schoolDayTrackerSettings');
                window.location.reload();
            }
        });
    }

    attachSettingEventListeners() {
        this.dom.body.addEventListener('change', e => {
            const target = e.target;
            const settingPath = target.dataset.setting;
            if (!settingPath) return;

            const value = target.type === 'checkbox' ? target.checked : (target.type === 'number' ? parseFloat(target.value) : target.value);
            this.settingsManager.set(settingPath, value);

            if (settingPath.endsWith('.type')) {
                const newType = value;
                const validUnits = this.STAT_UNIT_MAP[newType];
                if (validUnits && validUnits.length > 0) {
                    const basePath = settingPath.substring(0, settingPath.lastIndexOf('.'));
                    this.settingsManager.set(`${basePath}.unit`, validUnits[0]);
                }
                this.render(); 
                return;
            }
            if (settingPath.endsWith('.unit')) {
                this.render();
            }
            if (settingPath === 'theme') {
                this.applyTheme();
                document.getElementById('custom-theme-settings').style.display = (value === 'custom') ? 'grid' : 'none';
            }
            if (settingPath.startsWith('customTheme')) {
                this.applyTheme();
            }
        });

        this.dom.body.addEventListener('input', e => {
            const target = e.target;
            const settingPath = target.dataset.setting;
            if (!settingPath || target.type !== 'number' && target.type !== 'color') return;

            const value = target.type === 'color' ? target.value : parseFloat(target.value);
            if (!isNaN(value)) {
                 this.settingsManager.set(settingPath, value);
            }
            if (target.type === 'color') {
                target.nextElementSibling.textContent = value;
                this.applyTheme();
            }
        });
        
        this.dom.body.addEventListener('click', e => {
            if (e.target.matches('[data-reset-path]')) {
                const path = e.target.dataset.resetPath;
                const defaultValue = this.settingsManager.getDefault(path);
                this.settingsManager.set(path, defaultValue);
                this.render();
                this.applyTheme();
            }
        });
    }

    applyTheme() {
        const theme = this.settingsManager.get('theme');
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'custom') {
            const customTheme = this.settingsManager.get('customTheme');
            let customStyle = document.getElementById('custom-theme-style');
            if (!customStyle) {
                customStyle = document.createElement('style');
                customStyle.id = 'custom-theme-style';
                document.head.appendChild(customStyle);
            }
            const customColors = Object.entries(customTheme)
                .map(([key, value]) => `${key}: ${value};`).join(' ');
            customStyle.innerHTML = `:root[data-theme="custom"] { ${customColors} }`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SettingsPage();
});
