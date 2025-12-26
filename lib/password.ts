import bcrypt from 'bcryptjs';
import { getConfig } from './config.js';
import { logger } from './logging.js';

/**
 * Password utility class for hashing and verification
 */
export class PasswordHelper {
  private saltRounds: number;

  constructor() {
    const config = getConfig();
    this.saltRounds = config.security.bcryptRounds;
    logger.info('Password helper initialized', { saltRounds: this.saltRounds });
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string, correlationId?: string): Promise<string> {
    try {
      logger.info('Hashing password', { correlationId });

      if (!password || password.length === 0) {
        throw new Error('Password cannot be empty');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const hash = await bcrypt.hash(password, this.saltRounds);
      
      logger.info('Password hashed successfully', { correlationId });
      return hash;
    } catch (error) {
      logger.error('Failed to hash password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string, correlationId?: string): Promise<boolean> {
    try {
      logger.info('Verifying password', { correlationId });

      if (!password || !hash) {
        logger.info('Password verification failed: empty password or hash', { correlationId });
        return false;
      }

      const isValid = await bcrypt.compare(password, hash);
      
      logger.info('Password verification completed', { 
        isValid,
        correlationId 
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to verify password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });
      return false;
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', 'password123', '123456', '123456789', 'qwerty',
      'abc123', 'password1', 'admin', 'letmein', 'welcome'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

// Export singleton instance (lazy initialization)
let passwordHelperInstance: PasswordHelper | null = null;
export const passwordHelper = {
  get instance(): PasswordHelper {
    if (!passwordHelperInstance) {
      passwordHelperInstance = new PasswordHelper();
    }
    return passwordHelperInstance;
  },
  
  // Proxy methods for convenience
  hashPassword: (password: string, correlationId?: string) => 
    passwordHelper.instance.hashPassword(password, correlationId),
  verifyPassword: (password: string, hash: string, correlationId?: string) => 
    passwordHelper.instance.verifyPassword(password, hash, correlationId),
  
  // Static methods
  constructor: PasswordHelper,
};