/**
 * Main application class. Orchestrates all modules.
 */
class SchoolDayTracker {
    constructor() {
        this.settingsManager = new SettingsManager();
        this.timeManager = new TimeManager();
        this.scheduleManager = new ScheduleManager();
        this.uiManager = new UIManager(
            this.scheduleManager,
            this.timeManager,
            (lessonId) => {
                this.scheduleManager.toggleLesson(lessonId);
                this.settingsManager.set('deletedLessons', Array.from(this.scheduleManager.deletedLessons));
                this.handleSettingsUpdate();
            }
        );

        window.addEventListener('storage', (e) => {
            if (e.key === 'schoolDayTrackerSettings') this.handleSettingsUpdate();
        });
        window.addEventListener('settings-updated', this.handleSettingsUpdate.bind(this));

        this.init();
    }

    init() {
        this.handleSettingsUpdate();
        this.updateLoop();
    }

    handleSettingsUpdate() {
        this.settingsManager = new SettingsManager(); // Reload settings
        const allSettings = this.settingsManager.getAll();
        this.timeManager.updateSettings(allSettings.dev);
        this.scheduleManager.recalculate(allSettings.deletedLessons);
        this.uiManager.renderAll(
            this.scheduleManager.getScheduleData(), 
            allSettings.statCards,
            allSettings.dev
        );
    }

    updateLoop() {
        const now = this.timeManager.getNow();
        const scheduleData = this.scheduleManager.getScheduleData(now);
        this.uiManager.update(now, scheduleData, this.settingsManager.get('display'));
        requestAnimationFrame(this.updateLoop.bind(this));
    }
}

/**
 * Manages time, including development features like jumps and speed multipliers.
 */
class TimeManager {
    constructor() {
        this.timeJumpOffsetMs = 0;
        this.speedInducedOffsetMs = 0;
        this.timeSpeedMultiplier = 1;
        this.lastSpeedUpdateTimestamp = Date.now();
        this.timeLoop = { enabled: false, duration: 60, startTime: null };
    }

    updateSettings(devSettings) {
        this.timeLoop = { ...this.timeLoop, ...devSettings.timeLoop };
        if (this.timeLoop.enabled && !this.timeLoop.startTime) {
            this.timeLoop.startTime = Date.now();
            this.setSpeed(1); // Speed controls are mutually exclusive with loop
        } else if (!this.timeLoop.enabled) {
            this.timeLoop.startTime = null;
        }
    }

    jumpTime(minutes) {
        this.timeJumpOffsetMs += minutes * 60 * 1000;
    }
    
    setSpeed(multiplier) {
        // First, apply the offset accumulated with the old speed
        this.updateSpeedOffset();
        // Then, set the new speed
        this.timeSpeedMultiplier = multiplier;
    }

    updateSpeedOffset() {
        const now = Date.now();
        const realTimeDelta = now - this.lastSpeedUpdateTimestamp;
        
        if (realTimeDelta > 0) {
            // The change in offset is the difference between virtual time passed and real time passed
            const offsetDelta = realTimeDelta * (this.timeSpeedMultiplier - 1);
            this.speedInducedOffsetMs += offsetDelta;
            this.lastSpeedUpdateTimestamp = now;
        }
    }

    getNow() {
        if (!this.timeLoop.enabled) {
            this.updateSpeedOffset();
        }

        const baseTime = Date.now() + this.timeJumpOffsetMs + this.speedInducedOffsetMs;
        
        if (this.timeLoop.enabled) {
            const dayStartMinutes = 8 * 60 + 15;
            const dayEndMinutes = 16 * 60;
            const dayDurationMinutes = dayEndMinutes - dayStartMinutes;
            const loopDurationMs = this.timeLoop.duration * 1000;
            const elapsedMs = (baseTime - this.timeLoop.startTime) % loopDurationMs;
            const progress = elapsedMs / loopDurationMs;

            const virtualMinutesIntoDay = dayStartMinutes + (progress * dayDurationMinutes);
            const virtualDate = new Date();
            virtualDate.setHours(Math.floor(virtualMinutesIntoDay / 60), Math.floor(virtualMinutesIntoDay % 60), Math.floor((virtualMinutesIntoDay * 60) % 60), 0);
            return virtualDate;
        }
        return new Date(baseTime);
    }
}

/**
 * Manages schedule data, calculations, and active lessons.
 */
class ScheduleManager {
    constructor() {
        this.originalSchedule = [
            { id: 1, start: "8:15", end: "9:00" }, { id: 2, start: "9:05", end: "9:50" },
            { id: 3, start: "10:10", end: "10:55" }, { id: 4, start: "11:00", end: "11:45" },
            { id: 5, start: "12:30", end: "13:15" }, { id: 6, start: "13:20", end: "14:05" },
            { id: 7, start: "14:25", end: "15:10" }, { id: 8, start: "15:15", end: "16:00" }
        ].map(lesson => ({
            ...lesson,
            startMinutes: this.timeToMinutes(lesson.start),
            endMinutes: this.timeToMinutes(lesson.end)
        }));
        this.deletedLessons = new Set();
        this.timeSegments = [];
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    toggleLesson(lessonId) {
        this.deletedLessons.has(lessonId)
            ? this.deletedLessons.delete(lessonId)
            : this.deletedLessons.add(lessonId);
    }

    recalculate(deletedLessonIds = []) {
        this.deletedLessons = new Set(deletedLessonIds);
        const activeLessons = this.originalSchedule.filter(lesson => !this.deletedLessons.has(lesson.id));
        this.timeSegments = [];
        let phases = [];
        let currentPhaseLessons = [];
        for (let i = 0; i < activeLessons.length; i++) {
            if (i > 0 && activeLessons[i].startMinutes - activeLessons[i-1].endMinutes > 5) {
                phases.push([...currentPhaseLessons]);
                currentPhaseLessons = [];
            }
            currentPhaseLessons.push(activeLessons[i]);
        }
        if (currentPhaseLessons.length > 0) phases.push([...currentPhaseLessons]);
        phases.forEach(phaseLessons => {
            const phaseStart = phaseLessons[0].startMinutes;
            const phaseEnd = phaseLessons[phaseLessons.length - 1].endMinutes;
            phaseLessons.forEach((lesson, index) => {
                this.timeSegments.push({ type: 'lesson', start: lesson.startMinutes, end: lesson.endMinutes, phaseStart, phaseEnd });
                if (index < phaseLessons.length - 1) {
                    this.timeSegments.push({ type: 'break', start: lesson.endMinutes, end: phaseLessons[index + 1].startMinutes, phaseStart, phaseEnd });
                }
            });
        });
    }

    getScheduleData(now = new Date()) {
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
        const totalDayDuration = this.timeSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
        let elapsedDayDuration = 0;
        this.timeSegments.forEach(segment => {
            if (currentTotalMinutes >= segment.start) {
                elapsedDayDuration += Math.min(segment.end, currentTotalMinutes) - segment.start;
            }
        });
        const currentSegment = this.timeSegments.find(seg => currentTotalMinutes >= seg.start && currentTotalMinutes < seg.end) || null;
        const currentPhase = currentSegment ? { start: currentSegment.phaseStart, end: currentSegment.phaseEnd } : null;
        return { originalSchedule: this.originalSchedule, deletedLessons: this.deletedLessons, currentSegment, currentPhase, day: { total: totalDayDuration, elapsed: elapsedDayDuration, }, currentTotalMinutes };
    }
}

/**
 * Manages all DOM interactions and rendering for the main page.
 */
class UIManager {
    constructor(scheduleManager, timeManager, toggleLessonCallback) {
        this.scheduleManager = scheduleManager;
        this.timeManager = timeManager;
        this.toggleLessonCallback = toggleLessonCallback;
        this.dom = {
            container: document.querySelector('.container'),
            currentTime: document.getElementById('current-time'),
            heroInfo: document.getElementById('hero-info'),
            scheduleContainer: document.getElementById('schedule'),
            statGrid: document.getElementById('stat-grid'),
        };
        this.statCards = {};
    }

    renderAll(scheduleData, statCardConfigs, devSettings) {
        this.renderScheduleList(scheduleData);
        this.renderStatCards(statCardConfigs);
        this.renderDevControls(devSettings);
    }
    
    update(now, scheduleData, displaySettings) {
        this.dom.currentTime.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0').slice(0, 2)}`;
        const { currentSegment, currentTotalMinutes } = scheduleData;
        if(currentSegment) {
            const remaining = currentSegment.end - currentTotalMinutes;
            this.dom.heroInfo.textContent = `ENDS AT ${this.formatMinutes(currentSegment.end)} (${this.formatDuration(remaining, displaySettings.heroDecimals)} left)`;
        } else {
            this.dom.heroInfo.textContent = 'School day is over or hasn\'t started.';
        }
        Object.values(this.statCards).forEach(card => card.update(scheduleData));
    }

    renderScheduleList({ originalSchedule, deletedLessons }) {
        this.dom.scheduleContainer.innerHTML = originalSchedule.map(lesson => `
            <div class="lesson-item ${deletedLessons.has(lesson.id) ? 'ghost' : ''}">
                <label class="checkbox-container">
                    <input type="checkbox" data-lesson-id="${lesson.id}" ${!deletedLessons.has(lesson.id) ? 'checked' : ''}>
                    <div class="checkbox-custom"></div>
                    ${this.formatTime(lesson.start)} - ${this.formatTime(lesson.end)}
                </label>
            </div>
        `).join('');
        this.dom.scheduleContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.toggleLessonCallback(parseInt(e.target.dataset.lessonId, 10)));
        });
    }

    renderStatCards(statConfigs) {
        this.dom.statGrid.innerHTML = '';
        this.statCards = {};
        Object.entries(statConfigs).forEach(([id, config]) => {
            if (!config.enabled) return;
            const cardElement = document.createElement('div');
            cardElement.className = 'stat-card';
            cardElement.id = id;
            cardElement.innerHTML = `<h3>${config.title}</h3><div class="progress-bar"><div class="progress-fill"></div></div><div class="time-units"></div>`;
            this.dom.statGrid.appendChild(cardElement);
            this.statCards[id] = new StatCard(cardElement, config, this);
        });
    }
    
    renderDevControls(devSettings) {
        let controls = document.getElementById('dev-controls');
        if (devSettings.enabled) {
            if (!controls) {
                controls = document.createElement('div');
                controls.id = 'dev-controls';
                controls.className = 'dev-controls';
                this.dom.container.appendChild(controls);
            }
            const speeds = [-360, -60, -8, 1, 8, 60, 360];
            const activeSpeed = this.timeManager.timeSpeedMultiplier;
            const isLooping = devSettings.timeLoop.enabled;

            controls.innerHTML = `
                <div class="dev-group">
                    <button data-jump="-60" title="Jump back 1 hour">« -1h</button>
                    <button data-jump="-10" title="Jump back 10 minutes">‹ -10m</button>
                    <button data-jump="10" title="Jump forward 10 minutes">+10m ›</button>
                    <button data-jump="60" title="Jump forward 1 hour">+1h »</button>
                </div>
                <div class="dev-divider"></div>
                <div class="dev-group">
                    ${speeds.map(speed => `
                        <button 
                            data-speed="${speed}" 
                            class="${speed === activeSpeed ? 'active' : ''}"
                            title="${speed}x speed"
                            ${isLooping && speed !== 1 ? 'disabled' : ''}
                        >
                            ${speed > 0 ? `x${speed}` : `x-${Math.abs(speed)}`}
                        </button>
                    `).join('')}
                </div>
            `;
            // Attach Jump Listeners
            controls.querySelectorAll('button[data-jump]').forEach(btn => {
                btn.onclick = () => this.timeManager.jumpTime(parseInt(btn.dataset.jump, 10));
            });
            // Attach Speed Listeners
            controls.querySelectorAll('button[data-speed]').forEach(btn => {
                btn.onclick = () => {
                    this.timeManager.setSpeed(parseInt(btn.dataset.speed, 10));
                    this.renderDevControls(devSettings); // Re-render to update active state
                };
            });
        } else if (controls) {
            controls.remove();
        }
    }

    formatMinutes(totalMinutes) {
        if(isNaN(totalMinutes)) return '--:--';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    formatDuration(totalMinutes, decimals = 0) {
        if (isNaN(totalMinutes)) return '--:--';
        const sign = totalMinutes < 0 ? '-' : '';
        const absMinutes = Math.abs(totalMinutes);
        const totalSeconds = absMinutes * 60;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        if (decimals > 0) {
            const secondsFormatted = seconds.toFixed(decimals).padStart(2 + decimals + 1, '0');
            return `${sign}${String(minutes).padStart(2, '0')}:${secondsFormatted}`;
        }
        return `${sign}${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds)).padStart(2, '0')}`;
    }
    
    formatTime(timeStr) {
        return this.formatMinutes(this.scheduleManager.timeToMinutes(timeStr));
    }
}

/**
 * Represents and manages a single statistics card in the UI.
 */
class StatCard {
    constructor(element, config, uiManager) {
        this.element = element;
        this.config = config;
        this.uiManager = uiManager;
        this.progressFill = element.querySelector('.progress-fill');
        this.unitsContainer = element.querySelector('.time-units');
    }

    update(scheduleData) {
        const data = this.getDataForType(scheduleData);
        if (!data) {
            this.progressFill.style.width = '0%';
            this.unitsContainer.innerHTML = '';
            return;
        }

        const progress = data.total > 0 ? (data.elapsed / data.total) * 100 : 0;
        this.progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;

        this.unitsContainer.innerHTML = this.config.units.map(unitConfig => {
            const value = this.getUnitValue(unitConfig, data);
            return value ? `<div class="unit-box"><div class="unit-label">${unitConfig.type}</div><div class="unit-value">${value}</div></div>` : '';
        }).join('');
    }

    getDataForType(scheduleData) {
        switch (this.config.type) {
            case 'segment':
                if (!scheduleData.currentSegment) return null;
                return {
                    start: scheduleData.currentSegment.start,
                    end: scheduleData.currentSegment.end,
                    elapsed: scheduleData.currentTotalMinutes - scheduleData.currentSegment.start,
                    total: scheduleData.currentSegment.end - scheduleData.currentSegment.start,
                };
            case 'phase':
                if (!scheduleData.currentPhase) return null;
                return {
                    start: scheduleData.currentPhase.start,
                    end: scheduleData.currentPhase.end,
                    elapsed: scheduleData.currentTotalMinutes - scheduleData.currentPhase.start,
                    total: scheduleData.currentPhase.end - scheduleData.currentPhase.start,
                };
            case 'day':
                return {
                    elapsed: scheduleData.day.elapsed,
                    total: scheduleData.day.total,
                };
            case 'week': {
                const now = new Date();
                const today = now.getDay(); // 0 = Sunday, 1 = Monday...
                const monday = new Date(now);
                monday.setDate(now.getDate() - (today === 0 ? 6 : today - 1));
                monday.setHours(0,0,0,0);
                
                const friday = new Date(monday);
                friday.setDate(monday.getDate() + 4);
                friday.setHours(23,59,59,999);
                
                const totalWeekMinutes = 5 * 8 * 60; // 5 days * 8 hours * 60 minutes
                const elapsedToday = scheduleData.day.elapsed;
                const elapsedDays = Math.min(4, (today < 1 || today > 5 ? 0 : today - 1)); // 0-4
                const elapsedMinutes = (elapsedDays * 8 * 60) + (today >= 1 && today <= 5 ? elapsedToday : 0);
                
                return {
                    start: monday,
                    end: friday,
                    elapsed: elapsedMinutes,
                    total: totalWeekMinutes
                };
            }
            case 'term': {
                const now = new Date();
                // Define term periods based on Dutch school holidays 2024-2025
                const terms = [
                    {start: new Date('2025-08-26'), end: new Date('2025-10-18')}, // Until Herfstvakantie
                    {start: new Date('2025-10-27'), end: new Date('2025-12-20')}, // Until Kerstvakantie
                    {start: new Date('2026-01-05'), end: new Date('2026-02-21')}, // Until Voorjaarsvakantie
                    {start: new Date('2026-03-02'), end: new Date('2026-04-22')}, // Until Meivakantie
                    {start: new Date('2026-05-06'), end: new Date('2026-07-04')}  // End of year
                ];
                
                const currentTerm = terms.find(t => now >= t.start && now <= t.end) || terms[0];
                const totalTermMs = currentTerm.end - currentTerm.start;
                const elapsedTermMs = now - currentTerm.start;
                
                return {
                    start: currentTerm.start,
                    end: currentTerm.end,
                    elapsed: elapsedTermMs / 1000 / 60, // Convert ms to minutes
                    total: totalTermMs / 1000 / 60
                };
            }
            case 'year': {
                const yearStart = new Date('2025-08-24');
                const yearEnd = new Date('2026-07-04');
                const now = new Date();
                
                const totalYearMs = yearEnd - yearStart;
                const elapsedYearMs = now - yearStart;
                
                return {
                    start: yearStart,
                    end: yearEnd,
                    elapsed: elapsedYearMs / 1000 / 60, // Convert ms to minutes
                    total: totalYearMs / 1000 / 60
                };
            }
            default:
                return null;
        }
    }

    getUnitValue(unitConfig, data) {
        let rawValue;
        switch (unitConfig.type) {
            case 'progress': 
                rawValue = data.total > 0 ? (data.elapsed / data.total) * 100 : 0;
                break;
            case 'elapsed': rawValue = data.elapsed; break;
            case 'remaining': rawValue = data.total - data.elapsed; break;
            case 'total': rawValue = data.total; break;
            case 'start': rawValue = data.start; break;
            case 'end': rawValue = data.end; break;
            case 'none': return null;
            default: return null;
        }

        if (typeof rawValue !== 'number' || isNaN(rawValue)) return '...';

        switch (unitConfig.unit) {
            case 'percent': return `${rawValue.toFixed(unitConfig.decimals)}%`;
            case 'minutes_decimal': return `${rawValue.toFixed(unitConfig.decimals)}m`;
            case 'hours_decimal': return `${(rawValue / 60).toFixed(unitConfig.decimals)}h`;
            case 'minutes_seconds': return this.uiManager.formatDuration(rawValue, unitConfig.decimals);
            case 'minutes_seconds_decimal': 
                return this.uiManager.formatDuration(rawValue, unitConfig.decimals);
            case 'seconds_decimal': 
                return `${(rawValue * 60).toFixed(unitConfig.decimals)}s`;
            case 'time_hh_mm': return this.uiManager.formatMinutes(rawValue);
            default: return null;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => { new SchoolDayTracker(); });
