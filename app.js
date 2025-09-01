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
        this.update();
    }

    recalculateSchedule() {

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
                <label class="checkbox-container">
                    <input type="checkbox" 
                        ${!this.deletedLessons.has(lesson.id) ? 'checked' : ''}
                        onchange="schedule.toggleLesson(${lesson.id})">
                    <div class="checkbox-custom"></div>
                    ${this.formatMinutes(this.timeToMinutes(lesson.start))} - 
                    ${this.formatMinutes(this.timeToMinutes(lesson.end))}
                </label>
            </div>
        `).join('');
    }

    update() {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds()/60;
        const currentSeconds = now.getSeconds() + now.getMilliseconds()/1000;
        
        // Ultra-precise time display
        document.getElementById('current-time').textContent = 
            `${String(now.getHours()).padStart(2,'0')}:` +
            `${String(now.getMinutes()).padStart(2,'0')}:` +
            `${String(now.getSeconds()).padStart(2,'0')}.` +
            `${String(now.getMilliseconds()).padStart(3,'0')}`;
        console.log("update!");
        this.updateStatistics(currentMinutes);
        setTimeout(() => this.update(), 50);
    }

    updateStatistics(currentMinutes) {
        let currentSegment = null;
        let dayProgress = 0;
        let totalDayDuration = 0;

        console.log("updating stats!")
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

        // Calculate total day duration
        timeSegments.forEach(segment => {
            totalDayDuration += segment.end - segment.start;
        });

        // Find current segment
        timeSegments.forEach(segment => {
            if (currentMinutes >= segment.start && currentMinutes < segment.end) {
                currentSegment = segment;
            }
        });

        // Update time displays
        if (currentSegment) {
            const elapsed = currentMinutes - currentSegment.start;
            const total = currentSegment.end - currentSegment.start;
            const remaining = currentSegment.end - currentMinutes;
            
            document.getElementById('lesson-end').textContent = 
                `ENDS AT: ${this.formatMinutes(currentSegment.end)}`;
            document.getElementById('time-remaining').textContent = 
                `REMAINING: ${remaining.toFixed(3)}m (${(remaining*60).toFixed(1)}s)`;
        }

        // Phase statistics
        const activePhases = this.cachedPhases.filter(phase => {
            const phaseEnd = this.timeToMinutes(phase[phase.length-1].end);
            return currentMinutes < phaseEnd;
        });

        const statsHTML = activePhases.map((phase, phaseIndex) => {
            const phaseStart = this.timeToMinutes(phase[0].start);
            const phaseEnd = this.timeToMinutes(phase[phase.length-1].end);
            const phaseProgress = Math.max(0, Math.min(currentMinutes - phaseStart, phaseEnd - phaseStart));
            const phaseTotal = phaseEnd - phaseStart;
            const progressPercent = (phaseProgress / phaseTotal) * 100;
            const remaining = phaseEnd - currentMinutes;

            return `
                <div class="stat-card">
                    <h3>Phase ${phaseIndex + 1}</h3>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="stats-grid-inner">
                        <div>${progressPercent.toFixed(7)}%</div>
                        <div>${(phaseProgress/60).toFixed(5)}h</div>
                        <div>${phaseProgress.toFixed(3)}m</div>
                        <div>${remaining.toFixed(3)}m left</div>
                        <div>${(phaseProgress*60).toFixed(1)}s</div>
                        <div>${(remaining*60).toFixed(1)}s left</div>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('stats').innerHTML = statsHTML;
    }
}

const schedule = new ScheduleManager();
