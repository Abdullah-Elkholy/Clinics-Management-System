/**
 * Type-safe API client for Patients endpoint
 * Handles CRUD and reordering of patients in queues
 */

import { messageApiClient, type ListResponse } from './messageApiClient';

export interface PatientDto {
  id: number;
  fullName: string;
  phoneNumber: string;
  position: number;
  status: string;
}

export interface CreatePatientRequest {
  queueId: number;
  fullName: string;
  phoneNumber: string;
  position?: number;
}

export interface UpdatePatientRequest {
  fullName?: string;
  phoneNumber?: string;
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
  deletePatient,
  reorderPatients,
};

export default patientsApiClient;
