/**
 * Excel Upload (UploadModal) Edge Case Tests
 * 
 * Tests verify the handleUpload logic for various edge cases including:
 * - Queue validation scenarios
 * - Column detection edge cases
 * - Data processing edge cases
 * - API failure scenarios
 * - Country code handling
 * 
 * Note: These are unit tests for the logic extracted from UploadModal.
 * They test the business logic independently of React components.
 */

// Mock API client for testing API scenarios
const mockPatientsApiClient = {
    createPatient: jest.fn(),
};

// Mock logger
const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
};

describe('Excel Upload Edge Cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Queue Validation', () => {
        const validateQueueId = (queueId: string | null): string | null => {
            if (!queueId) {
                return 'يجب تحديد عيادة';
            }
            const queueIdNum = Number(queueId);
            if (isNaN(queueIdNum)) {
                return 'معرف القائمة غير صحيح';
            }
            return null;
        };

        test('null queueId returns error', () => {
            expect(validateQueueId(null)).toBe('يجب تحديد عيادة');
        });

        test('empty string queueId returns error', () => {
            expect(validateQueueId('')).toBe('يجب تحديد عيادة');
        });

        test('non-numeric queueId returns error', () => {
            expect(validateQueueId('abc')).toBe('معرف القائمة غير صحيح');
        });

        test('valid numeric queueId passes', () => {
            expect(validateQueueId('123')).toBeNull();
        });

        test('zero queueId passes (valid numeric)', () => {
            expect(validateQueueId('0')).toBeNull();
        });
    });

    describe('Column Detection', () => {
        const findColumnIndex = (headers: (string | number)[], type: 'name' | 'phone' | 'country'): number => {
            if (type === 'name') {
                return headers.findIndex(h =>
                    h?.toString().includes('الاسم') || h?.toString().toLowerCase().includes('name')
                );
            } else if (type === 'phone') {
                return headers.findIndex(h =>
                    h?.toString().includes('هاتف') || h?.toString().toLowerCase().includes('phone')
                );
            } else {
                return headers.findIndex(h =>
                    h?.toString().includes('كود') || h?.toString().toLowerCase().includes('country')
                );
            }
        };

        test('finds Arabic name column', () => {
            const headers = ['الاسم الكامل', 'رقم الهاتف', 'كود الدولة'];
            expect(findColumnIndex(headers, 'name')).toBe(0);
        });

        test('finds English name column', () => {
            const headers = ['Full Name', 'Phone Number', 'Country Code'];
            expect(findColumnIndex(headers, 'name')).toBe(0);
        });

        test('finds Arabic phone column', () => {
            const headers = ['الاسم', 'رقم الهاتف', 'كود'];
            expect(findColumnIndex(headers, 'phone')).toBe(1);
        });

        test('finds English phone column (case insensitive)', () => {
            const headers = ['Name', 'PHONE', 'Country'];
            expect(findColumnIndex(headers, 'phone')).toBe(1);
        });

        test('returns -1 when name column not found', () => {
            const headers = ['Column A', 'Column B', 'Column C'];
            expect(findColumnIndex(headers, 'name')).toBe(-1);
        });

        test('returns -1 when phone column not found', () => {
            const headers = ['الاسم', 'عنوان', 'ملاحظات'];
            expect(findColumnIndex(headers, 'phone')).toBe(-1);
        });

        test('handles empty headers array', () => {
            expect(findColumnIndex([], 'name')).toBe(-1);
        });

        test('handles null/undefined values in headers', () => {
            const headers = [null, undefined, 'الاسم', 'هاتف'] as any;
            expect(findColumnIndex(headers, 'name')).toBe(2);
        });

        test('handles numeric values in headers', () => {
            const headers = [123, 'الاسم', 'هاتف'];
            expect(findColumnIndex(headers, 'name')).toBe(1);
        });
    });

    describe('Row Data Extraction', () => {
        interface RowData {
            fullName: string;
            phoneNumber: string;
            countryCode: string;
        }

        const extractRowData = (
            row: (string | number)[],
            nameIdx: number,
            phoneIdx: number,
            countryIdx: number,
            defaultCountryCode: string
        ): RowData => {
            return {
                fullName: row[nameIdx]?.toString().trim() || '',
                phoneNumber: row[phoneIdx]?.toString().trim() || '',
                countryCode: row[countryIdx]?.toString() || defaultCountryCode,
            };
        };

        const isRowValid = (data: RowData): boolean => {
            return data.fullName !== '' && data.phoneNumber !== '';
        };

        test('extracts valid row data', () => {
            const row = ['أحمد محمد', '+20', '01001234567'];
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(data.fullName).toBe('أحمد محمد');
            expect(data.phoneNumber).toBe('01001234567');
            expect(data.countryCode).toBe('+20');
        });

        test('trims whitespace from name and phone', () => {
            const row = ['  أحمد محمد  ', '+20', '  01001234567  '];
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(data.fullName).toBe('أحمد محمد');
            expect(data.phoneNumber).toBe('01001234567');
        });

        test('uses default country code when column value is empty', () => {
            const row = ['أحمد', '', '01001234567'];
            const data = extractRowData(row, 0, 2, 1, '+966');
            expect(data.countryCode).toBe('+966');
        });

        test('handles undefined values in row', () => {
            const row = [undefined, '+20', '01001234567'] as any;
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(data.fullName).toBe('');
            expect(isRowValid(data)).toBe(false);
        });

        test('handles null values in row', () => {
            const row = ['أحمد', null, null] as any;
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(data.phoneNumber).toBe('');
            expect(isRowValid(data)).toBe(false);
        });

        test('converts numeric values to strings', () => {
            const row = ['أحمد', 20, 1001234567];
            const data = extractRowData(row, 0, 2, 1, '+');
            expect(data.countryCode).toBe('20');
            expect(data.phoneNumber).toBe('1001234567');
        });

        test('empty name invalidates row', () => {
            const row = ['', '+20', '01001234567'];
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(isRowValid(data)).toBe(false);
        });

        test('empty phone invalidates row', () => {
            const row = ['أحمد', '+20', ''];
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(isRowValid(data)).toBe(false);
        });

        test('whitespace-only name invalidates row', () => {
            const row = ['   ', '+20', '01001234567'];
            const data = extractRowData(row, 0, 2, 1, '+20');
            expect(isRowValid(data)).toBe(false);
        });
    });

    describe('Country Code Edge Cases', () => {
        const resolveCountryCode = (
            cellValue: string,
            rowCustomCountries: { [key: string]: string },
            cellKey: string,
            defaultCode: string
        ): string => {
            if (cellValue === 'OTHER') {
                return rowCustomCountries[cellKey] || defaultCode;
            }
            return cellValue || defaultCode;
        };

        test('returns cell value for normal country code', () => {
            const result = resolveCountryCode('+20', {}, '1-1', '+966');
            expect(result).toBe('+20');
        });

        test('uses custom country from rowCustomCountries for OTHER', () => {
            const result = resolveCountryCode('OTHER', { '1-1': '+44' }, '1-1', '+20');
            expect(result).toBe('+44');
        });

        test('falls back to default when OTHER has no custom value', () => {
            const result = resolveCountryCode('OTHER', {}, '1-1', '+20');
            expect(result).toBe('+20');
        });

        test('returns default for empty cell value', () => {
            const result = resolveCountryCode('', {}, '1-1', '+20');
            expect(result).toBe('+20');
        });

        test('handles various country code formats', () => {
            expect(resolveCountryCode('+1', {}, '1-1', '+20')).toBe('+1');
            expect(resolveCountryCode('+44', {}, '1-1', '+20')).toBe('+44');
            expect(resolveCountryCode('+966', {}, '1-1', '+20')).toBe('+966');
            expect(resolveCountryCode('+971', {}, '1-1', '+20')).toBe('+971');
        });
    });

    describe('API Call Scenarios', () => {
        // Define the patient request interface locally
        interface PatientRequest {
            queueId: number;
            fullName: string;
            phoneNumber: string;
            countryCode: string;
        }

        interface ProcessResult {
            addedCount: number;
            failedCount: number;
            errors: string[];
        }

        const processPatients = async (
            patients: PatientRequest[],
            apiClient: { createPatient: jest.Mock }
        ): Promise<ProcessResult> => {
            let addedCount = 0;
            let failedCount = 0;
            const errors: string[] = [];

            for (const patient of patients) {
                try {
                    await apiClient.createPatient(patient);
                    addedCount++;
                } catch (err) {
                    failedCount++;
                    errors.push(err instanceof Error ? err.message : 'Unknown error');
                }
            }

            return { addedCount, failedCount, errors };
        };

        test('all patients created successfully', async () => {
            mockPatientsApiClient.createPatient.mockResolvedValue({ id: 1 });

            const patients = [
                { queueId: 1, fullName: 'أحمد', phoneNumber: '01001234567', countryCode: '+20' },
                { queueId: 1, fullName: 'محمد', phoneNumber: '01001234568', countryCode: '+20' },
            ];

            const result = await processPatients(patients, mockPatientsApiClient);

            expect(result.addedCount).toBe(2);
            expect(result.failedCount).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        test('all patients fail', async () => {
            mockPatientsApiClient.createPatient.mockRejectedValue(new Error('API Error'));

            const patients = [
                { queueId: 1, fullName: 'أحمد', phoneNumber: '01001234567', countryCode: '+20' },
                { queueId: 1, fullName: 'محمد', phoneNumber: '01001234568', countryCode: '+20' },
            ];

            const result = await processPatients(patients, mockPatientsApiClient);

            expect(result.addedCount).toBe(0);
            expect(result.failedCount).toBe(2);
            expect(result.errors).toEqual(['API Error', 'API Error']);
        });

        test('partial success (some patients fail)', async () => {
            mockPatientsApiClient.createPatient
                .mockResolvedValueOnce({ id: 1 })
                .mockRejectedValueOnce(new Error('Duplicate phone'))
                .mockResolvedValueOnce({ id: 2 });

            const patients = [
                { queueId: 1, fullName: 'أحمد', phoneNumber: '01001234567', countryCode: '+20' },
                { queueId: 1, fullName: 'محمد', phoneNumber: '01001234567', countryCode: '+20' }, // duplicate
                { queueId: 1, fullName: 'علي', phoneNumber: '01001234569', countryCode: '+20' },
            ];

            const result = await processPatients(patients, mockPatientsApiClient);

            expect(result.addedCount).toBe(2);
            expect(result.failedCount).toBe(1);
            expect(result.errors).toContain('Duplicate phone');
        });

        test('handles network timeout error', async () => {
            mockPatientsApiClient.createPatient.mockRejectedValue(new Error('Network timeout'));

            const patients = [
                { queueId: 1, fullName: 'أحمد', phoneNumber: '01001234567', countryCode: '+20' },
            ];

            const result = await processPatients(patients, mockPatientsApiClient);

            expect(result.failedCount).toBe(1);
            expect(result.errors).toContain('Network timeout');
        });

        test('handles non-Error rejection', async () => {
            mockPatientsApiClient.createPatient.mockRejectedValue('String error');

            const patients = [
                { queueId: 1, fullName: 'أحمد', phoneNumber: '01001234567', countryCode: '+20' },
            ];

            const result = await processPatients(patients, mockPatientsApiClient);

            expect(result.failedCount).toBe(1);
            expect(result.errors).toContain('Unknown error');
        });

        test('empty patients array returns zero counts', async () => {
            const result = await processPatients([], mockPatientsApiClient);

            expect(result.addedCount).toBe(0);
            expect(result.failedCount).toBe(0);
            expect(mockPatientsApiClient.createPatient).not.toHaveBeenCalled();
        });
    });

    describe('Preview Data Edge Cases', () => {
        const validatePreviewData = (data: (string | number)[][] | null): string | null => {
            if (!data) {
                return 'لا توجد بيانات للرفع';
            }
            if (data.length < 2) {
                return 'لا توجد بيانات للرفع';
            }
            return null;
        };

        test('null preview data returns error', () => {
            expect(validatePreviewData(null)).toBe('لا توجد بيانات للرفع');
        });

        test('empty array returns error', () => {
            expect(validatePreviewData([])).toBe('لا توجد بيانات للرفع');
        });

        test('only header row (length 1) returns error', () => {
            expect(validatePreviewData([['الاسم', 'الهاتف']])).toBe('لا توجد بيانات للرفع');
        });

        test('header + one data row passes', () => {
            const data = [
                ['الاسم', 'الهاتف'],
                ['أحمد', '01001234567'],
            ];
            expect(validatePreviewData(data)).toBeNull();
        });

        test('header + multiple data rows passes', () => {
            const data = [
                ['الاسم', 'الهاتف'],
                ['أحمد', '01001234567'],
                ['محمد', '01001234568'],
            ];
            expect(validatePreviewData(data)).toBeNull();
        });
    });

    describe('Cell Errors Validation', () => {
        const hasCellErrors = (cellErrors: { [key: string]: string }): boolean => {
            return Object.keys(cellErrors).length > 0;
        };

        test('empty cellErrors allows upload', () => {
            expect(hasCellErrors({})).toBe(false);
        });

        test('single cell error blocks upload', () => {
            expect(hasCellErrors({ '1-0': 'Invalid name' })).toBe(true);
        });

        test('multiple cell errors blocks upload', () => {
            const errors = {
                '1-0': 'Invalid name',
                '2-1': 'Invalid phone',
                '3-2': 'Invalid country code',
            };
            expect(hasCellErrors(errors)).toBe(true);
        });
    });

    describe('Result Message Generation', () => {
        const generateResultMessage = (addedCount: number, failedCount: number): string => {
            if (addedCount === 0) {
                return 'فشل إضافة المرضى';
            }
            if (failedCount > 0) {
                return `تم إضافة ${addedCount} مريض بنجاح (${failedCount} فشل)`;
            }
            return `تم رفع الملف بنجاح - تم إضافة ${addedCount} مريض`;
        };

        test('all success message', () => {
            expect(generateResultMessage(5, 0)).toBe('تم رفع الملف بنجاح - تم إضافة 5 مريض');
        });

        test('partial success message', () => {
            expect(generateResultMessage(3, 2)).toBe('تم إضافة 3 مريض بنجاح (2 فشل)');
        });

        test('all failed message', () => {
            expect(generateResultMessage(0, 5)).toBe('فشل إضافة المرضى');
        });

        test('single patient success', () => {
            expect(generateResultMessage(1, 0)).toBe('تم رفع الملف بنجاح - تم إضافة 1 مريض');
        });

        test('single patient fail', () => {
            expect(generateResultMessage(0, 1)).toBe('فشل إضافة المرضى');
        });
    });
});
