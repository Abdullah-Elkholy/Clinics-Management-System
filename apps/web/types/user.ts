/**
 * Canonical User Data Model
 * File: apps/web/types/user.ts
 * 
 * This is the single source of truth for User types across the entire application.
 * All components, services, and utilities should import User types from this file.
 * 
 * Features:
 * - Unified user data structure
 * - Full user lifecycle fields (created, updated, lastLogin)
 * - Optional quota tracking for moderators
 * - Type-safe user assignment and roles
 * - Specializations for specific roles (ModeratorUser, RegularUser)
 */

import type { UserRole } from './roles';

/**
 * Moderator Quota Management - SINGLE SOURCE OF TRUTH
 * 
 * HIERARCHY & RELATIONSHIP:
 * - Quotas are directly attached to MODERATORS
 * - Regular users under that moderator consume the moderator's quota (inherit through hierarchy)
 * - Each moderator has ONE quota that all their assigned users share
 * - Quotas accumulate and never reset - they only increase over time
 * 
 * FIELD SEMANTICS:
 * - limit: Total quota allowed (-1 = unlimited)
 * - used/consumed: Total usage accumulated (never resets)
 * - remaining: Calculated as limit - used (when limit != -1)
 * - percentage: (used / limit) * 100 for progress visualization
 * - isLow: Warning flag when usage exceeds warningThreshold
 */
export interface ModeratorQuota {
  // Identity & Association
  id: string;                                // Unique quota identifier
  moderatorId: string;                       // Associated moderator (quota is tied to moderator)
  
  // Message quotas with usage tracking (accumulative, never resets)
  messagesQuota: {
    limit: number;                           // Max total messages allowed (-1 for unlimited)
    used: number;                            // Total messages consumed (accumulative, never resets)
    percentage: number;                      // Usage percentage (0-100 or >100 if over limit)
    isLow: boolean;                          // Warning flag: true if percentage >= warningThreshold
    warningThreshold: number;                // Percentage threshold to trigger warning (default: 80)
  };
  
  // Queue quotas with usage tracking (accumulative, never resets)
  queuesQuota: {
    limit: number;                           // Max total queues allowed (-1 for unlimited)
    used: number;                            // Total queues consumed (accumulative, never resets)
    percentage: number;                      // Usage percentage (0-100 or >100 if over limit)
    isLow: boolean;                          // Warning flag: true if percentage >= warningThreshold
    warningThreshold: number;                // Percentage threshold to trigger warning (default: 80)
  };
  
  // Audit and timestamps
  createdAt: Date;                           // When quota was created
  updatedAt: Date;                           // Last time quota was updated
  updatedBy?: string;                        // ID of user who last updated quota
}

/**
 * Core User Interface
 * Complete user data with all fields needed across the system
 * 
 * NOTE: Email and phoneNumber fields removed
 * NOTE: createdBy is nullable for bootstrap users (e.g., primary admin)
 * NOTE: Using firstName and lastName instead of fullName for better data structure
 * 
 * HIERARCHY:
 * - Moderators have quotas directly attached
 * - Regular users consume their assigned moderator's quota (no personal quota)
 * - Admins don't have quotas or moderator assignments
 */
export interface User {
  id: string;                      // Unique user identifier (UUID format)
  username: string;                // Login username (unique)
  firstName: string;               // First name
  lastName?: string;               // Last name (optional)
  
  // Role and permissions
  role: UserRole;                  // User role (primary_admin, secondary_admin, moderator, user)
  
  // User status
  isActive: boolean;               // Whether user can login/perform actions
  
  // Assignment and quota
  assignedModerator?: string;      // ID of assigned moderator (for regular users only)
  moderatorQuota?: ModeratorQuota; // Reference to moderator's quota (for display/hierarchy purposes only)
  
  // Audit and timestamps
  createdBy?: string;              // ID of user who created this account (nullable for bootstrap users)
  createdAt: Date;                 // Account creation timestamp
  updatedAt: Date;                 // Last profile update timestamp
  lastLogin?: Date;                // Last successful login
  
  // Soft-delete fields (30-day trash window)
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}

/**
 * Specialized type for Moderator users
 * Ensures moderator-specific fields are present
 * Moderators always have quota tracking
 */
export interface ModeratorUser extends Omit<User, 'role' | 'assignedModerator' | 'moderatorQuota'> {
  role: typeof UserRole.Moderator;  // Type narrowed to moderator role
  assignedModerator?: undefined;     // Moderators are not assigned to other moderators
  quota: ModeratorQuota;             // Moderators always have their own quota
}

/**
 * Specialized type for Regular users
 * Ensures user-specific fields are present
 * Users consume their moderator's quota
 */
export interface RegularUser extends Omit<User, 'role'> {
  role: typeof UserRole.User;        // Type narrowed to user role
  assignedModerator: string;         // Regular users must be assigned to a moderator
  moderatorQuota: ModeratorQuota;    // Reference to their moderator's quota for consumption
}

/**
 * Specialized type for Admin users
 */
export interface AdminUser extends Omit<User, 'role'> {
  role: typeof UserRole.PrimaryAdmin | typeof UserRole.SecondaryAdmin;
  assignedModerator?: undefined;
}

/**
 * User creation payload
 * Omits generated fields (id, timestamps)
 * Email and phoneNumber removed
 * createdBy is optional for bootstrap users
 * Using firstName and lastName instead of fullName
 * lastName is optional
 * 
 * For moderators: initialQuota is required to set their quota
 * For regular users: quota is inherited from assigned moderator
 */
export interface CreateUserPayload {
  username: string;
  firstName: string;
  lastName?: string;               // Optional
  role: UserRole;
  createdBy?: string;              // ID of user creating this account (optional for bootstrap)
  assignedModerator?: string;      // For regular users
  initialQuota?: {                 // For moderators to set their initial quota
    messagesLimit: number;
    queuesLimit: number;
  };
}

/**
 * User update payload
 * All fields optional
 * Email and phoneNumber removed
 * Using firstName and lastName instead of fullName
 */
export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  assignedModerator?: string;
  role?: UserRole;
}

/**
 * Quota update payload - For moderator quota updates
 * Supports both SET and ADD modes:
 * - SET: Replace existing limits (used for "set limit")
 * - ADD: Add to existing limits (used for "add quota")
 */
export interface UpdateQuotaPayload {
  messagesLimit?: number;          // New/additional message limit
  queuesLimit?: number;            // New/additional queues limit
  mode?: 'set' | 'add';            // SET to replace, ADD to increase (default: set)
}

/**
 * Moderator assignment payload
 */
export interface AssignModeratorPayload {
  userId: string;
  moderatorId?: string; // Undefined to unassign
}

/**
 * User filter options for searching/filtering
 */
export interface UserFilter {
  role?: UserRole;
  isActive?: boolean;
  moderatorId?: string;
  searchTerm?: string; // Searches username, firstName, lastName
}

/**
 * User statistics
 */
export interface UserStats {
  totalUsers: number;
  totalModerators: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
}
