import React, { useState, useEffect } from 'react'
import BookingCalendar from '../components/BookingCalendar'
import BookingList from '../components/BookingList'
import StatsCards from '../components/StatsCards'
import QuickActions from '../components/QuickActions'

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({
    todayBookings: 0,
    upcomingBookings: 0,
    completedToday: 0,
    revenue: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedDate])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // These would be actual API calls to your backend
      // const bookingsResponse = await fetch('/api/v1/bookings?date=' + selectedDate.toISOString())
      // const statsResponse = await fetch('/api/v1/dashboard/stats')
      
      // Mock data for demonstration
      setTimeout(() => {
        setBookings([
          {
            id: '1',
            customerName: 'John Doe',
            treatmentName: 'Deep Tissue Massage',
            time: '10:00 AM',
            status: 'confirmed',
            duration: '60 min',
            price: '$89.99'
          },
          {
            id: '2',
            customerName: 'Jane Smith',
            treatmentName: 'Facial Treatment',
            time: '2:00 PM',
            status: 'pending',
            duration: '45 min',
            price: '$65.00'
          }
        ])
        
        setStats({
          todayBookings: 8,
          upcomingBookings: 15,
          completedToday: 5,
          revenue: 1240.50
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

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <nav className="nav">
          <div className="logo">Treatment Booking System</div>
          <ul className="nav-links">
            <li><a href="/book" className="nav-link">Book Treatment</a></li>
            <li><a href="/reports" className="nav-link">Reports</a></li>
            <li><a href="/settings" className="nav-link">Settings</a></li>
            <li><a href="/login" className="nav-link">Logout</a></li>
          </ul>
        </nav>
      </div>
      
      <div className="dashboard-content">
        <h1>Admin Dashboard</h1>
        
        <StatsCards stats={stats} />
        
        <div className="dashboard-grid">
          <div className="dashboard-left">
            <div className="card">
              <h3>Today's Schedule</h3>
              <div className="date-selector">
                <input 
                  type="date" 
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="form-input"
                />
              </div>
              <BookingList 
                bookings={bookings} 
                onBookingUpdate={handleBookingUpdate}
              />
            </div>
          </div>
          
          <div className="dashboard-right">
            <div className="card">
              <h3>Quick Actions</h3>
              <QuickActions />
            </div>
            
            <div className="card">
              <h3>Calendar View</h3>
              <BookingCalendar 
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
                bookings={bookings}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard