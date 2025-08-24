const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('./logger');

class JWTManager {
  /**
   * Generate access token
   */
  static generateAccessToken(payload) {
    try {
      return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        issuer: 'treatment-booking-system',
        audience: 'api-users'
      });
    } catch (error) {
      logger.logError(error, { context: 'generateAccessToken', payload });
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, config.jwt.refreshSecret, {
        expiresIn: config.jwt.refreshExpiresIn,
        issuer: 'treatment-booking-system',
        audience: 'api-users'
      });
    } catch (error) {
      logger.logError(error, { context: 'generateRefreshToken', payload });
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  static generateTokenPair(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      storeId: user.storeId
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({ id: user.id });

    logger.logAuthEvent('tokens_generated', user.id, { 
      tokenType: 'access+refresh',
      role: user.role 
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.expiresIn
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: 'treatment-booking-system',
        audience: 'api-users'
      });
    } catch (error) {
      logger.logError(error, { context: 'verifyAccessToken' });
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'treatment-booking-system',
        audience: 'api-users'
      });
    } catch (error) {
      logger.logError(error, { context: 'verifyRefreshToken' });
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.logError(error, { context: 'decodeToken' });
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch (error) {
      logger.logError(error, { context: 'getTokenExpiration' });
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    return expiration ? expiration <= new Date() : true;
  }

  /**
   * Extract token from authorization header
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Generate API key for webhook signatures
   */
  static generateApiKey() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create HMAC signature for webhook payloads
   */
  static createHmacSignature(payload, secret) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify HMAC signature
   */
  static verifyHmacSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const expectedSignature = this.createHmacSignature(payload, secret);
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.logError(error, { context: 'verifyHmacSignature' });
      return false;
    }
  }
}

module.exports = JWTManager;