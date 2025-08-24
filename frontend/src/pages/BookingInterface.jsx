import React, { useState } from 'react'

const BookingInterface = () => {
  const [selectedTreatment, setSelectedTreatment] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: ''
  })

  const handleBookingSubmit = (e) => {
    e.preventDefault()
    console.log('Booking submission:', {
      treatment: selectedTreatment,
      date: selectedDate,
      time: selectedTime,
      customer: customerInfo
    })
    // This will be implemented with actual booking API
  }

  const handleCustomerInfoChange = (e) => {
    setCustomerInfo({
      ...customerInfo,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="container">
      <div className="header">
        <nav className="nav">
          <div className="logo">Treatment Booking System</div>
          <ul className="nav-links">
            <li><a href="/" className="nav-link">Dashboard</a></li>
            <li><a href="/login" className="nav-link">Login</a></li>
          </ul>
        </nav>
      </div>

      <div className="card">
        <h1>Book a Treatment</h1>
        <p>Select your preferred treatment and schedule your appointment.</p>
        
        <form onSubmit={handleBookingSubmit} style={{ marginTop: '30px' }}>
          <div className="form-group">
            <label className="form-label">Treatment Type</label>
            <select
              value={selectedTreatment}
              onChange={(e) => setSelectedTreatment(e.target.value)}
              className="form-input"
              required
            >
              <option value="">Select a treatment</option>
              <option value="massage">Therapeutic Massage (60 min)</option>
              <option value="facial">Anti-Aging Facial (45 min)</option>
              <option value="physiotherapy">Physiotherapy Session (30 min)</option>
              <option value="acupuncture">Acupuncture Treatment (45 min)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Preferred Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-input"
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Time</label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="form-input"
                required
              >
                <option value="">Select time</option>
                <option value="09:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
              </select>
            </div>
          </div>

          <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Contact Information</h3>
          
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="name"
              value={customerInfo.name}
              onChange={handleCustomerInfoChange}
              className="form-input"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                value={customerInfo.email}
                onChange={handleCustomerInfoChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={customerInfo.phone}
                onChange={handleCustomerInfoChange}
                className="form-input"
                required
              />
            </div>
          </div>

          <button type="submit" className="button" style={{ marginTop: '20px' }}>
            Book Appointment
          </button>
        </form>

        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h4>Note:</h4>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
            This is a placeholder booking interface. The actual booking functionality with real-time availability checking, 
            payment processing, and confirmation will be implemented in upcoming development phases.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BookingInterface