class ScheduleManager {
    constructor() {
        this.originalSchedule = [
            { id: 1, start: "8:15", end: "9:00" },
            { id: 2, start: "9:05", end: "9:50" },
            { id: 3, start: "10:10", end: "10:55" },
            { id: 4, start: "11:00", end: "11:45" },
            { id: 5, start: "12:30", end: "13:15" },
            { id: 6, start: "13:20", end: "14:05" },
            { id: 7, start: "14:25", end: "15:10" },
            { id: 8, start: "15:15", end: "16:00" }
        ];
        
        this.deletedLessons = new Set();
        this.cachedPhases = [];
        this.lastUpdate = 0;
        this.init();
    }

    init() {
        this.recalculateSchedule();
        this.renderScheduleList();
        requestAnimationFrame(() => this.update());
    }

    recalculateSchedule() {
        if (Date.now() - this.lastUpdate < 1000) return;
        
        const activeLessons = this.originalSchedule.filter(lesson => 
            !this.deletedLessons.has(lesson.id)
        );
        
        this.cachedPhases = [];
        let currentPhase = [];
        
        for (let i = 0; i < activeLessons.length; i++) {
            if (i > 0) {
                const prevEnd = this.timeToMinutes(activeLessons[i-1].end);
                const currStart = this.timeToMinutes(activeLessons[i].start);
                if (currStart - prevEnd > 5) {
                    this.cachedPhases.push([...currentPhase]);
                    currentPhase = [];
                }
            }
            currentPhase.push(activeLessons[i]);
        }
        
        if (currentPhase.length > 0) {
            this.cachedPhases.push(currentPhase);
        }
        
        this.lastUpdate = Date.now();
    }

    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    formatMinutes(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    toggleLesson(lessonId) {
        if (this.deletedLessons.has(lessonId)) {
            this.deletedLessons.delete(lessonId);
        } else {
            this.deletedLessons.add(lessonId);
        }
        this.recalculateSchedule();
        this.renderScheduleList();
    }

    renderScheduleList() {
        const container = document.getElementById('schedule');
        container.innerHTML = this.originalSchedule.map(lesson => `
            <div class="lesson-item ${this.deletedLessons.has(lesson.id) ? 'ghost' : ''}">
                <input type="checkbox" 
                    ${this.deletedLessons.has(lesson.id) ? 'checked' : ''}
                    onchange="schedule.toggleLesson(${lesson.id})">
                ${this.formatMinutes(this.timeToMinutes(lesson.start))} - 
                ${this.formatMinutes(this.timeToMinutes(lesson.end))}
            </div>
        `).join('');
    }

    update() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        // Update time displays
        document.getElementById('current-time').textContent = 
            now.toLocaleTimeString('en-GB', { hour12: false });
            
        // Update statistics and progress bars
        this.updateStatistics(currentMinutes);
        
        requestAnimationFrame(() => this.update());
    }

    updateStatistics(currentMinutes) {
        let currentBlock = null;
        let dayProgress = 0;
        let totalDayDuration = 0;
        
        // Calculate all time segments
        const timeSegments = [];
        this.cachedPhases.forEach(phase => {
            phase.forEach((lesson, index) => {
                const start = this.timeToMinutes(lesson.start);
                const end = this.timeToMinutes(lesson.end);
                timeSegments.push({ type: 'lesson', start, end });
                
                if (index < phase.length - 1) {
                    const nextStart = this.timeToMinutes(phase[index+1].start);
                    timeSegments.push({ type: 'break', start: end, end: nextStart });
                }
            });
        });

        // Find current segment and calculate progress
        let currentSegment = null;
        for (const segment of timeSegments) {
            totalDayDuration += segment.end - segment.start;
            
            if (currentMinutes >= segment.start && currentMinutes < segment.end) {
                currentSegment = segment;
            }
            
            if (currentMinutes >= segment.start) {
                dayProgress += Math.min(segment.end, currentMinutes) - segment.start;
            }
        }

        // Update UI elements
        const statsHTML = this.cachedPhases.map((phase, phaseIndex) => {
            const phaseStart = this.timeToMinutes(phase[0].start);
            const phaseEnd = this.timeToMinutes(phase[phase.length-1].end);
            const phaseProgress = Math.max(0, currentMinutes - phaseStart);
            const phaseTotal = phaseEnd - phaseStart;
            
            return `
                <div class="stat-card">
                    <h3>Phase ${phaseIndex + 1}</h3>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(phaseProgress/phaseTotal)*100}%"></div>
                    </div>
                    ${Math.round((phaseProgress/phaseTotal)*100)}% • 
                    ${Math.floor(phaseProgress/60)}m ${phaseProgress%60}s
                </div>
            `;
        }).join('');
        
        document.getElementById('stats').innerHTML = statsHTML;
        
        if (currentSegment) {
            const elapsed = currentMinutes - currentSegment.start;
            const total = currentSegment.end - currentSegment.start;
            const remaining = currentSegment.end - currentMinutes;
            
            document.getElementById('lesson-end').textContent = 
                `ENDS AT: ${this.formatMinutes(currentSegment.end)}`;
            document.getElementById('time-remaining').textContent = 
                `REMAINING: ${Math.floor(remaining/60)}m ${remaining%60}s`;
        }
    }
}

const schedule = new ScheduleManager();
