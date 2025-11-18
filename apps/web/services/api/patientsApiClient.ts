/**
 * Type-safe API client for Patients endpoint
 * Handles CRUD and reordering of patients in queues
 */

import { messageApiClient, type ListResponse } from './messageApiClient';

export interface PatientDto {
  id: number;
  fullName: string;
  phoneNumber: string;
  countryCode?: string;
  isValidWhatsAppNumber?: boolean | null;
  position: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  updatedBy?: number;
}

export interface CreatePatientRequest {
  queueId: number;
  fullName: string;
  phoneNumber: string;
  countryCode?: string;
  position?: number;
}

export interface UpdatePatientRequest {
  fullName?: string;
  phoneNumber?: string;
  countryCode?: string;
  status?: string;
}

export interface ReorderPatientsRequest {
  queueId: number;
  items: Array<{ id: number; position: number }>;
}

/**
 * Get all patients for a queue
 */
export async function getPatients(queueId: number): Promise<ListResponse<PatientDto>> {
  return messageApiClient.fetchAPI(`/patients?queueId=${queueId}`);
}

/**
 * Get a single patient by ID
 */
export async function getPatient(id: number): Promise<PatientDto> {
  return messageApiClient.fetchAPI(`/patients/${id}`);
}

/**
 * Create a new patient in a queue
 */
export async function createPatient(data: CreatePatientRequest): Promise<PatientDto> {
  return messageApiClient.fetchAPI('/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing patient
 */
export async function updatePatient(id: number, data: UpdatePatientRequest): Promise<PatientDto> {
  return messageApiClient.fetchAPI(`/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a patient from a queue
 */
export async function deletePatient(id: number): Promise<void> {
  return messageApiClient.fetchAPI(`/patients/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Update a patient's position
 */
export async function updatePatientPosition(id: number, position: number): Promise<PatientDto> {
  return messageApiClient.fetchAPI(`/patients/${id}/position`, {
    method: 'PATCH',
    body: JSON.stringify({ position }),
  });
}

/**
 * List deleted patients in trash (soft-deleted within 30 days)
 */
export async function getTrashPatients(queueId: number, options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<PatientDto>> {
  const params = new URLSearchParams();
  params.append('queueId', queueId.toString());
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }

  const queryString = params.toString();
  return messageApiClient.fetchAPI(`/patients/trash/list?${queryString}`);
}

/**
 * List permanently deleted patients (archived, soft-deleted over 30 days)
 * Admin only
 */
export async function getArchivedPatients(queueId: number, options?: {
  pageNumber?: number;
  pageSize?: number;
}): Promise<ListResponse<PatientDto>> {
  const params = new URLSearchParams();
  params.append('queueId', queueId.toString());
  if (options?.pageNumber !== undefined) {
    params.append('pageNumber', options.pageNumber.toString());
  }
  if (options?.pageSize !== undefined) {
    params.append('pageSize', options.pageSize.toString());
  }

  const queryString = params.toString();
  return messageApiClient.fetchAPI(`/patients/archived/list?${queryString}`);
}

/**
 * Restore a deleted patient from trash (within 30-day window)
 */
export async function restorePatient(id: number): Promise<PatientDto> {
  return messageApiClient.fetchAPI(`/patients/${id}/restore`, {
    method: 'POST',
  });
}

/**
 * Reorder patients in a queue atomically
 * If a position conflict occurs, the conflicting patient and all with greater positions shift +1
 */
export async function reorderPatients(req: ReorderPatientsRequest): Promise<void> {
  return messageApiClient.fetchAPI('/patients/reorder', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// Export for use in frontend
export const patientsApiClient = {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  updatePatientPosition,
  deletePatient,
  reorderPatients,
  getTrashPatients,
  getArchivedPatients,
  restorePatient,
};

export default patientsApiClient;
