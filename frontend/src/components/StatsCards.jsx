import React from 'react'

const StatsCards = ({ stats }) => {
  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h4>Today's Bookings</h4>
        <p className="stat-value">{stats.todayBookings}</p>
      </div>
      <div className="stat-card">
        <h4>Upcoming</h4>
        <p className="stat-value">{stats.upcomingBookings}</p>
      </div>
      <div className="stat-card">
        <h4>Completed</h4>
        <p className="stat-value">{stats.completedToday}</p>
      </div>
      <div className="stat-card">
        <h4>Revenue</h4>
        <p className="stat-value">${stats.revenue}</p>
      </div>
    </div>
  )
}

export default StatsCards