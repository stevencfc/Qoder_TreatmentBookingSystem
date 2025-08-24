import React from 'react'

const BookingList = ({ bookings, onBookingUpdate }) => {
  const handleStatusChange = (bookingId, newStatus) => {
    onBookingUpdate(bookingId, newStatus)
  }

  return (
    <div className="booking-list">
      {bookings.length === 0 ? (
        <p>No bookings for this date</p>
      ) : (
        bookings.map(booking => (
          <div key={booking.id} className="booking-item">
            <div className="booking-info">
              <h4>{booking.customerName}</h4>
              <p>{booking.treatmentName} - {booking.time}</p>
              <p>{booking.duration} - {booking.price}</p>
            </div>
            <div className="booking-actions">
              <span className={`status ${booking.status}`}>{booking.status}</span>
              <select 
                value={booking.status} 
                onChange={(e) => handleStatusChange(booking.id, e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default BookingList