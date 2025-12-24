/**
 * Tenant data model and access patterns
 * Handles tenant registration and management for ERP provisioning
 */

import { z } from 'zod';
import { DynamoDBHelpers } from '../aws/dynamodb.js';
import { createLoggerFromCorrelationId } from '../logging.js';

const logger = createLoggerFromCorrelationId('tenants-model', 'data-access');

// Contact information schema
export const ContactInfoSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional()
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;

// Tenant record schema for validation
export const TenantRecordSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().toLowerCase(),
  contact_info: ContactInfoSchema,
  status: z.enum(['pending', 'active', 'suspended']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type TenantRecord = z.infer<typeof TenantRecordSchema>;

// Tenant creation input (without generated fields)
export const CreateTenantInputSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().toLowerCase(),
  contact_info: ContactInfoSchema.default({}),
  status: z.enum(['pending', 'active', 'suspended']).default('pending')
});

export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

// Tenant update input (partial fields)
export const UpdateTenantInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().toLowerCase().optional(),
  contact_info: ContactInfoSchema.optional(),
  status: z.enum(['pending', 'active', 'suspended']).optional()
});

export type UpdateTenantInput = z.infer<typeof UpdateTenantInputSchema>;

/**
 * Tenant data access layer with validation and query helpers
 */
export class TenantRepository {
  private static readonly TABLE_NAME = 'Tenants';

  /**
   * Create a new tenant record
   */
  static async create(input: CreateTenantInput): Promise<TenantRecord> {
    // Validate input
    const validatedInput = CreateTenantInputSchema.parse(input);
    
    // Check for duplicate tenant ID (should be unique)
    const existingTenant = await this.findById(validatedInput.tenant_id);
    if (existingTenant) {
      throw new Error('Tenant with this ID already exists');
    }

    // Create tenant record with timestamps
    const tenantRecord: TenantRecord = {
      ...validatedInput,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Validate complete record
    const validatedRecord = TenantRecordSchema.parse(tenantRecord);

    await DynamoDBHelpers.putItem(this.TABLE_NAME, validatedRecord, { addTimestamps: false });
    
    logger.info('Tenant record created', { 
      tenant_id: validatedRecord.tenant_id, 
      name: validatedRecord.name,
      email: validatedRecord.email,
      status: validatedRecord.status 
    });

    return validatedRecord;
  }

  /**
   * Find tenant by ID
   */
  static async findById(tenantId: string): Promise<TenantRecord | null> {
    const result = await DynamoDBHelpers.getItem<TenantRecord>(
      this.TABLE_NAME,
      { tenant_id: tenantId }
    );

    if (result) {
      // Validate retrieved record
      return TenantRecordSchema.parse(result);
    }

    return null;
  }

  /**
   * Update tenant record
   */
  static async update(tenantId: string, updates: UpdateTenantInput): Promise<void> {
    // Validate input
    const validatedUpdates = UpdateTenantInputSchema.parse(updates);

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (validatedUpdates.name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = validatedUpdates.name;
    }

    if (validatedUpdates.email !== undefined) {
      updateExpressions.push('#email = :email');
      expressionAttributeNames['#email'] = 'email';
      expressionAttributeValues[':email'] = validatedUpdates.email;
    }

    if (validatedUpdates.contact_info !== undefined) {
      updateExpressions.push('#contact_info = :contact_info');
      expressionAttributeNames['#contact_info'] = 'contact_info';
      expressionAttributeValues[':contact_info'] = validatedUpdates.contact_info;
    }

    if (validatedUpdates.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = validatedUpdates.status;
    }

    if (updateExpressions.length === 0) {
      throw new Error('No valid updates provided');
    }

    const updateExpression = `SET ${updateExpressions.join(', ')}`;

    await DynamoDBHelpers.updateItem(
      this.TABLE_NAME,
      { tenant_id: tenantId },
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    );

    logger.info('Tenant record updated', { 
      tenant_id: tenantId, 
      updates: Object.keys(validatedUpdates) 
    });
  }

  /**
   * Activate tenant (set status to active)
   */
  static async activate(tenantId: string): Promise<void> {
    await this.update(tenantId, { status: 'active' });
    logger.info('Tenant activated', { tenant_id: tenantId });
  }

  /**
   * Suspend tenant (set status to suspended)
   */
  static async suspend(tenantId: string): Promise<void> {
    await this.update(tenantId, { status: 'suspended' });
    logger.info('Tenant suspended', { tenant_id: tenantId });
  }

  /**
   * Check if tenant is active
   */
  static async isActive(tenantId: string): Promise<boolean> {
    const tenant = await this.findById(tenantId);
    return tenant?.status === 'active';
  }

  /**
   * Validate tenant data for business rules
   */
  static validateTenantData(input: CreateTenantInput): void {
    // Additional business validation beyond schema
    const validatedInput = CreateTenantInputSchema.parse(input);

    // Example business rules:
    // - Name should not contain only whitespace
    if (validatedInput.name.trim().length === 0) {
      throw new Error('Tenant name cannot be empty or only whitespace');
    }

    // - Email domain validation could be added here
    // - Phone number format validation could be added here
    
    logger.debug('Tenant data validation passed', { 
      tenant_id: validatedInput.tenant_id 
    });
  }

  /**
   * Prepare tenant for downstream provisioning
   * This method would trigger ERP provisioning workflows in the future
   */
  static async prepareForProvisioning(tenantId: string): Promise<void> {
    const tenant = await this.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Future: This would trigger downstream provisioning workflows
    // For now, we just log the preparation
    logger.info('Tenant prepared for provisioning', { 
      tenant_id: tenantId,
      tenant_name: tenant.name,
      status: tenant.status 
    });

    // Future implementation might:
    // - Send message to SQS queue for provisioning workflow
    // - Update tenant status to 'provisioning'
    // - Create provisioning job record
  }
}