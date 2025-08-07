/**
 * MuseNest Admin Dashboard - Calendar Management
 */
if (window.ComponentRegistryClient) {
    window.ComponentRegistryClient.register('admin-calendar', 'admin/js/calendar.js');
}

class CalendarManager {
    constructor() {
        this.events = [];
        this.currentDate = new Date();
        this.selectedEvent = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCalendarEvents();
    }

    setupEventListeners() {
        // Add new event button
        const addEventBtn = document.getElementById('addEventBtn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => this.showAddEventModal());
        }

        // Calendar navigation
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
        }
        
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));
        }

        // Modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-close-modal]')) {
                this.closeModals();
            }
        });

        // Form submissions
        const eventForm = document.getElementById('eventForm');
        if (eventForm) {
            eventForm.addEventListener('submit', (e) => this.handleEventSubmit(e));
        }
    }

    async loadCalendarEvents() {
        try {
            showLoading(true);
            
            const month = this.currentDate.getMonth() + 1;
            const year = this.currentDate.getFullYear();
            
            const response = await window.adminDashboard.apiRequest(
                `/api/calendar?month=${month}&year=${year}`
            );
            
            if (response.success) {
                this.events = response.events;
                this.renderCalendar();
                this.renderEventsList();
            } else {
                showNotification('Failed to load calendar events', 'error');
            }
        } catch (error) {
            console.error('Error loading calendar events:', error);
            showNotification('Error loading calendar events', 'error');
        } finally {
            showLoading(false);
        }
    }

    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;

        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Update month/year display
        const monthYearDisplay = document.getElementById('monthYear');
        if (monthYearDisplay) {
            monthYearDisplay.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
        }

        // Generate calendar grid
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

        let calendarHTML = '';

        // Week day headers
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        calendarHTML += '<div class="grid grid-cols-7 gap-1 mb-2">';
        weekDays.forEach(day => {
            calendarHTML += `<div class="text-center text-sm font-medium text-gray-500 py-2">${day}</div>`;
        });
        calendarHTML += '</div>';

        // Calendar days
        calendarHTML += '<div class="grid grid-cols-7 gap-1">';
        
        for (let week = 0; week < 6; week++) {
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + (week * 7) + day);
                
                const isCurrentMonth = currentDate.getMonth() === this.currentDate.getMonth();
                const isToday = this.isToday(currentDate);
                const dayEvents = this.getEventsForDate(currentDate);
                
                let dayClass = 'min-h-24 p-1 border border-gray-200 ';
                if (!isCurrentMonth) {
                    dayClass += 'bg-gray-50 text-gray-400 ';
                } else {
                    dayClass += 'bg-white hover:bg-gray-50 ';
                }
                if (isToday) {
                    dayClass += 'border-blue-500 bg-blue-50 ';
                }

                calendarHTML += `
                    <div class="${dayClass}cursor-pointer" onclick="calendarManager.selectDate('${this.formatDate(currentDate)}')">
                        <div class="text-sm font-medium">${currentDate.getDate()}</div>
                        <div class="space-y-1">
                `;

                dayEvents.forEach(event => {
                    const eventClass = this.getEventStatusClass(event.status);
                    calendarHTML += `
                        <div class="${eventClass} text-xs p-1 rounded truncate" 
                             onclick="event.stopPropagation(); calendarManager.editEvent(${event.id})"
                             title="${event.title}">
                            ${event.title}
                        </div>
                    `;
                });

                calendarHTML += '</div></div>';
            }
        }
        
        calendarHTML += '</div>';
        calendarGrid.innerHTML = calendarHTML;
    }

    renderEventsList() {
        const eventsList = document.getElementById('eventsList');
        if (!eventsList) return;

        if (this.events.length === 0) {
            eventsList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-calendar-alt text-3xl mb-2"></i>
                    <p>No calendar events found</p>
                    <button onclick="calendarManager.showAddEventModal()" class="mt-2 text-blue-600 hover:text-blue-800">
                        Add your first event
                    </button>
                </div>
            `;
            return;
        }

        const sortedEvents = [...this.events].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        
        eventsList.innerHTML = sortedEvents.map(event => `
            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="${this.getEventStatusClass(event.status)} px-2 py-1 text-xs font-medium rounded">
                                ${event.status}
                            </span>
                            <span class="text-sm text-gray-500">
                                ${this.formatDateRange(event.start_date, event.end_date)}
                            </span>
                        </div>
                        <h3 class="font-medium text-gray-900">${event.title}</h3>
                        ${event.location ? `<p class="text-sm text-gray-600"><i class="fas fa-map-marker-alt mr-1"></i>${event.location}</p>` : ''}
                        ${event.description ? `<p class="text-sm text-gray-600 mt-1">${event.description}</p>` : ''}
                    </div>
                    <div class="flex space-x-2 ml-4">
                        <button onclick="calendarManager.editEvent(${event.id})" 
                                class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="calendarManager.deleteEvent(${event.id})" 
                                class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.loadCalendarEvents();
    }

    selectDate(dateStr) {
        this.showAddEventModal(dateStr);
    }

    showAddEventModal(date = null) {
        this.selectedEvent = null;
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        
        if (modal && form) {
            document.getElementById('modalTitle').textContent = 'Add New Event';
            form.reset();
            
            if (date) {
                document.getElementById('start_date').value = date;
                document.getElementById('end_date').value = date;
            }
            
            modal.classList.remove('hidden');
        }
    }

    async editEvent(eventId) {
        try {
            const response = await window.adminDashboard.apiRequest(`/api/calendar/${eventId}`);
            
            if (response.success) {
                this.selectedEvent = response.event;
                this.showEditEventModal(response.event);
            }
        } catch (error) {
            console.error('Error loading event:', error);
            showNotification('Error loading event', 'error');
        }
    }

    showEditEventModal(event) {
        const modal = document.getElementById('eventModal');
        const form = document.getElementById('eventForm');
        
        if (modal && form) {
            document.getElementById('modalTitle').textContent = 'Edit Event';
            
            // Populate form
            document.getElementById('title').value = event.title || '';
            document.getElementById('description').value = event.description || '';
            document.getElementById('start_date').value = event.start_date || '';
            document.getElementById('end_date').value = event.end_date || '';
            document.getElementById('start_time').value = event.start_time || '';
            document.getElementById('end_time').value = event.end_time || '';
            document.getElementById('location').value = event.location || '';
            document.getElementById('status').value = event.status || 'available';
            document.getElementById('color').value = event.color || '#3B82F6';
            document.getElementById('notes').value = event.notes || '';
            document.getElementById('all_day').checked = event.all_day;
            
            modal.classList.remove('hidden');
        }
    }

    async handleEventSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const eventData = {
            title: formData.get('title'),
            description: formData.get('description'),
            start_date: formData.get('start_date'),
            end_date: formData.get('end_date'),
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            location: formData.get('location'),
            status: formData.get('status'),
            color: formData.get('color'),
            notes: formData.get('notes'),
            all_day: formData.has('all_day')
        };

        try {
            showLoading(true);
            
            let response;
            if (this.selectedEvent) {
                // Update existing event
                response = await window.adminDashboard.apiRequest(`/api/calendar/${this.selectedEvent.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(eventData)
                });
            } else {
                // Create new event
                response = await window.adminDashboard.apiRequest('/api/calendar', {
                    method: 'POST',
                    body: JSON.stringify(eventData)
                });
            }

            if (response.success) {
                showNotification(
                    this.selectedEvent ? 'Event updated successfully' : 'Event created successfully',
                    'success'
                );
                this.closeModals();
                this.loadCalendarEvents();
            } else {
                showNotification(response.message || 'Failed to save event', 'error');
            }
        } catch (error) {
            console.error('Error saving event:', error);
            showNotification('Error saving event', 'error');
        } finally {
            showLoading(false);
        }
    }

    async deleteEvent(eventId) {
        if (!confirm('Are you sure you want to delete this event?')) {
            return;
        }

        try {
            showLoading(true);
            
            const response = await window.adminDashboard.apiRequest(`/api/calendar/${eventId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                showNotification('Event deleted successfully', 'success');
                this.loadCalendarEvents();
            } else {
                showNotification('Failed to delete event', 'error');
            }
        } catch (error) {
            console.error('Error deleting event:', error);
            showNotification('Error deleting event', 'error');
        } finally {
            showLoading(false);
        }
    }

    closeModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.classList.add('hidden'));
        this.selectedEvent = null;
    }

    // Helper methods
    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (startDate === endDate) {
            return start.toLocaleDateString();
        }
        
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }

    getEventsForDate(date) {
        const dateStr = this.formatDate(date);
        return this.events.filter(event => {
            return dateStr >= event.start_date && dateStr <= event.end_date;
        });
    }

    getEventStatusClass(status) {
        const statusClasses = {
            'available': 'bg-green-100 text-green-800',
            'vacation': 'bg-red-100 text-red-800',
            'unavailable': 'bg-gray-100 text-gray-800',
            'busy': 'bg-yellow-100 text-yellow-800'
        };
        
        return statusClasses[status] || 'bg-blue-100 text-blue-800';
    }
}

// Initialize calendar manager when admin dashboard is ready
window.addEventListener('adminDashboardReady', () => {
    console.log('Admin dashboard ready, initializing calendar manager');
    window.calendarManager = new CalendarManager();
});

// Fallback initialization
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.calendarManager && window.adminDashboard) {
            console.log('Fallback calendar manager initialization');
            window.calendarManager = new CalendarManager();
        }
    }, 1000);
});