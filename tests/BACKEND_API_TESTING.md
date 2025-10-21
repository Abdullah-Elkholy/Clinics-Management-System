# Backend API Testing Guide

## Overview
This document provides manual testing steps for the newly implemented backend APIs:
- **TasksController**: Failed tasks management with bulk operations
- **SessionsController**: Ongoing message session tracking

## Prerequisites
1. API running on `http://localhost:5000`
2. Valid authentication token (use existing login flow)
3. Database populated with test data

## 1. Tasks API Endpoints

### 1.1 Get All Failed Tasks
**Endpoint**: `GET /api/Tasks/failed`

**Headers**:
```
Authorization: Bearer {your_access_token}
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "taskId": 1,
      "queueName": "د. أحمد محمد",
      "patientName": "خالد العمري",
      "phone": "966501234567",
      "message": "موعدك القادم يوم الأحد الساعة 10 صباحاً",
      "error": "فشل الاتصال بالخدمة",
      "errorDetails": "Connection timeout after 30 seconds",
      "retryCount": 2,
      "failedAt": "2024-01-20T10:30:00Z",
      "retryHistory": []
    }
  ]
}
```

**cURL Command**:
```bash
curl -X GET "http://localhost:5000/api/Tasks/failed" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 1.2 Retry Failed Tasks (Bulk)
**Endpoint**: `POST /api/Tasks/retry`

**Headers**:
```
Authorization: Bearer {your_access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "taskIds": [1, 2, 3]
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "retriedCount": 3,
    "errors": []
  }
}
```

**cURL Command**:
```bash
curl -X POST "http://localhost:5000/api/Tasks/retry" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taskIds": [1, 2, 3]}'
```

**Error Cases**:
- Empty taskIds array: `400 Bad Request`
- Task retry limit exceeded (>3): Returned in errors array
- Invalid taskId: Skipped (not in database)

---

### 1.3 Delete Failed Tasks (Bulk)
**Endpoint**: `DELETE /api/Tasks/failed`

**Headers**:
```
Authorization: Bearer {your_access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "taskIds": [1, 2, 3]
}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "deletedCount": 3
  }
}
```

**cURL Command**:
```bash
curl -X DELETE "http://localhost:5000/api/Tasks/failed" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taskIds": [1, 2, 3]}'
```

---

## 2. Sessions API Endpoints

### 2.1 Get Ongoing Sessions
**Endpoint**: `GET /api/Sessions/ongoing`

**Headers**:
```
Authorization: Bearer {your_access_token}
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "123e4567-e89b-12d3-a456-426614174000",
      "queueName": "د. أحمد محمد",
      "startTime": "2024-01-20T10:00:00Z",
      "total": 50,
      "sent": 23,
      "status": "active",
      "patients": [
        {
          "patientId": 1,
          "name": "خالد العمري",
          "phone": "966501234567",
          "status": "sent"
        },
        {
          "patientId": 2,
          "name": "محمد الشمري",
          "phone": "966509876543",
          "status": "pending"
        }
      ]
    }
  ]
}
```

**cURL Command**:
```bash
curl -X GET "http://localhost:5000/api/Sessions/ongoing" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2.2 Pause Session
**Endpoint**: `POST /api/Sessions/{id}/pause`

**Headers**:
```
Authorization: Bearer {your_access_token}
```

**Expected Response**:
```json
{
  "success": true
}
```

**cURL Command**:
```bash
curl -X POST "http://localhost:5000/api/Sessions/123e4567-e89b-12d3-a456-426614174000/pause" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Error Cases**:
- Session not found: `404 Not Found`
- Session not active: `400 Bad Request`

---

### 2.3 Resume Session
**Endpoint**: `POST /api/Sessions/{id}/resume`

**Headers**:
```
Authorization: Bearer {your_access_token}
```

**Expected Response**:
```json
{
  "success": true
}
```

**cURL Command**:
```bash
curl -X POST "http://localhost:5000/api/Sessions/123e4567-e89b-12d3-a456-426614174000/resume" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Error Cases**:
- Session not found: `404 Not Found`
- Session not paused: `400 Bad Request`

---

### 2.4 Delete/Cancel Session
**Endpoint**: `DELETE /api/Sessions/{id}`

**Headers**:
```
Authorization: Bearer {your_access_token}
```

**Expected Response**:
```json
{
  "success": true
}
```

**cURL Command**:
```bash
curl -X DELETE "http://localhost:5000/api/Sessions/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Error Cases**:
- Session not found: `404 Not Found`

---

## 3. Testing Workflow

### Step 1: Create Test Data
Before testing, you need to seed the database with test data:

```sql
-- Insert a test queue
INSERT INTO Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes)
VALUES ('د. أحمد محمد', 'عيادة الأسنان', 1, 1, 15);

-- Get the queue ID (assuming it's 1)
DECLARE @QueueId INT = 1;

-- Insert test patients
INSERT INTO Patients (QueueId, FullName, PhoneNumber, Position, Status)
VALUES 
  (@QueueId, 'خالد العمري', '966501234567', 1, 'waiting'),
  (@QueueId, 'محمد الشمري', '966509876543', 2, 'waiting'),
  (@QueueId, 'فاطمة الأحمدي', '966503456789', 3, 'waiting');

-- Insert test messages
INSERT INTO Messages (PatientId, QueueId, SenderUserId, RecipientPhone, Content, Status, Attempts, CreatedAt)
VALUES 
  (1, @QueueId, 1, '966501234567', 'موعدك القادم يوم الأحد', 'failed', 3, GETUTCDATE()),
  (2, @QueueId, 1, '966509876543', 'موعدك القادم يوم الإثنين', 'failed', 2, GETUTCDATE());

-- Insert failed tasks
INSERT INTO FailedTasks (MessageId, PatientId, QueueId, Reason, ProviderResponse, CreatedAt, RetryCount)
VALUES 
  (1, 1, @QueueId, 'فشل الاتصال', 'Connection timeout', GETUTCDATE(), 2),
  (2, 2, @QueueId, 'رقم غير صحيح', 'Invalid phone number', GETUTCDATE(), 1);

-- Insert test message session
INSERT INTO MessageSessions (Id, QueueId, UserId, Status, TotalMessages, SentMessages, StartTime)
VALUES 
  (NEWID(), @QueueId, 1, 'active', 50, 23, GETUTCDATE());
```

### Step 2: Test Failed Tasks APIs
1. Login to get access token
2. Call `GET /api/Tasks/failed` to see failed tasks
3. Call `POST /api/Tasks/retry` with some task IDs
4. Verify tasks are re-queued in Messages table
5. Call `DELETE /api/Tasks/failed` to clean up

### Step 3: Test Sessions APIs
1. Call `GET /api/Sessions/ongoing` to see active sessions
2. Call `POST /api/Sessions/{id}/pause` to pause a session
3. Verify session status changed to "paused"
4. Call `POST /api/Sessions/{id}/resume` to resume
5. Verify session status changed back to "active"
6. Call `DELETE /api/Sessions/{id}` to cancel session
7. Verify session status changed to "cancelled"

---

## 4. PowerShell Testing Script

```powershell
# Set your access token
$token = "YOUR_ACCESS_TOKEN_HERE"
$baseUrl = "http://localhost:5000"

# Test 1: Get Failed Tasks
Write-Host "Testing GET /api/Tasks/failed..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$baseUrl/api/Tasks/failed" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" }
Write-Host "Success: $($response.success), Tasks: $($response.data.Count)" -ForegroundColor Green

# Test 2: Retry Tasks
Write-Host "`nTesting POST /api/Tasks/retry..." -ForegroundColor Cyan
$body = @{ taskIds = @(1, 2) } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "$baseUrl/api/Tasks/retry" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body $body
Write-Host "Retried: $($response.data.retriedCount)" -ForegroundColor Green

# Test 3: Get Ongoing Sessions
Write-Host "`nTesting GET /api/Sessions/ongoing..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$baseUrl/api/Sessions/ongoing" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" }
Write-Host "Success: $($response.success), Sessions: $($response.data.Count)" -ForegroundColor Green

# Store first session ID for further tests
if ($response.data.Count -gt 0) {
    $sessionId = $response.data[0].sessionId
    
    # Test 4: Pause Session
    Write-Host "`nTesting POST /api/Sessions/$sessionId/pause..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$baseUrl/api/Sessions/$sessionId/pause" `
      -Method Post `
      -Headers @{ Authorization = "Bearer $token" }
    Write-Host "Success: $($response.success)" -ForegroundColor Green
    
    # Test 5: Resume Session
    Write-Host "`nTesting POST /api/Sessions/$sessionId/resume..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$baseUrl/api/Sessions/$sessionId/resume" `
      -Method Post `
      -Headers @{ Authorization = "Bearer $token" }
    Write-Host "Success: $($response.success)" -ForegroundColor Green
}

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
```

---

## 5. Expected Frontend Integration

The frontend is already configured to call these endpoints:

**Frontend Hook → Backend Endpoint Mapping**:
- `useFailedTasks()` → `GET /api/Tasks/failed` ✅
- `useRetryTasks()` → `POST /api/Tasks/retry` ✅
- `useDeleteFailedTasks()` → `DELETE /api/Tasks/failed` ✅
- `useOngoingSessions()` → `GET /api/Sessions/ongoing` ✅
- `usePauseSession()` → `POST /api/Sessions/{id}/pause` ✅
- `useResumeSession()` → `POST /api/Sessions/{id}/resume` ✅
- `useDeleteSession()` → `DELETE /api/Sessions/{id}` ✅

All API contracts match the frontend expectations! 🎉

---

## 6. Common Issues

### Issue 1: 401 Unauthorized
**Solution**: Ensure you have a valid access token. Login again if needed.

### Issue 2: Empty Failed Tasks
**Solution**: Run the test data SQL script above to populate FailedTasks table.

### Issue 3: Empty Sessions
**Solution**: Insert a test MessageSession record using the SQL script.

### Issue 4: CORS Errors (if testing from frontend)
**Solution**: Ensure CORS is configured in `Program.cs`:
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
```

---

## 7. Next Steps

After verifying the APIs work:
1. Start the frontend (`npm run dev` in apps/web)
2. Navigate to the dashboard
3. Verify tabs show real data from the backend
4. Test bulk retry/delete operations
5. Test session pause/resume controls

The frontend will automatically switch from MSW mocks to real backend APIs when the backend is running!
