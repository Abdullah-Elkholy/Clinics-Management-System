export const mockQueues = [
  { id: 'q1', name: 'طابور الأول', currentPosition: 1, estimatedTime: 15, patientCount: 5, patients: [ { id: 101, fullName: 'Ali', position: 1 }, { id: 102, fullName: 'Sara', position: 2 } ] },
  { id: 'q2', name: 'طابور الثاني', description: 'وصف الطابور', currentPosition: 2, estimatedTime: 20, patientCount: 3, patients: [ { id: 201, fullName: 'Zainab', position: 1 } ] }
];

export const mockPatients = [
  { id: 'p1', fullName: 'أحمد محمد', phoneNumber: '123456789', position: 1 },
  { id: 'p2', fullName: 'محمد علي', phoneNumber: '987654321', position: 2 }
];

export const mockTemplates = [
  { id: 't1', content: 'مرحباً {{name}}، دورك رقم {{position}}' },
  { id: 't2', content: 'تم تأكيد موعدك' }
];

import { ROLES } from '../lib/roles'

export const mockUser = {
  id: '1',
  name: 'أحمد',
  email: 'test@example.com',
  role: ROLES.PRIMARY_ADMIN,
};
