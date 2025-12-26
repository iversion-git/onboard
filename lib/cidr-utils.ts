// CIDR validation and overlap detection utilities
import { logger } from './logging.js';

// CIDR validation regex for IPv4 CIDR notation
const CIDR_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[0-9]|[1-2][0-9]|3[0-2])$/;

// Private IP ranges (RFC 1918) validation
const PRIVATE_IP_RANGES = [
  /^10\.(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){2}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:[8-9]|[12][0-9]|3[0-2])$/,
  /^172\.(?:1[6-9]|2[0-9]|3[01])\.(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){1}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:1[2-9]|2[0-9]|3[0-2])$/,
  /^192\.168\.(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){1}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(?:1[6-9]|2[0-9]|3[0-2])$/
];

/**
 * Validate CIDR format and ensure it's a private IP range (RFC 1918)
 */
export const validateCIDR = (cidr: string): boolean => {
  if (!CIDR_REGEX.test(cidr)) {
    return false;
  }
  
  // Check if it's a private IP range (RFC 1918)
  return PRIVATE_IP_RANGES.some(regex => regex.test(cidr));
};

/**
 * Parse IP address to 32-bit integer
 */
const parseIP = (ip: string): number => {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

/**
 * Parse CIDR notation to network and mask
 */
const parseCIDR = (cidr: string): { network: number; mask: number } => {
  const [ip, prefixLength] = cidr.split('/');
  const mask = (0xffffffff << (32 - parseInt(prefixLength, 10))) >>> 0;
  const network = parseIP(ip) & mask;
  return { network, mask };
};

/**
 * Check if two CIDR blocks overlap
 */
export const checkCIDROverlap = (cidr1: string, cidr2: string): boolean => {
  try {
    const { network: network1, mask: mask1 } = parseCIDR(cidr1);
    const { network: network2, mask: mask2 } = parseCIDR(cidr2);

    // Check if network1 contains network2 or vice versa
    // Network1 contains network2 if network2 & mask1 === network1
    // Network2 contains network1 if network1 & mask2 === network2
    return (network2 & mask1) === network1 || (network1 & mask2) === network2;
  } catch (error) {
    logger.error('Error checking CIDR overlap', { 
      cidr1, 
      cidr2, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
};

/**
 * CIDR validation result interface
 */
export interface CIDRValidationResult {
  valid: boolean;
  error?: string;
  overlaps?: string[];
}

/**
 * Validate CIDR and check for overlaps with existing CIDRs
 */
export const validateCIDRWithOverlapCheck = (cidr: string, existingCidrs: string[]): CIDRValidationResult => {
  // First validate CIDR format and private range
  if (!validateCIDR(cidr)) {
    return {
      valid: false,
      error: 'CIDR must be a valid private IPv4 CIDR block (RFC 1918)'
    };
  }

  // Check for overlaps with existing CIDRs
  const overlaps = existingCidrs.filter(existingCidr => checkCIDROverlap(cidr, existingCidr));
  
  if (overlaps.length > 0) {
    return {
      valid: false,
      error: 'CIDR overlaps with existing cluster networks',
      overlaps
    };
  }

  return { valid: true };
};

/**
 * Get network information from CIDR
 */
export const getCIDRInfo = (cidr: string): { network: string; broadcast: string; hostCount: number } | null => {
  try {
    const [ip, prefixLength] = cidr.split('/');
    const prefixLen = parseInt(prefixLength, 10);
    const mask = (0xffffffff << (32 - prefixLen)) >>> 0;
    const network = parseIP(ip) & mask;
    const broadcast = network | (~mask >>> 0);
    const hostCount = Math.pow(2, 32 - prefixLen) - 2; // Subtract network and broadcast addresses

    const networkIP = [
      (network >>> 24) & 0xff,
      (network >>> 16) & 0xff,
      (network >>> 8) & 0xff,
      network & 0xff
    ].join('.');

    const broadcastIP = [
      (broadcast >>> 24) & 0xff,
      (broadcast >>> 16) & 0xff,
      (broadcast >>> 8) & 0xff,
      broadcast & 0xff
    ].join('.');

    return {
      network: networkIP,
      broadcast: broadcastIP,
      hostCount: Math.max(0, hostCount)
    };
  } catch (error) {
    logger.error('Error getting CIDR info', { 
      cidr, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return null;
  }
};

/**
 * Check if an IP address is within a CIDR block
 */
export const isIPInCIDR = (ip: string, cidr: string): boolean => {
  try {
    const { network, mask } = parseCIDR(cidr);
    const ipInt = parseIP(ip);
    return (ipInt & mask) === network;
  } catch (error) {
    logger.error('Error checking IP in CIDR', { 
      ip, 
      cidr, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
};