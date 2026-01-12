/**
 * Role & Permission System - Single Source of Truth
 * Implements SOLID principles for centralized role/permission management
 */

/**
 * User roles enum - Single definition used throughout the app
 * Maps to backend roles: primary_admin, secondary_admin, moderator, user
 */
export enum UserRole {
  PrimaryAdmin = 'primary_admin',
  SecondaryAdmin = 'secondary_admin',
  Moderator = 'moderator',
  User = 'user',
}

/**
 * Feature flags - Granular control over who can access specific features
 * Supports future fine-grained permissions
 */
export enum Feature {
  // Queue Management
  VIEW_QUEUES = 'view_queues',
  CREATE_QUEUE = 'create_queue',
  EDIT_QUEUE = 'edit_queue',
  DELETE_QUEUE = 'delete_queue',
  VIEW_PATIENTS = 'view_patients',
  ADD_PATIENTS = 'add_patients',
  EDIT_PATIENTS = 'edit_patients',
  DELETE_PATIENTS = 'delete_patients',
  UPLOAD_PATIENTS = 'upload_patients',

  // Message Management
  VIEW_MESSAGES = 'view_messages',
  CREATE_MESSAGE_TEMPLATE = 'create_message_template',
  EDIT_MESSAGE_TEMPLATE = 'edit_message_template',
  DELETE_MESSAGE_TEMPLATE = 'delete_message_template',
  CREATE_MESSAGE_CONDITION = 'create_message_condition',
  EDIT_MESSAGE_CONDITION = 'edit_message_condition',
  DELETE_MESSAGE_CONDITION = 'delete_message_condition',
  SEND_MESSAGES = 'send_messages',

  // User Management (Administration)
  VIEW_USERS = 'view_users',
  CREATE_USER = 'create_user',
  EDIT_USER = 'edit_user',
  DELETE_USER = 'delete_user',
  MANAGE_MODERATORS = 'manage_moderators',
  MANAGE_SECONDARY_ADMINS = 'manage_secondary_admins',
  VIEW_QUOTAS = 'view_quotas',
  EDIT_QUOTAS = 'edit_quotas',

  // System Management
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  VIEW_SYSTEM_SETTINGS = 'view_system_settings',
  EDIT_SYSTEM_SETTINGS = 'edit_system_settings',
  MANAGE_WHATSAPP_SESSIONS = 'manage_whatsapp_sessions',
}

/**
 * Action types for audit logging and permission checking
 */
export enum ActionType {
  // Message actions
  CREATE_MESSAGE_TEMPLATE = 'create_message_template',
  UPDATE_MESSAGE_TEMPLATE = 'update_message_template',
  DELETE_MESSAGE_TEMPLATE = 'delete_message_template',

  // User actions
  CREATE_USER = 'create_user',
  UPDATE_USER = 'update_user',
  DELETE_USER = 'delete_user',
  ASSIGN_MODERATOR = 'assign_moderator',

  // Queue actions
  CREATE_QUEUE = 'create_queue',
  UPDATE_QUEUE = 'update_queue',
  DELETE_QUEUE = 'delete_queue',

  // Patient actions
  ADD_PATIENT = 'add_patient',
  UPDATE_PATIENT = 'update_patient',
  DELETE_PATIENT = 'delete_patient',
  UPLOAD_PATIENTS = 'upload_patients',
}

/**
 * Role metadata - Display names and descriptions
 * Single source for UI text related to roles
 */
export const ROLE_METADATA: Record<UserRole, { displayName: string; description: string; color: string; icon: string }> = {
  [UserRole.PrimaryAdmin]: {
    displayName: 'المدير الأساسي',
    description: 'إدارة كاملة للنظام والمستخدمين والإعدادات',
    color: 'red',
    icon: 'shield',
  },
  [UserRole.SecondaryAdmin]: {
    displayName: 'المدير الثانوي',
    description: 'إدارة المشرفين والعيادات والرسائل',
    color: 'orange',
    icon: 'cog',
  },
  [UserRole.Moderator]: {
    displayName: 'المشرف',
    description: 'إدارة العيادات والمستخدمين والرسائل',
    color: 'blue',
    icon: 'user-tie',
  },
  [UserRole.User]: {
    displayName: 'مستخدم',
    description: 'عرض العيادات والمرضى والرسائل',
    color: 'gray',
    icon: 'user',
  },
};

/**
 * Permission matrix - Defines which roles can perform which features
 * Single source of truth for access control
 * 
 * SOLID: Single Responsibility - This object only defines permissions
 * Easy to extend: Just add new features and define who can access them
 */
export const ROLE_PERMISSIONS: Record<UserRole, Set<Feature>> = {
  [UserRole.PrimaryAdmin]: new Set([
    // Full access to everything
    Feature.VIEW_QUEUES,
    Feature.CREATE_QUEUE,
    Feature.EDIT_QUEUE,
    Feature.DELETE_QUEUE,
    Feature.VIEW_PATIENTS,
    Feature.ADD_PATIENTS,
    Feature.EDIT_PATIENTS,
    Feature.DELETE_PATIENTS,
    Feature.UPLOAD_PATIENTS,
    Feature.VIEW_MESSAGES,
    Feature.CREATE_MESSAGE_TEMPLATE,
    Feature.EDIT_MESSAGE_TEMPLATE,
    Feature.DELETE_MESSAGE_TEMPLATE,
    Feature.CREATE_MESSAGE_CONDITION,
    Feature.EDIT_MESSAGE_CONDITION,
    Feature.DELETE_MESSAGE_CONDITION,
    Feature.SEND_MESSAGES,
    Feature.VIEW_USERS,
    Feature.CREATE_USER,
    Feature.EDIT_USER,
    Feature.DELETE_USER,
    Feature.MANAGE_MODERATORS,
    Feature.MANAGE_SECONDARY_ADMINS,
    Feature.VIEW_QUOTAS,
    Feature.EDIT_QUOTAS,
    Feature.VIEW_AUDIT_LOGS,
    Feature.VIEW_SYSTEM_SETTINGS,
    Feature.EDIT_SYSTEM_SETTINGS,
    Feature.MANAGE_WHATSAPP_SESSIONS,
  ]),

  [UserRole.SecondaryAdmin]: new Set([
    // Can manage queues, messages, and moderators (but not primary admin)
    Feature.VIEW_QUEUES,
    Feature.CREATE_QUEUE,
    Feature.EDIT_QUEUE,
    Feature.DELETE_QUEUE,
    Feature.VIEW_PATIENTS,
    Feature.ADD_PATIENTS,
    Feature.EDIT_PATIENTS,
    Feature.DELETE_PATIENTS,
    Feature.UPLOAD_PATIENTS,
    Feature.VIEW_MESSAGES,
    Feature.CREATE_MESSAGE_TEMPLATE,
    Feature.EDIT_MESSAGE_TEMPLATE,
    Feature.DELETE_MESSAGE_TEMPLATE,
    Feature.CREATE_MESSAGE_CONDITION,
    Feature.EDIT_MESSAGE_CONDITION,
    Feature.DELETE_MESSAGE_CONDITION,
    Feature.SEND_MESSAGES,
    Feature.VIEW_USERS,
    Feature.CREATE_USER,
    Feature.EDIT_USER,
    Feature.DELETE_USER,
    Feature.MANAGE_MODERATORS,
    Feature.VIEW_QUOTAS,
    Feature.EDIT_QUOTAS,
    Feature.VIEW_AUDIT_LOGS,
  ]),

  [UserRole.Moderator]: new Set([
    // Can manage their own queues, patients, and messages
    Feature.VIEW_QUEUES,
    Feature.CREATE_QUEUE,
    Feature.EDIT_QUEUE,
    Feature.VIEW_PATIENTS,
    Feature.ADD_PATIENTS,
    Feature.EDIT_PATIENTS,
    Feature.UPLOAD_PATIENTS,
    Feature.VIEW_MESSAGES,
    Feature.CREATE_MESSAGE_TEMPLATE,
    Feature.EDIT_MESSAGE_TEMPLATE,
    Feature.DELETE_MESSAGE_TEMPLATE,
    Feature.CREATE_MESSAGE_CONDITION,
    Feature.EDIT_MESSAGE_CONDITION,
    Feature.DELETE_MESSAGE_CONDITION,
    Feature.SEND_MESSAGES,
    Feature.VIEW_USERS,
    Feature.MANAGE_WHATSAPP_SESSIONS,
  ]),

  [UserRole.User]: new Set([
    // Can view their moderator's queues and messages, and manage their own messages
    Feature.VIEW_QUEUES,
    Feature.VIEW_PATIENTS,
    Feature.VIEW_MESSAGES,
    Feature.CREATE_MESSAGE_TEMPLATE,
    Feature.EDIT_MESSAGE_TEMPLATE,
    Feature.DELETE_MESSAGE_TEMPLATE,
    Feature.CREATE_MESSAGE_CONDITION,
    Feature.EDIT_MESSAGE_CONDITION,
    Feature.DELETE_MESSAGE_CONDITION,
    Feature.SEND_MESSAGES,
  ]),
};

/**
 * Type-safe permission check - Always use this instead of string comparisons
 */
export type PermissionCheck = (role: UserRole, feature: Feature) => boolean;

/**
 * Audit action categories for logging
 */
export const ACTION_CATEGORIES: Record<ActionType, { category: string; severity: 'low' | 'medium' | 'high' }> = {
  [ActionType.CREATE_MESSAGE_TEMPLATE]: { category: 'Message Management', severity: 'medium' },
  [ActionType.UPDATE_MESSAGE_TEMPLATE]: { category: 'Message Management', severity: 'medium' },
  [ActionType.DELETE_MESSAGE_TEMPLATE]: { category: 'Message Management', severity: 'high' },
  [ActionType.CREATE_USER]: { category: 'User Management', severity: 'high' },
  [ActionType.UPDATE_USER]: { category: 'User Management', severity: 'medium' },
  [ActionType.DELETE_USER]: { category: 'User Management', severity: 'high' },
  [ActionType.ASSIGN_MODERATOR]: { category: 'User Management', severity: 'high' },
  [ActionType.CREATE_QUEUE]: { category: 'Queue Management', severity: 'medium' },
  [ActionType.UPDATE_QUEUE]: { category: 'Queue Management', severity: 'low' },
  [ActionType.DELETE_QUEUE]: { category: 'Queue Management', severity: 'high' },
  [ActionType.ADD_PATIENT]: { category: 'Patient Management', severity: 'low' },
  [ActionType.UPDATE_PATIENT]: { category: 'Patient Management', severity: 'low' },
  [ActionType.DELETE_PATIENT]: { category: 'Patient Management', severity: 'low' },
  [ActionType.UPLOAD_PATIENTS]: { category: 'Patient Management', severity: 'low' },
};

/**
 * Panel access control - Which roles can see which main panels
 * Used by Navigation and MainApp components
 */
export const PANEL_ACCESS: Record<string, UserRole[]> = {
  welcome: [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User],
  queues: [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User],
  messages: [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User],
  management: [UserRole.PrimaryAdmin, UserRole.SecondaryAdmin],
};

