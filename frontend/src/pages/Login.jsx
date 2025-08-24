import React, { useState } from 'react'

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // This will be implemented with actual API calls
      console.log('Login attempt:', formData)
      // Placeholder - will integrate with backend auth API
      setError('Authentication API integration coming soon!')
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
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
            <li><a href="/book" className="nav-link">Book Treatment</a></li>
          </ul>
        </nav>
      </div>

      <div style={{ maxWidth: '400px', margin: '50px auto' }}>
        <div className="card">
          <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Login</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            {error && <div className="error">{error}</div>}

            <button 
              type="submit" 
              className="button" 
              disabled={loading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
            This is a placeholder login form. Authentication integration will be implemented in upcoming tasks.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login