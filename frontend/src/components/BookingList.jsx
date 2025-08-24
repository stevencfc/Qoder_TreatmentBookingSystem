import React, { useState } from 'react'
import { MoreHorizontal, Eye, Edit, Trash2, Phone, Mail, Calendar, Clock } from 'lucide-react'

const BookingList = ({ bookings, onBookingUpdate, onViewDetails, onEdit, onDelete }) => {
  const [expandedBooking, setExpandedBooking] = useState(null)

  const handleStatusChange = (bookingId, newStatus) => {
    onBookingUpdate(bookingId, newStatus)
  }

  const getStatusColor = (status) => {
    const statusColors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'confirmed': 'bg-blue-100 text-blue-800 border-blue-200',
      'in_progress': 'bg-purple-100 text-purple-800 border-purple-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'cancelled': 'bg-red-100 text-red-800 border-red-200',
      'no_show': 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return statusColors[status] || statusColors['pending']
  }

  const getStatusIcon = (status) => {
    const statusIcons = {
      'pending': '⏳',
      'confirmed': '✅',
      'in_progress': '🔄',
      'completed': '🎉',
      'cancelled': '❌',
      'no_show': '⏰'
    }
    return statusIcons[status] || '⏳'
  }

  const formatTime = (time) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="booking-list-container">
      <div className="booking-list-header">
        <h3 className="text-lg font-semibold text-gray-900">Today's Schedule</h3>
        <div className="booking-filters">
          <select className="filter-select">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-state">
          <Calendar className="empty-icon" size={48} />
          <p className="empty-text">No bookings for this date</p>
          <p className="empty-subtext">All clear! No appointments scheduled.</p>
        </div>
      ) : (
        <div className="booking-table-container">
          <table className="booking-table">
            <thead>
              <tr className="table-header">
                <th>Customer</th>
                <th>Treatment</th>
                <th>Time</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(booking => (
                <React.Fragment key={booking.id}>
                  <tr className="table-row">
                    <td className="customer-cell">
                      <div className="customer-info">
                        <div className="customer-avatar">
                          {booking.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="customer-details">
                          <p className="customer-name">{booking.customerName}</p>
                          <p className="customer-email">{booking.customerEmail || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="treatment-cell">
                      <div className="treatment-info">
                        <p className="treatment-name">{booking.treatmentName}</p>
                        <p className="treatment-category">{booking.category || 'General'}</p>
                      </div>
                    </td>
                    <td className="time-cell">
                      <div className="time-info">
                        <Clock size={16} className="time-icon" />
                        <span>{formatTime(booking.time)}</span>
                      </div>
                    </td>
                    <td className="duration-cell">
                      <span className="duration-badge">{booking.duration}</span>
                    </td>
                    <td className="price-cell">
                      <span className="price-value">{booking.price}</span>
                    </td>
                    <td className="status-cell">
                      <div className="status-container">
                        <span className={`status-badge ${getStatusColor(booking.status)}`}>
                          {getStatusIcon(booking.status)} {booking.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="actions-cell">
                      <div className="actions-container">
                        <button 
                          className="action-btn view-btn"
                          onClick={() => onViewDetails && onViewDetails(booking)}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="action-btn edit-btn"
                          onClick={() => onEdit && onEdit(booking)}
                          title="Edit Booking"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => onDelete && onDelete(booking.id)}
                          title="Delete Booking"
                        >
                          <Trash2 size={16} />
                        </button>
                        <select 
                          className="status-select"
                          value={booking.status} 
                          onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no_show">No Show</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                  {expandedBooking === booking.id && (
                    <tr className="expanded-row">
                      <td colSpan="7">
                        <div className="booking-details">
                          <div className="details-grid">
                            <div className="detail-item">
                              <Phone size={16} />
                              <span>{booking.phone || 'No phone'}</span>
                            </div>
                            <div className="detail-item">
                              <Mail size={16} />
                              <span>{booking.customerEmail || 'No email'}</span>
                            </div>
                            <div className="detail-item">
                              <Calendar size={16} />
                              <span>{formatDate(booking.date || new Date())}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Notes:</span>
                              <span>{booking.notes || 'No additional notes'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default BookingList