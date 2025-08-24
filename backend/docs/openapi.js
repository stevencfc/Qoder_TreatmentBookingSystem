const swaggerJSDoc = require('swagger-jsdoc');
const config = require('../src/config');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Treatment Booking System API',
    version: '1.0.0',
    description: `
# Treatment Booking System API

An OpenAPI-driven B2B SaaS platform designed to streamline appointment scheduling for treatment facilities.

## Features

- **API-First Architecture**: Complete OpenAPI support for seamless integrations
- **Real-time Availability Management**: Dynamic timeslot and quota control
- **Scalable Multi-tenant Design**: Support for multiple stores and treatment types
- **Event-Driven Architecture**: Webhook subscriptions for real-time notifications
- **Role-Based Access Control**: Support for different user roles and permissions

## Authentication

This API uses JWT Bearer tokens for authentication. Include the token in the Authorization header:

\`Authorization: Bearer <your-token>\`

## Rate Limiting

API requests are rate-limited to 100 requests per 15 minutes per IP address.

## Error Handling

All API responses follow a consistent format:

\`\`\`json
{
  "success": boolean,
  "data": object|array|null,
  "error": {
    "code": "string",
    "message": "string"
  }
}
\`\`\`

## Pagination

List endpoints support pagination with these query parameters:
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 10, max: 100)
- \`sortBy\`: Field to sort by
- \`sortOrder\`: Sort direction (asc/desc)
    `,
    termsOfService: 'https://yourapi.com/terms',
    contact: {
      name: 'API Support',
      email: 'api-support@treatmentbooking.com',
      url: 'https://yourapi.com/support'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: `http://localhost:${config.port}`,
      description: 'Development server'
    },
    {
      url: 'https://api.treatmentbooking.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token obtained from login endpoint'
      }
    },
    schemas: {
      User: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'user@example.com'
          },
          firstName: {
            type: 'string',
            description: 'User first name',
            example: 'John'
          },
          lastName: {
            type: 'string',
            description: 'User last name', 
            example: 'Doe'
          },
          role: {
            type: 'string',
            enum: ['super_admin', 'store_admin', 'staff', 'customer'],
            description: 'User role in the system',
            example: 'customer'
          },
          phone: {
            type: 'string',
            description: 'User phone number',
            example: '+1234567890'
          },
          isActive: {
            type: 'boolean',
            description: 'Whether user account is active',
            example: true
          },
          storeId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated store ID (for staff)',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'User creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      Store: {
        type: 'object',
        required: ['name', 'timezone'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the store'
          },
          name: {
            type: 'string',
            description: 'Store name',
            example: 'Downtown Wellness Center'
          },
          description: {
            type: 'string',
            description: 'Store description',
            example: 'Full-service wellness center offering massage and therapy'
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string', example: '123 Main St' },
              city: { type: 'string', example: 'New York' },
              state: { type: 'string', example: 'NY' },
              postalCode: { type: 'string', example: '10001' },
              country: { type: 'string', example: 'USA' }
            }
          },
          phone: {
            type: 'string',
            description: 'Store phone number',
            example: '+1234567890'
          },
          timezone: {
            type: 'string',
            description: 'Store timezone',
            example: 'America/New_York'
          },
          operatingHours: {
            type: 'object',
            description: 'Weekly operating hours',
            example: {
              monday: { open: '09:00', close: '17:00', closed: false },
              tuesday: { open: '09:00', close: '17:00', closed: false }
            }
          },
          isActive: {
            type: 'boolean',
            description: 'Whether store is active',
            example: true
          }
        }
      },
      Treatment: {
        type: 'object',
        required: ['name', 'storeId', 'duration', 'price'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the treatment'
          },
          name: {
            type: 'string',
            description: 'Treatment name',
            example: 'Deep Tissue Massage'
          },
          description: {
            type: 'string',
            description: 'Treatment description'
          },
          category: {
            type: 'string',
            description: 'Treatment category',
            example: 'Massage Therapy'
          },
          duration: {
            type: 'integer',
            description: 'Treatment duration in minutes',
            example: 60
          },
          price: {
            type: 'object',
            properties: {
              amount: { type: 'number', example: 89.99 },
              currency: { type: 'string', example: 'USD' }
            }
          },
          requiredStaffLevel: {
            type: 'string',
            enum: ['junior', 'senior', 'expert', 'any'],
            example: 'senior'
          },
          maxConcurrentBookings: {
            type: 'integer',
            description: 'Maximum concurrent bookings',
            example: 2
          },
          isActive: {
            type: 'boolean',
            example: true
          },
          storeId: {
            type: 'string',
            format: 'uuid',
            description: 'Associated store ID'
          }
        }
      },
      Booking: {
        type: 'object',
        required: ['customerId', 'storeId', 'treatmentId', 'bookingDateTime', 'duration'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the booking'
          },
          customerId: {
            type: 'string',
            format: 'uuid',
            description: 'Customer user ID'
          },
          storeId: {
            type: 'string',
            format: 'uuid',
            description: 'Store ID'
          },
          treatmentId: {
            type: 'string',
            format: 'uuid',
            description: 'Treatment ID'
          },
          staffId: {
            type: 'string',
            format: 'uuid',
            description: 'Assigned staff member ID'
          },
          bookingDateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Scheduled date and time',
            example: '2025-08-25T14:30:00Z'
          },
          duration: {
            type: 'integer',
            description: 'Booking duration in minutes',
            example: 60
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
            example: 'confirmed'
          },
          price: {
            type: 'object',
            properties: {
              amount: { type: 'number', example: 89.99 },
              currency: { type: 'string', example: 'USD' }
            }
          },
          notes: {
            type: 'string',
            description: 'Additional notes'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR'
              },
              message: {
                type: 'string',
                example: 'Invalid input data'
              }
            }
          }
        }
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'array',
            items: {}
          },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer', example: 1 },
              pageSize: { type: 'integer', example: 10 },
              totalCount: { type: 'integer', example: 50 },
              totalPages: { type: 'integer', example: 5 }
            }
          }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'AUTHENTICATION_ERROR',
                message: 'Authentication required'
              }
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'AUTHORIZATION_ERROR',
                message: 'Access denied'
              }
            }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'NOT_FOUND_ERROR',
                message: 'Resource not found'
              }
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data'
              }
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and authorization'
    },
    {
      name: 'Users',
      description: 'User management operations'
    },
    {
      name: 'Stores',
      description: 'Store management and configuration'
    },
    {
      name: 'Treatments',
      description: 'Treatment catalog management'
    },
    {
      name: 'Bookings',
      description: 'Appointment booking operations'
    },
    {
      name: 'Webhooks',
      description: 'Webhook subscription management'
    },
    {
      name: 'Health',
      description: 'System health and monitoring'
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.js',
    './src/models/*.js',
    './src/controllers/*.js'
  ]
};

const swaggerSpecs = swaggerJSDoc(options);

module.exports = swaggerSpecs;