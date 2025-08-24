import React from 'react'
import { Calendar, Clock, CheckCircle, DollarSign, TrendingUp, Users } from 'lucide-react'

const StatsCards = ({ stats }) => {
  const statCards = [
    {
      title: "Today's Bookings",
      value: stats.todayBookings,
      icon: Calendar,
      color: "blue",
      change: "+12%",
      trend: "up"
    },
    {
      title: "Upcoming",
      value: stats.upcomingBookings,
      icon: Clock,
      color: "purple",
      change: "+5%",
      trend: "up"
    },
    {
      title: "Completed Today",
      value: stats.completedToday,
      icon: CheckCircle,
      color: "green",
      change: "+8%",
      trend: "up"
    },
    {
      title: "Total Revenue",
      value: `$${stats.revenue.toLocaleString()}`,
      icon: DollarSign,
      color: "emerald",
      change: "+15%",
      trend: "up"
    },
    {
      title: "Active Customers",
      value: stats.activeCustomers || 156,
      icon: Users,
      color: "indigo",
      change: "+3%",
      trend: "up"
    },
    {
      title: "Conversion Rate",
      value: `${stats.conversionRate || 68}%`,
      icon: TrendingUp,
      color: "rose",
      change: "+2%",
      trend: "up"
    }
  ]

  return (
    <div className="stats-grid">
      {statCards.map((stat, index) => {
        const IconComponent = stat.icon
        return (
          <div key={index} className={`stat-card stat-card-${stat.color}`}>
            <div className="stat-header">
              <div className={`stat-icon stat-icon-${stat.color}`}>
                <IconComponent size={20} />
              </div>
              <div className="stat-change">
                <span className={`trend trend-${stat.trend}`}>
                  {stat.change}
                </span>
              </div>
            </div>
            <div className="stat-content">
              <h3 className="stat-value">{stat.value}</h3>
              <p className="stat-title">{stat.title}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatsCards