// URL generation utilities for tenant stacks
import type { TenantRecord } from './data-models.js';

/**
 * Generate tenant URL based on tenant_url, subscription type level, and optional random suffix
 * @param tenantUrl - The tenant's URL slug (e.g., "tenant1")
 * @param subscriptionTypeLevel - "Production" or "Dev"
 * @param randomSuffix - Optional 2-digit random number for dev subscriptions
 * @returns Generated tenant URL
 */
export function generateTenantUrl(tenantUrl: string, subscriptionTypeLevel: 'Production' | 'Dev' = 'Production', randomSuffix?: string): string {
  const baseUrl = tenantUrl.toLowerCase();
  
  if (subscriptionTypeLevel === 'Production') {
    return `${baseUrl}.flowrix.app`;
  } else {
    // Dev subscription: tenant1-dev-22.flowrix.app
    const suffix = randomSuffix || generateRandomTwoDigits();
    return `${baseUrl}-dev-${suffix}.flowrix.app`;
  }
}

/**
 * Generate tenant API URL based on deployment type, region, subscription type level, and optional random suffix
 * @param tenantUrl - The tenant's URL slug (e.g., "tenant1")
 * @param deploymentType - "Shared" or "Dedicated"
 * @param region - "Australia", "US", "UK", or "Europe"
 * @param subscriptionTypeLevel - "Production" or "Dev"
 * @param randomSuffix - Optional 2-digit random number for dev subscriptions
 * @returns Generated tenant API URL
 */
export function generateTenantApiUrl(
  tenantUrl: string, 
  deploymentType: 'Shared' | 'Dedicated', 
  region: string,
  subscriptionTypeLevel: 'Production' | 'Dev' = 'Production',
  randomSuffix?: string
): string {
  const normalizedTenantUrl = tenantUrl.toLowerCase();
  const suffix = subscriptionTypeLevel === 'Dev' ? `-dev-${randomSuffix || generateRandomTwoDigits()}` : '';
  
  if (deploymentType === 'Dedicated') {
    // Dedicated: tenant1.flowrix.app or tenant1-dev-22.flowrix.app
    return `${normalizedTenantUrl}${suffix}.flowrix.app`;
  } else {
    // Shared: tenant1.au.flowrix.app or tenant1-dev-22.au.flowrix.app
    const regionCode = getRegionCode(region);
    return `${normalizedTenantUrl}${suffix}.${regionCode}.flowrix.app`;
  }
}

/**
 * Generate a random 2-digit number (10-99)
 * @returns Random 2-digit string
 */
export function generateRandomTwoDigits(): string {
  return Math.floor(Math.random() * 90 + 10).toString();
}

/**
 * Map region names to AWS region codes for stack storage
 * @param region - "Australia", "US", "UK", or "Europe"
 * @param deploymentType - "Shared" or "Dedicated"
 * @returns AWS region code or "dedicated"
 */
export function getAwsRegionCode(region: string, deploymentType: 'Shared' | 'Dedicated'): string {
  if (deploymentType === 'Dedicated') {
    return 'dedicated';
  }
  
  switch (region) {
    case 'Australia':
      return 'ap-southeast-2';
    case 'US':
      return 'us-east-1';
    case 'UK':
      return 'eu-west-2';
    case 'Europe':
      return 'eu-central-1';
    default:
      // Default to us-east-1 for unknown regions
      return 'us-east-1';
  }
}

/**
 * Map region names to region codes for URL generation
 * @param region - "Australia", "US", "UK", or "Europe"
 * @returns Region code for URL
 */
function getRegionCode(region: string): string {
  switch (region) {
    case 'Australia':
      return 'au';
    case 'US':
      return 'us';
    case 'UK':
      return 'uk';
    case 'Europe':
      return 'eu';
    default:
      // Default to 'us' for unknown regions
      return 'us';
  }
}

/**
 * Generate both tenant URL and API URL from tenant data and subscription info
 * @param tenant - Tenant record containing deployment info
 * @param subscriptionTypeLevel - "Production" or "Dev"
 * @param randomSuffix - Optional 2-digit random number for dev subscriptions
 * @returns Object with both URLs
 */
export function generateTenantUrls(
  tenant: TenantRecord, 
  subscriptionTypeLevel: 'Production' | 'Dev' = 'Production',
  randomSuffix?: string
): { tenantUrl: string; tenantApiUrl: string } {
  const tenantUrl = generateTenantUrl(tenant.tenant_url, subscriptionTypeLevel, randomSuffix);
  const tenantApiUrl = generateTenantApiUrl(tenant.tenant_url, tenant.deployment_type, tenant.region, subscriptionTypeLevel, randomSuffix);
  
  return {
    tenantUrl,
    tenantApiUrl,
  };
}

/**
 * Validate tenant URL format for URL safety
 * @param tenantUrl - The tenant URL to validate
 * @returns Validation result
 */
export function validateTenantUrlFormat(tenantUrl: string): { valid: boolean; error?: string } {
  // Check basic format: only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(tenantUrl)) {
    return {
      valid: false,
      error: 'Tenant URL must contain only lowercase letters, numbers, and hyphens'
    };
  }
  
  // Cannot start or end with hyphen
  if (tenantUrl.startsWith('-') || tenantUrl.endsWith('-')) {
    return {
      valid: false,
      error: 'Tenant URL cannot start or end with a hyphen'
    };
  }
  
  // Cannot have consecutive hyphens
  if (tenantUrl.includes('--')) {
    return {
      valid: false,
      error: 'Tenant URL cannot contain consecutive hyphens'
    };
  }
  
  // Length check
  if (tenantUrl.length < 1 || tenantUrl.length > 50) {
    return {
      valid: false,
      error: 'Tenant URL must be between 1 and 50 characters long'
    };
  }
  
  return { valid: true };
}