/**
 * Staff data model and access patterns
 * Handles staff account management with role-based access control
 */

import { z } from 'zod';
import { DynamoDBHelpers } from '../aws/dynamodb.js';
import { createLoggerFromCorrelationId } from '../logging.js';

const logger = createLoggerFromCorrelationId('staff-model', 'data-access');

// Staff record schema for validation
export const StaffRecordSchema = z.object({
  staff_id: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  password_hash: z.string().min(1),
  roles: z.array(z.enum(['admin', 'manager', 'staff'])).min(1),
  enabled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type StaffRecord = z.infer<typeof StaffRecordSchema>;

// Staff creation input (without generated fields)
export const CreateStaffInputSchema = z.object({
  staff_id: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  password_hash: z.string().min(1),
  roles: z.array(z.enum(['admin', 'manager', 'staff'])).min(1),
  enabled: z.boolean().default(true)
});

export type CreateStaffInput = z.infer<typeof CreateStaffInputSchema>;

// Staff update input (partial fields)
export const UpdateStaffInputSchema = z.object({
  password_hash: z.string().min(1).optional(),
  roles: z.array(z.enum(['admin', 'manager', 'staff'])).min(1).optional(),
  enabled: z.boolean().optional()
});

export type UpdateStaffInput = z.infer<typeof UpdateStaffInputSchema>;

/**
 * Staff data access layer with validation and query helpers
 */
export class StaffRepository {
  private static readonly TABLE_NAME = 'Staff';
  private static readonly EMAIL_INDEX = 'EmailIndex';

  /**
   * Create a new staff record
   */
  static async create(input: CreateStaffInput): Promise<StaffRecord> {
    // Validate input
    const validatedInput = CreateStaffInputSchema.parse(input);
    
    // Check for duplicate email
    const existingStaff = await this.findByEmail(validatedInput.email);
    if (existingStaff) {
      throw new Error('Staff member with this email already exists');
    }

    // Create staff record with timestamps
    const staffRecord: StaffRecord = {
      ...validatedInput,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Validate complete record
    const validatedRecord = StaffRecordSchema.parse(staffRecord);

    await DynamoDBHelpers.putItem(this.TABLE_NAME, validatedRecord, { addTimestamps: false });
    
    logger.info('Staff record created', { 
      staff_id: validatedRecord.staff_id, 
      email: validatedRecord.email,
      roles: validatedRecord.roles 
    });

    return validatedRecord;
  }

  /**
   * Find staff by ID
   */
  static async findById(staffId: string): Promise<StaffRecord | null> {
    const result = await DynamoDBHelpers.getItem<StaffRecord>(
      this.TABLE_NAME,
      { staff_id: staffId }
    );

    if (result) {
      // Validate retrieved record
      return StaffRecordSchema.parse(result);
    }

    return null;
  }

  /**
   * Find staff by email using GSI
   */
  static async findByEmail(email: string): Promise<StaffRecord | null> {
    const normalizedEmail = email.toLowerCase();
    
    const results = await DynamoDBHelpers.queryItems<StaffRecord>(
      this.TABLE_NAME,
      'email = :email',
      { ':email': normalizedEmail },
      { indexName: this.EMAIL_INDEX, limit: 1 }
    );

    if (results.length > 0) {
      // Validate retrieved record
      return StaffRecordSchema.parse(results[0]);
    }

    return null;
  }

  /**
   * Update staff record
   */
  static async update(staffId: string, updates: UpdateStaffInput): Promise<void> {
    // Validate input
    const validatedUpdates = UpdateStaffInputSchema.parse(updates);

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (validatedUpdates.password_hash !== undefined) {
      updateExpressions.push('#password_hash = :password_hash');
      expressionAttributeNames['#password_hash'] = 'password_hash';
      expressionAttributeValues[':password_hash'] = validatedUpdates.password_hash;
    }

    if (validatedUpdates.roles !== undefined) {
      updateExpressions.push('#roles = :roles');
      expressionAttributeNames['#roles'] = 'roles';
      expressionAttributeValues[':roles'] = validatedUpdates.roles;
    }

    if (validatedUpdates.enabled !== undefined) {
      updateExpressions.push('#enabled = :enabled');
      expressionAttributeNames['#enabled'] = 'enabled';
      expressionAttributeValues[':enabled'] = validatedUpdates.enabled;
    }

    if (updateExpressions.length === 0) {
      throw new Error('No valid updates provided');
    }

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    await DynamoDBHelpers.updateItem(
      this.TABLE_NAME,
      { staff_id: staffId },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    logger.info('Staff record updated', { 
      staff_id: staffId, 
      updates: Object.keys(validatedUpdates) 
    });
  }

  /**
   * Enable staff account
   */
  static async enable(staffId: string): Promise<void> {
    await this.update(staffId, { enabled: true });
    logger.info('Staff account enabled', { staff_id: staffId });
  }

  /**
   * Disable staff account
   */
  static async disable(staffId: string): Promise<void> {
    await this.update(staffId, { enabled: false });
    logger.info('Staff account disabled', { staff_id: staffId });
  }

  /**
   * Check if staff exists and is enabled
   */
  static async isEnabled(staffId: string): Promise<boolean> {
    const staff = await this.findById(staffId);
    return staff?.enabled === true;
  }

  /**
   * Validate staff has required role
   */
  static hasRole(staff: StaffRecord, requiredRole: 'admin' | 'manager' | 'staff'): boolean {
    // Admin has all permissions
    if (staff.roles.includes('admin')) {
      return true;
    }

    // Manager has manager and staff permissions
    if (requiredRole === 'manager' || requiredRole === 'staff') {
      return staff.roles.includes('manager') || staff.roles.includes(requiredRole);
    }

    // Staff only has staff permissions
    return staff.roles.includes(requiredRole);
  }
}