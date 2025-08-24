const request = require('supertest');
const { app } = require('../src/app');
const JWTManager = require('../src/utils/jwt');

describe('Authentication API', () => {
  describe('POST /api/v1/auth/login', () => {
    test('should fail with invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    test('should fail without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Health Check API', () => {
  test('GET /health should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.uptime).toBeDefined();
  });
});

describe('JWT Manager', () => {
  test('should generate access token', () => {
    const payload = { id: '123', email: 'test@example.com' };
    const token = JWTManager.generateAccessToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  test('should extract token from header', () => {
    const token = 'some-jwt-token';
    const authHeader = `Bearer ${token}`;
    const extracted = JWTManager.extractTokenFromHeader(authHeader);
    expect(extracted).toBe(token);
  });
});

describe('Error Handling', () => {
  test('should handle 404 for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/v1/non-existent-route')
      .expect(404);

    expect(response.body.success).toBe(false);
  });
});