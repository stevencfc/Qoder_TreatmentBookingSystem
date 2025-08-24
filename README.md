# Treatment Booking System

An OpenAPI-driven B2B SaaS platform designed to streamline appointment scheduling for treatment facilities.

## Features

- **API-First Architecture**: Complete OpenAPI support for seamless integrations
- **Real-time Availability Management**: Dynamic timeslot and quota control
- **Scalable Multi-tenant Design**: Support for multiple stores and treatment types
- **Event-Driven Architecture**: Webhook subscriptions for real-time notifications
- **Role-Based Access Control**: Support for different user roles and permissions
- **Comprehensive Booking Management**: Full booking lifecycle with status tracking

## Architecture

- **Backend**: Node.js with Express.js
- **Frontend**: React with Vite
- **Database**: PostgreSQL
- **Authentication**: JWT with role-based access control
- **API Documentation**: OpenAPI 3.0 specification
- **Real-time Events**: Webhook system for notifications

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd treatment-booking-system
```

2. Install dependencies:
```bash
npm run setup
```

3. Set up environment variables:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

4. Set up the database:
```bash
npm run db:migrate
npm run db:seed
```

5. Start the development servers:
```bash
npm run dev
```

This will start:
- Backend API server on http://localhost:3000
- Frontend development server on http://localhost:5173

## API Documentation

Once the backend is running, you can access:
- OpenAPI documentation: http://localhost:3000/api-docs
- Health check: http://localhost:3000/health

## Project Structure

```
treatment-booking-system/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   └── config/          # Configuration files
│   ├── tests/               # Backend tests
│   ├── migrations/          # Database migrations
│   └── seeds/               # Database seed files
├── frontend/                # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service calls
│   │   ├── utils/           # Utility functions
│   │   └── styles/          # CSS/styling files
│   └── public/              # Static assets
└── docs/                    # Documentation
```

## Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build both applications for production
- `npm run test` - Run all tests
- `npm start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

## Environment Variables

### Backend (.env)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/treatment_booking
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
WEBHOOK_SECRET=your-webhook-secret
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.