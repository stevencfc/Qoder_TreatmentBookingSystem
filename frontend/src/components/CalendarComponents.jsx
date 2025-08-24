import React from 'react'

export const QuickActions = () => {
  return (
    <div className="quick-actions">
      <button className="button">New Booking</button>
      <button className="button">Add Treatment</button>
      <button className="button">Manage Staff</button>
      <button className="button">View Reports</button>
    </div>
  )
}

export const BookingCalendar = ({ selectedDate, onDateSelect, bookings }) => {
  return (
    <div className="booking-calendar">
      <p>Calendar for {selectedDate.toDateString()}</p>
      <div className="calendar-grid">
        <p>{bookings.length} bookings scheduled</p>
        <button onClick={() => onDateSelect(new Date())}>Today</button>
      </div>
    </div>
  )
}