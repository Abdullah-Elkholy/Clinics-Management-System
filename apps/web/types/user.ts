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
 * User Quota Tracking
 * Tracks daily/monthly quotas for messages and queues
 */
export interface UserQuota {
  id: string;                      // Unique quota identifier
  userId: string;
  
  // Message quotas
  dailyMessageLimit: number;       // Max messages per day
  monthlyMessageLimit: number;     // Max messages per month
  currentDayMessages: number;      // Messages used today
  currentMonthMessages: number;    // Messages used this month
  
  // Queue quotas
  dailyQueueLimit: number;         // Max new queues per day
  monthlyQueueLimit: number;       // Max new queues per month
  currentDayQueues: number;        // New queues created today
  currentMonthQueues: number;      // New queues created this month
  
  // Tracking
  lastResetDate: Date;             // When daily quota was last reset
  updatedAt: Date;
}

/**
 * Moderator Quota Management
 * Extended quota tracking with warnings and detailed metrics for moderators
 * NOTE: Quotas accumulate and never reset - they only increase over time
 */
export interface ModeratorQuota {
  id: string;                                // Unique quota identifier
  moderatorId: string;                       // Associated moderator
  
  // Message quotas with usage tracking (accumulative, never resets)
  messagesQuota: {
    limit: number;                           // Max total messages allowed (-1 for unlimited)
    used: number;                            // Total messages used (accumulative, never resets)
    percentage: number;                      // Usage percentage (0-100)
    isLow: boolean;                          // Warning if usage exceeds warningThreshold
    warningThreshold: number;                // Percentage at which to warn (default: 80)
  };
  
  // Queue quotas with usage tracking (accumulative, never resets)
  queuesQuota: {
    limit: number;                           // Max total queues allowed (-1 for unlimited)
    used: number;                            // Total queues used (accumulative, never resets)
    percentage: number;                      // Usage percentage (0-100)
    isLow: boolean;                          // Warning if usage exceeds warningThreshold
    warningThreshold: number;                // Percentage at which to warn (default: 80)
  };
  
  // Tracking (accumulative only, no reset functionality)
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
  assignedModerator?: string;      // ID of assigned moderator (for regular users)
  quota?: UserQuota;               // Optional quota tracking (typically for moderators)
  
  // Audit and timestamps
  createdBy?: string;              // ID of user who created this account (nullable for bootstrap users)
  createdAt: Date;                 // Account creation timestamp
  updatedAt: Date;                 // Last profile update timestamp
  lastLogin?: Date;                // Last successful login
}

/**
 * Specialized type for Moderator users
 * Ensures moderator-specific fields are present
 */
export interface ModeratorUser extends Omit<User, 'role'> {
  role: typeof UserRole.Moderator;  // Type narrowed to moderator role
  assignedModerator?: undefined;     // Moderators are not assigned to other moderators
  quota: UserQuota;                  // Moderators always have quota tracking
}

/**
 * Specialized type for Regular users
 * Ensures user-specific fields are present
 */
export interface RegularUser extends Omit<User, 'role'> {
  role: typeof UserRole.User;        // Type narrowed to user role
  assignedModerator: string;         // Regular users must be assigned to a moderator
  quota?: UserQuota;                 // Optional quota for users
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
 */
export interface CreateUserPayload {
  username: string;
  firstName: string;
  lastName?: string;               // Optional
  role: UserRole;
  createdBy?: string;              // ID of user creating this account (optional for bootstrap)
  assignedModerator?: string;
  initialQuota?: {
    dailyMessageLimit: number;
    monthlyMessageLimit: number;
    dailyQueueLimit: number;
    monthlyQueueLimit: number;
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
 * Quota update payload
 */
export interface UpdateQuotaPayload {
  dailyMessageLimit?: number;
  monthlyMessageLimit?: number;
  dailyQueueLimit?: number;
  monthlyQueueLimit?: number;
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
