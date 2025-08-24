import React, { useState, useEffect } from 'react'
import { BookingCalendar, QuickActions } from '../components/CalendarComponents'
import BookingList from '../components/BookingList'
import StatsCards from '../components/StatsCards'
import { Search, Filter, Plus, Bell, User, Settings, LogOut } from 'lucide-react'

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({
    todayBookings: 0,
    upcomingBookings: 0,
    completedToday: 0,
    revenue: 0,
    activeCustomers: 156,
    conversionRate: 68
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedDate])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // Mock data for demonstration - replace with actual API calls
      setTimeout(() => {
        setBookings([
          {
            id: '1',
            customerName: 'John Doe',
            customerEmail: 'john.doe@email.com',
            phone: '+1 (555) 123-4567',
            treatmentName: 'Deep Tissue Massage',
            category: 'Massage Therapy',
            time: '10:00:00',
            date: new Date(),
            status: 'confirmed',
            duration: '60 min',
            price: '$89.99',
            notes: 'Customer prefers firm pressure'
          },
          {
            id: '2',
            customerName: 'Jane Smith',
            customerEmail: 'jane.smith@email.com',
            phone: '+1 (555) 987-6543',
            treatmentName: 'Facial Treatment',
            category: 'Skincare',
            time: '14:00:00',
            date: new Date(),
            status: 'pending',
            duration: '45 min',
            price: '$65.00',
            notes: 'Sensitive skin - use gentle products'
          },
          {
            id: '3',
            customerName: 'Mike Johnson',
            customerEmail: 'mike.j@email.com',
            phone: '+1 (555) 456-7890',
            treatmentName: 'Hot Stone Massage',
            category: 'Massage Therapy',
            time: '16:30:00',
            date: new Date(),
            status: 'in_progress',
            duration: '90 min',
            price: '$120.00',
            notes: 'First time customer'
          },
          {
            id: '4',
            customerName: 'Sarah Wilson',
            customerEmail: 'sarah.w@email.com',
            phone: '+1 (555) 321-0987',
            treatmentName: 'Acupuncture',
            category: 'Alternative Therapy',
            time: '11:15:00',
            date: new Date(),
            status: 'completed',
            duration: '60 min',
            price: '$95.00',
            notes: 'Returning customer - very satisfied'
          }
        ])
        
        setStats({
          todayBookings: 8,
          upcomingBookings: 15,
          completedToday: 5,
          revenue: 1240.50,
          activeCustomers: 156,
          conversionRate: 68
        })
        
        setLoading(false)
      }, 1000)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setLoading(false)
    }
  }

  const handleBookingUpdate = (bookingId, newStatus) => {
    setBookings(prev => 
      prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: newStatus }
          : booking
      )
    )
  }

  const handleViewDetails = (booking) => {
    console.log('View details for booking:', booking)
    // Implement modal or navigation to detailed view
  }

  const handleEdit = (booking) => {
    console.log('Edit booking:', booking)
    // Implement edit functionality
  }

  const handleDelete = (bookingId) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      setBookings(prev => prev.filter(booking => booking.id !== bookingId))
    }
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.treatmentName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const handleNewBooking = () => {
    console.log('Create new booking')
    // Implement new booking functionality
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">Treatment Booking System</h1>
          <p className="dashboard-subtitle">Manage appointments and customer bookings</p>
        </div>
        
        <div className="header-right">
          <div className="search-container">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Search bookings, customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="header-actions">
            <button className="notification-btn" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>
            
            <button className="new-booking-btn" onClick={handleNewBooking}>
              <Plus size={20} />
              New Booking
            </button>
            
            <div className="user-menu">
              <User size={20} />
              <span>Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Main Dashboard Content */}
      <div className="dashboard-content">
        <div className="dashboard-grid">
          {/* Left Column - Bookings */}
          <div className="dashboard-left">
            <div className="content-card">
              <div className="card-header">
                <h3>Today's Schedule</h3>
                <div className="card-actions">
                  <div className="filter-group">
                    <Filter size={16} />
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <BookingList 
                bookings={filteredBookings}
                onBookingUpdate={handleBookingUpdate}
                onViewDetails={handleViewDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          </div>
          
          {/* Right Column - Calendar & Actions */}
          <div className="dashboard-right">
            <div className="content-card">
              <QuickActions />
            </div>
            
            <div className="content-card">
              <div className="card-header">
                <h3>Calendar View</h3>
                <div className="date-display">
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <BookingCalendar 
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                bookings={bookings}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h4>Notifications</h4>
            <button onClick={() => setShowNotifications(false)}>×</button>
          </div>
          <div className="notifications-list">
            <div className="notification-item">
              <div className="notification-icon">🔔</div>
              <div className="notification-content">
                <p>New booking request from Sarah Wilson</p>
                <span className="notification-time">2 minutes ago</span>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon">✅</div>
              <div className="notification-content">
                <p>Appointment completed: John Doe - Deep Tissue Massage</p>
                <span className="notification-time">15 minutes ago</span>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon">⚠️</div>
              <div className="notification-content">
                <p>Upcoming appointment reminder: Jane Smith in 1 hour</p>
                <span className="notification-time">1 hour ago</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard