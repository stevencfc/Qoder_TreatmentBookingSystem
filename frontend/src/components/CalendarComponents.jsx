import React, { useState } from 'react'
import { Plus, Calendar as CalendarIcon, Clock, Users, Settings, BarChart3, FileText, UserPlus } from 'lucide-react'

export const QuickActions = () => {
  const actions = [
    { icon: Plus, label: 'New Booking', color: 'blue', action: 'new-booking' },
    { icon: UserPlus, label: 'Add Customer', color: 'green', action: 'add-customer' },
    { icon: Settings, label: 'Manage Staff', color: 'purple', action: 'manage-staff' },
    { icon: BarChart3, label: 'View Reports', color: 'orange', action: 'reports' },
    { icon: FileText, label: 'Treatment List', color: 'indigo', action: 'treatments' },
    { icon: Users, label: 'Customer List', color: 'rose', action: 'customers' }
  ]

  const handleAction = (action) => {
    console.log(`Action: ${action}`)
    // Implement action handlers here
  }

  return (
    <div className="quick-actions">
      <h4 className="quick-actions-title">Quick Actions</h4>
      <div className="actions-grid">
        {actions.map((action, index) => {
          const IconComponent = action.icon
          return (
            <button
              key={index}
              className={`action-button action-${action.color}`}
              onClick={() => handleAction(action.action)}
            >
              <div className="action-icon">
                <IconComponent size={20} />
              </div>
              <span className="action-label">{action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const BookingCalendar = ({ selectedDate, onDateSelect, bookings }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState('month') // month, week, day

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const getBookingsForDate = (date) => {
    if (!date || !bookings) return []
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.date || new Date())
      return bookingDate.toDateString() === date.toDateString()
    })
  }

  const formatDate = (date) => {
    return date.getDate()
  }

  const isToday = (date) => {
    return date && date.toDateString() === new Date().toDateString()
  }

  const isSelected = (date) => {
    return date && date.toDateString() === selectedDate.toDateString()
  }

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(prev.getMonth() + direction)
      return newMonth
    })
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <div className="calendar-navigation">
          <button 
            className="nav-btn"
            onClick={() => navigateMonth(-1)}
          >
            ‹
          </button>
          <h3 className="current-month">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button 
            className="nav-btn"
            onClick={() => navigateMonth(1)}
          >
            ›
          </button>
        </div>
        <div className="view-controls">
          <button 
            className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
          <button 
            className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button 
            className={`view-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            Day
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday-header">{day}</div>
          ))}
        </div>
        
        <div className="calendar-days">
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="calendar-day empty"></div>
            }
            
            const dayBookings = getBookingsForDate(date)
            const hasBookings = dayBookings.length > 0
            
            return (
              <div
                key={index}
                className={`calendar-day ${isToday(date) ? 'today' : ''} ${isSelected(date) ? 'selected' : ''} ${hasBookings ? 'has-bookings' : ''}`}
                onClick={() => onDateSelect(date)}
              >
                <span className="day-number">{formatDate(date)}</span>
                {hasBookings && (
                  <div className="day-bookings">
                    <div className="booking-indicator">
                      {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="calendar-summary">
        <div className="summary-item">
          <CalendarIcon size={16} />
          <span>{bookings?.length || 0} total bookings</span>
        </div>
        <div className="summary-item">
          <Clock size={16} />
          <span>Next: {bookings?.[0]?.time || 'No upcoming'}</span>
        </div>
      </div>
    </div>
  )
}