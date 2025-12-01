# Phase 6 Testing and Validation Guide

## Overview
This document provides comprehensive testing procedures for validating the implementation of phases 1-5 from PERFORMANCE_RESEARCH_AND_CDC_ANALYSIS.md Section 15.

## Test Categories

### 1. Backend Integration Tests (Automated)
**File**: `tests/ClinicsManagementService.IntegrationTests/Controllers/OperationCoordinatorIntegrationTests.cs`

#### Run Tests:
```powershell
# Navigate to test project
cd tests\ClinicsManagementService.IntegrationTests

# Run all operation coordinator tests
dotnet test --filter "FullyQualifiedName~OperationCoordinatorIntegrationTests"

# Run specific test category
dotnet test --filter "FullyQualifiedName~OperationCoordinatorIntegrationTests.GetCompletedSessions"
```

#### Test Coverage:
- ✅ CompletedSessions endpoint returns new DTO structure
- ✅ CompletedSessions only returns sent messages (Status="sent" AND ErrorMessage IS NULL)
- ✅ check-authentication endpoint coordinates operations (pause → check → resume)
- ✅ check-whatsapp endpoint coordinates operations
- ✅ send-single endpoint checks for PendingQR before sending
- ✅ PendingQR detection pauses tasks and updates DB to "pending"
- ✅ PendingNET detection pauses tasks but does NOT update DB

---

### 2. Frontend E2E Tests (Manual)

#### 2.1 CompletedTasksPanel Tests

**Prerequisites**: 
- At least one completed session with sent messages
- At least one session with failed messages

**Test Steps**:

1. **Navigate to Completed Tasks Panel**
   - Login as moderator or admin
   - Navigate to "المهام المكتملة" (Completed Tasks)
   - **Expected**: Panel loads successfully

2. **Verify New DTO Structure**
   - Open browser DevTools → Network tab
   - Refresh the page
   - Find request to `/api/sessions/completed`
   - Check response structure:
     ```json
     {
       "success": true,
       "data": [{
         "sessionId": "...",
         "queueId": 1,
         "total": 10,
         "sent": 8,
         "failed": 2,
         "hasFailedMessages": true,
         "sentMessages": [
           {
             "messageId": "guid-string",
             "patientId": 1,
             "patientName": "Patient Name",
             "patientPhone": "1234567890",
             "countryCode": "+20",
             "content": "Resolved message content",
             "sentAt": "2025-11-26T...",
             "createdBy": 1,
             "updatedBy": 1
           }
         ]
       }]
     }
     ```
   - **Expected**: Response matches new structure

3. **Verify Session Stats Display**
   - Expand a completed session
   - **Expected**: 4-column grid showing:
     - إجمالي المرضى (Total Patients)
     - الرسائل المرسلة (Sent Messages)
     - الرسائل الفاشلة (Failed Messages) ← **NEW**
     - معدل النجاح (Success Rate)

4. **Verify Failed Messages Disclaimer**
   - For a session with `hasFailedMessages: true`
   - **Expected**: Yellow disclaimer box appears:
     - Icon: ⚠️ exclamation triangle
     - Title: "تنبيه: يوجد رسائل فاشلة في هذه الجلسة"
     - Content mentions failed count and redirects to Failed Tasks panel

5. **Verify Sent Messages Table**
   - Expand a session
   - **Expected**: 
     - Table header: "الرسائل المرسلة بنجاح" (Successfully Sent Messages)
     - Columns: Name, Phone, Message, Completion Time
     - Only successfully sent messages displayed
     - Message content is resolved (no template variables like `{{PatientName}}`)

6. **Verify Message.id is Guid**
   - Check table row keys in DevTools Elements
   - **Expected**: Keys are Guid strings, not numbers

---

#### 2.2 BrowserStatusPanel Tests

**Test Steps**:

1. **Navigate to Browser Status Panel**
   - Login as moderator
   - Navigate to browser status section
   - **Expected**: Panel loads with current browser state

2. **Verify Info Box (Not Refreshing)**
   - **Expected**: Blue info box visible with:
     - Icon: ℹ️ info circle
     - Title: "ملاحظة هامة"
     - Content: Explains that clicking refresh will pause all sending operations temporarily

3. **Click Refresh Button**
   - Click "تحديث" (Refresh) button
   - **Expected**:
     - Blue info box disappears
     - Yellow loading notice appears:
       - Icon: ⏳ spinning
       - Title: "جاري التحقق من حالة المصادقة..."
       - Content: "تم إيقاف جميع عمليات إرسال الرسائل مؤقتًا"

4. **Verify Backend Coordination**
   - Open browser DevTools → Network tab
   - Click refresh
   - Find request to `/api/WhatsAppUtility/check-authentication`
   - **Expected**: 
     - Request includes `moderatorUserId` parameter
     - Response is OperationResult with state: Success/PendingQR/PendingNET

5. **Verify Toast Messages**
   - **If authenticated**: Green toast "تم تحديث حالة المتصفح بنجاح - واتساب مصادق عليه"
   - **If PendingQR**: Orange toast "تحديث الحالة: يتطلب مسح رمز QR للمصادقة"
   - **If PendingNET**: Orange toast "تحديث الحالة: فشل الاتصال بالشبكة"

---

#### 2.3 Navigation Tests (User Role)

**Prerequisites**: 
- User account with assigned moderator
- At least one queue for that moderator

**Test Steps**:

1. **Login as User**
   - Login with user credentials
   - **Expected**: Dashboard loads

2. **Verify Queue Filtering**
   - Check sidebar queue list
   - **Expected**: 
     - Only queues where `moderatorId === user.assignedModerator` are shown
     - User cannot see queues from other moderators

3. **Verify in DevTools**
   - Open DevTools → Console
   - Check user object: `user.assignedModerator`
   - **Expected**: assignedModerator field exists and contains moderator ID

4. **Verify No moderatorId Field**
   - In console, check: `user.moderatorId`
   - **Expected**: Should be undefined (we use assignedModerator instead)

---

#### 2.4 PendingQR/PendingNET Handling Tests

**Test Scenario 1: PendingQR Detection**

1. **Setup**:
   - Logout of WhatsApp Web in the browser session
   - Or ensure session requires QR scan

2. **Test check-whatsapp**:
   - Navigate to queue
   - Try to check a patient's WhatsApp number
   - **Expected**: 
     - BadRequest response immediately
     - Error message: "جلسة الواتساب تحتاج إلى المصادقة"
     - No actual check attempt made

3. **Test send-single**:
   - Try to send a single message
   - **Expected**: 
     - BadRequest response immediately
     - Same authentication required error

4. **Test check-authentication**:
   - Navigate to browser status panel
   - Click refresh
   - **Expected**:
     - PendingQR state returned
     - Orange toast with QR scan message
     - Tasks remain paused

**Test Scenario 2: PendingNET Detection**

1. **Setup**:
   - Disable internet connection or block WhatsApp Web domain

2. **Test check-authentication**:
   - Click browser refresh
   - **Expected**:
     - PendingNET state returned
     - Orange toast about network failure
     - Tasks paused
     - Database status NOT updated (verify in DB)

3. **Verify Task Pause**:
   - Check ongoing tasks panel
   - **Expected**: All "sending" tasks should be paused

4. **Re-enable Connection**:
   - Enable internet
   - Click refresh again
   - **Expected**: Tasks resume automatically

---

### 3. Database Verification Tests

#### 3.1 Message.Id Migration

**SQL Query**:
```sql
-- Verify Message.Id is Guid (string)
SELECT TOP 5 
    Id, 
    PatientId, 
    PatientPhone, 
    Content,
    Status,
    CreatedAt
FROM Messages
ORDER BY CreatedAt DESC;
```

**Expected**:
- `Id` column contains Guid values (e.g., `A1B2C3D4-...`)
- Not sequential integers

#### 3.2 CompletedSessions Query

**SQL Query**:
```sql
-- Verify only sent messages with no errors
SELECT 
    m.Id,
    m.PatientName,
    m.Status,
    m.ErrorMessage,
    m.SentAt
FROM Messages m
WHERE m.Status = 'sent'
ORDER BY m.SentAt DESC;
```

**Expected**:
- All returned messages have Status = 'sent'
- All have ErrorMessage IS NULL
- All have SentAt timestamp

#### 3.3 WhatsAppSession Pause State

**SQL Query**:
```sql
-- Check global pause state
SELECT 
    ModeratorUserId,
    Status,
    IsPaused,
    PauseReason,
    LastPausedBy,
    LastPausedAt
FROM WhatsAppSessions
WHERE ModeratorUserId = 1;
```

**Expected**:
- `IsPaused` is boolean (true/false)
- When paused, `PauseReason` contains reason string
- `LastPausedBy` contains user ID who paused
- `LastPausedAt` contains timestamp

---

### 4. Performance Tests

#### 4.1 Operation Coordination Performance

**Test**: Measure time for check-authentication with/without ongoing operations

**Steps**:
1. Start bulk message sending (100+ messages)
2. Immediately click browser refresh
3. Measure time to complete

**Expected**:
- Maximum 30 seconds wait for operations to finish
- If operations don't finish in 30s, proceeds anyway
- Total time < 35 seconds

#### 4.2 CompletedSessions Query Performance

**Test**: Verify query performance with large datasets

**SQL Query**:
```sql
-- Enable statistics
SET STATISTICS TIME ON;
SET STATISTICS IO ON;

-- Execute query
EXEC GetCompletedSessions @ModeratorId = 1;

-- Disable statistics
SET STATISTICS TIME OFF;
SET STATISTICS IO OFF;
```

**Expected**:
- Query execution time < 500ms for 1000+ messages
- Uses proper indexes
- No table scans on Messages table

---

### 5. Error Handling Tests

#### 5.1 Browser Closed During Operation

**Test Steps**:
1. Start check-authentication or send-single
2. Manually close browser session during operation
3. **Expected**:
   - Exception caught
   - Tasks paused with reason "Browser closed intentionally"
   - Warning message returned (not error)
   - Next operation creates new session

#### 5.2 Cancellation Token Handling

**Test Steps**:
1. Start long-running operation (authenticate with QR)
2. Cancel request (close browser tab or Ctrl+C)
3. **Expected**:
   - OperationCanceledException caught
   - Tasks resumed in catch block
   - No hanging operations

---

## Test Results Documentation

### Test Run Template

```markdown
## Test Run: [Date/Time]
**Tester**: [Name]
**Environment**: [Development/Staging/Production]

### Backend Tests
- [ ] OperationCoordinatorIntegrationTests: PASS/FAIL
  - CompletedSessions: ___
  - check-authentication: ___
  - check-whatsapp: ___
  - PendingQR handling: ___
  - PendingNET handling: ___

### Frontend Tests
- [ ] CompletedTasksPanel: PASS/FAIL
  - DTO structure: ___
  - Stats display: ___
  - Failed disclaimer: ___
  - Sent messages table: ___
  
- [ ] BrowserStatusPanel: PASS/FAIL
  - Info boxes: ___
  - Refresh coordination: ___
  - Toast messages: ___

- [ ] Navigation (User role): PASS/FAIL
  - Queue filtering: ___
  - assignedModerator: ___

- [ ] PendingQR/PendingNET: PASS/FAIL
  - Detection: ___
  - Task pause: ___
  - DB updates: ___

### Database Tests
- [ ] Message.Id Guid: PASS/FAIL
- [ ] WhatsAppSession pause: PASS/FAIL
- [ ] CompletedSessions query: PASS/FAIL

### Performance Tests
- [ ] Operation coordination: PASS/FAIL
- [ ] CompletedSessions performance: PASS/FAIL

### Issues Found
[List any issues or bugs discovered]

### Notes
[Additional observations or comments]
```

---

## Regression Testing Checklist

Verify that existing functionality still works:

- [ ] User authentication and authorization
- [ ] Queue creation and management
- [ ] Patient management (add/edit/delete)
- [ ] Message template management
- [ ] Bulk message sending (without coordination)
- [ ] Ongoing tasks panel display
- [ ] Failed tasks panel display
- [ ] WhatsApp authentication flow
- [ ] Browser session management
- [ ] Moderator settings

---

## Sign-Off

**Phase 6 Testing Complete**: _____ (Date)

**Backend Integration Tests**: PASS / FAIL / PARTIAL
**Frontend E2E Tests**: PASS / FAIL / PARTIAL  
**Database Verification**: PASS / FAIL / PARTIAL
**Performance Tests**: PASS / FAIL / PARTIAL
**Error Handling Tests**: PASS / FAIL / PARTIAL

**Approved for Production**: YES / NO / WITH ISSUES

**Tester Signature**: _____________________
**Date**: _____________________
