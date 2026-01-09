// Utility functions for landlord record generation
import { randomBytes, createHash } from 'crypto';

/**
 * Generate a random database name based on tenant URL and subscription type
 * @param tenantUrl - The tenant URL (e.g., "acme-corp")
 * @param subscriptionTypeLevel - "Production" or "Dev"
 * @returns Generated database name
 */
export function generateDatabaseName(tenantUrl: string, subscriptionTypeLevel: 'Production' | 'Dev'): string {
  // Extract first part of tenant URL (before any hyphens)
  const tenantPrefix = tenantUrl.split('-')[0];
  
  // Generate random string (6 characters)
  const randomString = randomBytes(3).toString('hex'); // 3 bytes = 6 hex chars
  
  if (subscriptionTypeLevel === 'Production') {
    return `${tenantPrefix}-${randomString}`;
  } else {
    return `dev-${tenantPrefix}-${randomString}`;
  }
}

/**
 * Generate a random database username for Aurora MySQL
 * @returns Random username (8-12 characters)
 */
export function generateDatabaseUsername(): string {
  // Generate random username starting with 'usr' + random string
  const randomString = randomBytes(4).toString('hex'); // 4 bytes = 8 hex chars
  return `usr${randomString}`;
}

/**
 * Generate a secure random password for Aurora MySQL
 * @returns Random password (16 characters, alphanumeric + special chars)
 */
export function generateDatabasePassword(): string {
  // Generate a secure password with mixed characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

/**
 * Generate a unique 8-character S3 identifier using hash function
 * @param input - Input string to hash (e.g., subscription_id + timestamp)
 * @returns 8-character unique identifier
 */
export function generateS3Id(input: string): string {
  // Create hash from input and take first 8 characters
  const hash = createHash('sha256').update(input).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Map subscription type level to landlord environment
 * @param subscriptionTypeLevel - "Production" or "Dev"
 * @returns Landlord environment enum value
 */
export function mapSubscriptionToEnvironment(subscriptionTypeLevel: 'Production' | 'Dev'): 'Production' | 'Development' {
  return subscriptionTypeLevel === 'Production' ? 'Production' : 'Development';
}

/**
 * Extract domain from domain name URL
 * @param domainName - Full domain URL (e.g., "https://mywebsite.com")
 * @returns Domain without protocol (e.g., "mywebsite.com")
 */
export function extractDomain(domainName: string): string {
  try {
    const url = new URL(domainName);
    return url.hostname;
  } catch (error) {
    // If URL parsing fails, try to extract domain manually
    return domainName.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

/**
 * Convert tenant URL to full URL format for landlord table
 * @param tenantUrl - The tenant URL (e.g., "acme-corp")
 * @returns Full URL with https:// prefix (e.g., "https://acme-corp")
 */
export function generateTenantFullUrl(tenantUrl: string): string {
  // Remove any existing protocol
  const cleanUrl = tenantUrl.replace(/^https?:\/\//, '');
  
  // Add https:// prefix
  return `https://${cleanUrl}`;
}

/**
 * Generate database connection URL using cluster DB proxy endpoint
 * @param dbUsername - Database username
 * @param dbPassword - Database password
 * @param dbProxyUrl - DB proxy URL from cluster (e.g., "cluster-proxy.amazonaws.com:3306")
 * @param databaseName - Database name
 * @returns Complete MySQL connection URL or placeholder if no proxy URL
 */
export function generateDatabaseUrl(
  dbUsername: string, 
  dbPassword: string, 
  dbProxyUrl: string | undefined, 
  databaseName: string
): string {
  if (dbProxyUrl) {
    // Use the actual DB proxy URL from cluster
    return `mysql://${dbUsername}:${dbPassword}@${dbProxyUrl}/${databaseName}`;
  } else {
    // Fallback to placeholder if cluster doesn't have DB proxy URL yet
    return `mysql://${dbUsername}:${dbPassword}@cluster-placeholder.amazonaws.com:3306/${databaseName}`;
  }
}

/**
 * Extract database hostname from DB proxy URL for landlord table
 * @param dbProxyUrl - DB proxy URL from cluster (e.g., "cluster-proxy.amazonaws.com:3306")
 * @returns Just the hostname without port (e.g., "cluster-proxy.amazonaws.com")
 */
export function extractDatabaseHostname(dbProxyUrl: string | undefined): string {
  if (!dbProxyUrl) {
    return 'cluster-placeholder.amazonaws.com';
  }
  
  // Remove port if present (e.g., "hostname:3306" -> "hostname")
  return dbProxyUrl.split(':')[0];
}