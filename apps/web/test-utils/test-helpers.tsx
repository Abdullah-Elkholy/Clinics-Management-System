/**
 * Test Utilities: Mock Data and Sample DTOs
 * File: apps/web/test-utils/test-helpers.tsx
 *
 * Provides shared mock data for all tests across the frontend
 */

import type { User } from '@/types';
import type { Queue, Patient, MessageTemplate, MessageCondition } from '@/types';
import { UserRole } from '@/types/roles';

/**
 * Mock User Data
 */
export const mockUsers = {
  primaryAdmin: {
    id: 'user-primary-admin',
    username: 'primary_admin',
    firstName: 'أحمد',
    lastName: 'محمد',
    role: UserRole.PrimaryAdmin,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as unknown as User,
  secondaryAdmin: {
    id: 'user-secondary-admin',
    username: 'secondary_admin',
    firstName: 'علي',
    lastName: 'علي',
    role: UserRole.SecondaryAdmin,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as unknown as User,
  moderator: {
    id: 'user-moderator',
    username: 'moderator_1',
    firstName: 'فاطمة',
    lastName: 'أحمد',
    role: UserRole.Moderator,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as unknown as User,
  regularUser: {
    id: 'user-regular',
    username: 'user_1',
    firstName: 'محمد',
    lastName: 'علي',
    role: UserRole.User,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as unknown as User,
};

/**
 * Mock Queue Data
 */
export const mockQueues: Queue[] = [
  {
    id: '1',
    doctorName: 'د. أحمد محمد (أسنان)',
    moderatorId: 'user-moderator',
    isActive: true,
  } as unknown as Queue,
  {
    id: '2',
    doctorName: 'د. علي علي (باطنة)',
    moderatorId: 'user-moderator',
    isActive: true,
  } as unknown as Queue,
  {
    id: '3',
    doctorName: 'د. فاطمة سالم (جراحة)',
    moderatorId: 'user-secondary-admin',
    isActive: true,
  } as unknown as Queue,
];

/**
 * Mock Template Data
 */
export const mockTemplates = {
  template1: {
    id: '101',
    queueId: '1',
    title: 'ترحيب',
    content: 'مرحباً بك {PN}، أنت في الموضع {PQP}. الموضع الحالي {CQP}. يرجى الانتظار.',
    variables: ['PN', 'PQP', 'CQP'],
    isActive: true,
    createdAt: new Date(),
    createdBy: 'user-moderator',
  } as unknown as MessageTemplate,
  template2: {
    id: '102',
    queueId: '1',
    title: 'دورك قريب',
    content: 'دورك قادم قريباً! استعد للدخول.',
    variables: [],
    isActive: true,
    createdAt: new Date(),
    createdBy: 'user-moderator',
  } as unknown as MessageTemplate,
  template3: {
    id: '103',
    queueId: '2',
    title: 'انتظر طويل',
    content: 'وقت انتظارك قد يكون طويلاً. شكراً لصبرك.',
    variables: [],
    isActive: false,
    createdAt: new Date(),
    createdBy: 'user-moderator',
  } as unknown as MessageTemplate,
};

/**
 * Mock Condition Data
 */
export const mockConditions = {
  condition1: {
    id: '201',
    queueId: '1',
    templateId: '101',
    name: 'أولوية عالية',
    priority: 1,
    enabled: true,
    operator: 'EQUAL' as const,
    value: 1,
    createdAt: new Date(),
  } as unknown as MessageCondition,
  condition2: {
    id: '202',
    queueId: '1',
    templateId: '102',
    name: 'انتظار متوسط',
    priority: 2,
    enabled: true,
    operator: 'RANGE' as const,
    minValue: 3,
    maxValue: 5,
    createdAt: new Date(),
  } as unknown as MessageCondition,
};

/**
 * Mock Patient Data
 */
export const mockPatients: Patient[] = [
  {
    id: '1001',
    queueId: '1',
    name: 'أحمد عبدالله',
    phone: '+966501234567',
    position: 5,
    status: 'waiting',
    failureMetrics: { attempts: 0 },
    isPaused: false,
  } as unknown as Patient,
  {
    id: '1002',
    queueId: '1',
    name: 'فاطمة محمود',
    phone: '+966501234568',
    position: 3,
    status: 'in_service',
    failureMetrics: { attempts: 1 },
    isPaused: false,
  } as unknown as Patient,
];
