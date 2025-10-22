# 📋 Clinics Management System - Prototype Implementation Guide

## Overview

This document provides a complete tour of the prototype and detailed specifications for implementing each feature in your actual system.

**Prototype Location**: `External Documents (related)/Prototype.html`  
**URL**: http://localhost:8888/Prototype.html  
**Test Credentials**:
- **Primary Admin**: admin / admin123
- **Secondary Admin**: admin2 / admin123
- **Moderator**: mod1 / mod123
- **User**: user1 / user123

---

## 📊 System Architecture Overview

### User Roles & Permissions

```
1. Primary Admin (مدير أساسي)
   └─ Full system access
   └─ Can manage all queues, users, quotas, messages
   └─ WhatsApp integration management
   └─ System settings
   └─ User management

2. Secondary Admin (مدير ثانوي)
   └─ Limited admin access
   └─ Can manage assigned queues
   └─ Can manage assigned users
   └─ Cannot access some admin settings

3. Moderator (مشرف)
   └─ Can manage their own queues
   └─ Can add/manage patients in queues
   └─ Can send messages to patients
   └─ View performance metrics
   └─ Cannot delete queues

4. User (مستخدم)
   └─ View-only access
   └─ Can see their queue status
   └─ Can receive messages
   └─ Limited to read operations
```

---

## 🎨 UI Components & Features

### 1. Login Screen

**Current Implementation**: Static HTML form  
**Backend Required**: `/api/Auth/login` endpoint

**Features**:
- ✅ Username & password input
- ✅ RTL Arabic layout
- ✅ Test credentials display
- ✅ Responsive design

**Implementation Checklist**:
```
□ Authenticate with backend
□ Store JWT token in localStorage
□ Store user role for UI filtering
□ Redirect to dashboard on success
□ Show error messages on failure
□ Remember "stay logged in" option
```

**API Integration**:
```javascript
// POST /api/Auth/login
{
  "username": "admin",
  "password": "admin123"
}

// Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "primary_admin",
      "fullName": "المدير الأساسي"
    }
  }
}
```

---

### 2. Main Dashboard - Navigation

**Components**:
- Header with logo, app name, user role, logout button
- Sidebar navigation
- WhatsApp connection status indicator
- Tab-based content area

**Navigation Items** (role-based):

| Feature | Primary Admin | Secondary Admin | Moderator | User |
|---------|:---:|:---:|:---:|:---:|
| Messages | ✅ | ✅ | ✅ | ❌ |
| Management | ✅ | ✅ | ✅ | ❌ |
| Analytics | ✅ | ✅ | ✅ | ❌ |

**Implementation**:
```jsx
// Show/hide nav items based on role
const navItems = {
  "primary_admin": ["messages", "management", "analytics", "settings"],
  "secondary_admin": ["messages", "management", "analytics"],
  "moderator": ["messages", "management", "analytics"],
  "user": ["dashboard"]
}
```

---

### 3. Messages Section - Main Features

#### 3.1 Message Status Dashboard

**Tabs**:
1. **Dashboard (لوحة التحكم)**
   - Overview of all messages
   - Status summary cards
   - Recent activities

2. **Ongoing (جارية)**
   - Messages currently being sent
   - Retry queue
   - Performance metrics

3. **Failed (فشلت)**
   - Failed message logs
   - Reason for failure
   - Retry options

**Implementation**:
```javascript
// Message Status Types
{
  PENDING: "قيد الانتظار",
  SENDING: "جاري الإرسال",
  SENT: "تم الإرسال",
  DELIVERED: "تم التسليم",
  FAILED: "فشل الإرسال",
  RETRY: "إعادة محاولة"
}

// Message Object Structure
{
  id: 1,
  phoneNumber: "+966501234567",
  messageContent: "مرحباً بك في العيادة",
  status: "SENT",
  createdAt: "2025-10-22T10:30:00Z",
  deliveredAt: "2025-10-22T10:31:00Z",
  failureReason: null,
  retryCount: 0
}
```

#### 3.2 Quick Actions - Dashboard Tab

**Buttons**:

1. **Add Patient (إضافة مريض)**
   - Opens modal to add single patient
   - Input: Name, Phone, Queue selection

2. **Upload Patients (رفع المرضى)**
   - Excel file upload
   - Bulk import functionality
   - Duplicate detection

3. **Delete Selected (حذف المحددة)**
   - Bulk delete with confirmation
   - Checkbox selection

4. **Send to Selected (إرسال للمحددين)**
   - Select patients
   - Choose message template
   - Preview before sending

**Implementation**:
```javascript
// Patient Model
{
  id: 1,
  name: "محمد علي",
  phoneNumber: "+966501234567",
  queueId: 5,
  addedAt: "2025-10-22T10:00:00Z",
  status: "ACTIVE", // or PENDING_APPOINTMENT, COMPLETED
  notes: "مريض جديد"
}

// Queue Model
{
  id: 5,
  name: "عيادة الأسنان",
  clinic: "عيادة الأسنان المتخصصة",
  moderatorId: 2,
  capacity: 20,
  estimatedTimePerSession: 15, // minutes
  currentPosition: 5,
  status: "ACTIVE", // or PAUSED, CLOSED
  createdAt: "2025-01-15T08:00:00Z"
}
```

---

### 4. Management Section

#### 4.1 Queue Management

**Features**:
- Create new queues
- Edit existing queues
- Pause/Resume queues
- Set capacity and timing
- View queue statistics

**Queue Creation Form**:
```json
{
  "name": "عيادة الأسنان - الطابق الأول",
  "clinic": "عيادة الأسنان المتخصصة",
  "estimatedTimePerSession": 15,
  "capacity": 30,
  "description": "عيادة متخصصة في تسحيح الأسنان"
}
```

**Implementation**:
```javascript
// GET /api/Queues
// Returns: { success: true, data: [Queue[], Queue[], ...] }

// POST /api/Queues
// Create new queue
{
  "name": "...",
  "clinic": "...",
  "estimatedTimePerSession": 15,
  "capacity": 30
}

// PATCH /api/Queues/{id}
// Update queue

// DELETE /api/Queues/{id}
// Delete queue

// POST /api/Queues/{id}/pause
// Pause queue (stop accepting patients)

// POST /api/Queues/{id}/resume
// Resume queue
```

#### 4.2 Patient Management

**Features**:
- View all patients in queue
- Add individual patient
- Bulk upload from Excel
- Delete patients
- Edit patient details

**Bulk Upload Format** (Excel):
```
| Name         | Phone Number   | Notes           |
|--------------|----------------|-----------------|
| محمد علي     | 0501234567     | مريض جديد       |
| فاطمة حسن    | 0509876543     | متابعة          |
```

**Implementation**:
```javascript
// POST /api/Patients/bulk
{
  "queueId": 5,
  "patients": [
    { "name": "محمد", "phoneNumber": "0501234567" },
    { "name": "فاطمة", "phoneNumber": "0509876543" }
  ]
}

// POST /api/Patients
// Add single patient
{
  "name": "محمد علي",
  "phoneNumber": "0501234567",
  "queueId": 5
}

// DELETE /api/Patients/{id}
// Delete patient

// PATCH /api/Patients/{id}
// Update patient info
```

---

### 5. Messages Feature - Advanced

#### 5.1 Message Templates

**Template Variables**:
- `{CQP}` - Current Queue Position (الموضع الحالي للطابور)
- `{PQP}` - Patient Queue Position (موضع المريض في الطابور)
- `{ETS}` - Estimated Time per Session (الوقت المقدر للجلسة)
- `{ETR}` - Estimated Time Remaining (الوقت المتبقي المقدر)
- `{PN}` - Patient Name (اسم المريض)

**Example Template**:
```
السلام عليكم {PN}،

موضعك الحالي في الطابور: {PQP} من {CQP}
الوقت المتبقي المقدر: {ETR} دقيقة

نتطلع لرؤيتك قريباً
```

**Implementation**:
```javascript
// Message Template Model
{
  id: 1,
  name: "تذكير موعد",
  content: "السلام عليكم {PN}، موضعك {PQP} من {CQP}",
  variables: ["{PN}", "{PQP}", "{CQP}"],
  createdBy: 1,
  createdAt: "2025-10-22T10:00:00Z"
}

// Template Variable Replacement
function replaceVariables(template, patient, queue) {
  return template
    .replace('{PN}', patient.name)
    .replace('{PQP}', patient.position)
    .replace('{CQP}', queue.currentPosition)
    .replace('{ETS}', queue.estimatedTimePerSession)
    .replace('{ETR}', calculateTimeRemaining(patient, queue))
}
```

#### 5.2 Message Selection & Preview

**Flow**:
1. User selects conditions (which patients to send to)
2. Chooses message template
3. Views preview of messages
4. Confirms and sends
5. Messages queued for sending

**Conditions Available**:
- By Queue
- By Patient Status
- By Custom Filters
- Manual Selection

**Implementation**:
```javascript
// Message Selection Model
{
  condition: "queue", // or "status", "custom", "manual"
  queueId: 5,
  messageTemplate: 1,
  selectedPatients: [1, 2, 3],
  previewCount: 3,
  status: "PENDING"
}

// POST /api/Messages/bulk
{
  "queueId": 5,
  "templateId": 1,
  "condition": {
    "type": "queue",
    "queueId": 5
  }
}
```

---

### 6. WhatsApp Integration

#### 6.1 WhatsApp Authentication

**Features**:
- Scan QR code for WhatsApp Web connection
- Connection status indicator
- Account verification

**Implementation**:
```javascript
// WhatsApp Authentication Flow
// 1. User clicks "Authenticate WhatsApp"
// 2. Backend generates QR code
// 3. User scans with WhatsApp
// 4. Connection established
// 5. Status indicator shows "Connected"

// GET /api/WhatsApp/auth/qr
// Returns: { qrCode: "data:image/png;base64,..." }

// GET /api/WhatsApp/status
// Returns: { connected: true, accountName: "..." }

// POST /api/WhatsApp/logout
// Disconnect WhatsApp
```

#### 6.2 WhatsApp Message Sending

**Features**:
- Send messages via WhatsApp
- Track delivery status
- Handle errors and retries
- Queue management

**Implementation**:
```javascript
// WhatsApp Message Sending
// POST /api/Messages/send-whatsapp
{
  "patientId": 1,
  "messageContent": "السلام عليكم محمد، موضعك الحالي 5 من 12",
  "queueId": 5
}

// Response:
{
  "success": true,
  "data": {
    "messageId": "msg_123",
    "status": "SENT",
    "timestamp": "2025-10-22T10:30:00Z"
  }
}

// Message Status Callback (Webhook)
// POST /api/Webhooks/whatsapp/status
{
  "messageId": "msg_123",
  "status": "DELIVERED",
  "timestamp": "2025-10-22T10:31:00Z"
}
```

---

### 7. Task Management

#### 7.1 Ongoing Tasks

**Features**:
- View all active message sending tasks
- Pause/Resume all tasks
- Individual task control
- Progress indicators

**Implementation**:
```javascript
// Task Model
{
  id: 1,
  type: "SEND_MESSAGE",
  status: "RUNNING", // or PAUSED, COMPLETED, FAILED
  progress: 45, // percentage
  totalItems: 100,
  completedItems: 45,
  failedItems: 2,
  startedAt: "2025-10-22T10:00:00Z",
  estimatedCompletion: "2025-10-22T10:15:00Z"
}

// Pause all tasks
// POST /api/Tasks/pause-all

// Resume all tasks
// POST /api/Tasks/resume-all
```

#### 7.2 Failed Tasks

**Features**:
- View failed message logs
- Failure reasons
- Retry options
- Delete failed items

**Implementation**:
```javascript
// Failed Message Log
{
  id: 1,
  messageId: "msg_123",
  patientPhone: "+966501234567",
  status: "FAILED",
  failureReason: "Invalid phone number",
  retryCount: 2,
  failedAt: "2025-10-22T10:30:00Z",
  lastAttempt: "2025-10-22T10:35:00Z"
}

// DELETE /api/Messages/{id}/failed
// Delete failed message

// POST /api/Messages/{id}/retry
// Retry failed message
```

---

### 8. Settings & Account

#### 8.1 Account Information

**Features**:
- View user profile
- Change password
- Update account info
- Account status

**Implementation**:
```javascript
// User Profile Model
{
  id: 1,
  username: "admin",
  email: "admin@clinic.com",
  fullName: "المدير الأساسي",
  role: "primary_admin",
  phone: "0501234567",
  createdAt: "2025-01-01T00:00:00Z"
}

// PATCH /api/Auth/profile
{
  "email": "new@clinic.com",
  "fullName": "New Name",
  "phone": "0501234567"
}

// PATCH /api/Auth/change-password
{
  "currentPassword": "admin123",
  "newPassword": "newpass123"
}
```

#### 8.2 Admin Settings (Primary Admin Only)

**Features**:
- System configuration
- User management
- Quota management
- Logging and audit trails

---

### 9. Analytics & Reporting

#### 9.1 Dashboard Metrics

**Metrics to Display**:
- Total Messages Sent (Today/Week/Month)
- Success Rate (%)
- Failed Messages Count
- Average Response Time
- Active Queues Count
- Total Patients Count

**Implementation**:
```javascript
// GET /api/Analytics/dashboard
// Returns:
{
  "success": true,
  "data": {
    "totalMessagesSent": 1250,
    "successRate": 96.5,
    "failedMessages": 45,
    "averageResponseTime": 2500, // milliseconds
    "activeQueues": 8,
    "totalPatients": 450,
    "todayMessages": 124,
    "weekMessages": 890
  }
}
```

#### 9.2 Detailed Reports

**Report Types**:
- Message sending reports
- Queue performance
- User activity logs
- Error logs
- System health

---

## 🔧 Backend API Endpoints Summary

### Authentication
```
POST   /api/Auth/login              - Login
POST   /api/Auth/refresh            - Refresh token
POST   /api/Auth/logout             - Logout
GET    /api/Auth/me                 - Get current user
PATCH  /api/Auth/profile            - Update profile
PATCH  /api/Auth/change-password    - Change password
```

### Queues
```
GET    /api/Queues                  - Get all queues
POST   /api/Queues                  - Create queue
GET    /api/Queues/{id}             - Get queue details
PATCH  /api/Queues/{id}             - Update queue
DELETE /api/Queues/{id}             - Delete queue
POST   /api/Queues/{id}/pause       - Pause queue
POST   /api/Queues/{id}/resume      - Resume queue
```

### Patients
```
GET    /api/Patients                - Get all patients
POST   /api/Patients                - Add patient
GET    /api/Patients/{id}           - Get patient details
PATCH  /api/Patients/{id}           - Update patient
DELETE /api/Patients/{id}           - Delete patient
POST   /api/Patients/bulk           - Bulk import
DELETE /api/Patients/bulk           - Bulk delete
```

### Messages
```
GET    /api/Messages                - Get all messages
POST   /api/Messages                - Create message
GET    /api/Messages/{id}           - Get message details
POST   /api/Messages/bulk           - Send bulk messages
POST   /api/Messages/send-whatsapp  - Send via WhatsApp
POST   /api/Messages/{id}/retry     - Retry failed message
DELETE /api/Messages/{id}           - Delete message
```

### WhatsApp
```
GET    /api/WhatsApp/auth/qr        - Get QR code
GET    /api/WhatsApp/status         - Get connection status
POST   /api/WhatsApp/logout         - Disconnect
```

### Analytics
```
GET    /api/Analytics/dashboard     - Dashboard metrics
GET    /api/Analytics/messages      - Message reports
GET    /api/Analytics/queues        - Queue performance
GET    /api/Analytics/users         - User activity
```

---

## 📱 Frontend Components to Build

### React Components Needed

```
├── Pages/
│   ├── LoginPage
│   ├── DashboardPage
│   ├── MessagesPage
│   ├── ManagementPage
│   ├── AnalyticsPage
│   └── SettingsPage
│
├── Components/
│   ├── Header
│   ├── Sidebar
│   ├── MessageStatus
│   │   ├── DashboardTab
│   │   ├── OngoingTab
│   │   └── FailedTab
│   │
│   ├── Management/
│   │   ├── QueueList
│   │   ├── QueueForm
│   │   ├── PatientList
│   │   └── PatientForm
│   │
│   ├── Modals/
│   │   ├── AddPatientModal
│   │   ├── UploadPatientsModal
│   │   ├── MessageSelectionModal
│   │   ├── MessagePreviewModal
│   │   ├── AddMessageTemplateModal
│   │   ├── WhatsAppAuthModal
│   │   └── SettingsModal
│   │
│   ├── Tables/
│   │   ├── QueueTable
│   │   ├── PatientTable
│   │   └── MessageLogTable
│   │
│   └── Charts/
│       ├── MessageSentChart
│       ├── SuccessRateChart
│       └── QueuePerformanceChart
```

---

## 🎯 Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
- ✅ Database schema
- ✅ Authentication system
- ✅ User roles and permissions
- ✅ Login UI

### Phase 2: Queue Management (Week 2-3)
- ✅ Queue CRUD operations
- ✅ Queue management UI
- ✅ Patient management

### Phase 3: Messaging System (Week 3-4)
- ✅ Message templates
- ✅ Bulk messaging
- ✅ Message tracking

### Phase 4: WhatsApp Integration (Week 4-5)
- ✅ WhatsApp authentication
- ✅ Message sending via WhatsApp
- ✅ Status tracking

### Phase 5: Analytics & Reporting (Week 5-6)
- ✅ Dashboard metrics
- ✅ Reports
- ✅ Performance monitoring

---

## 📋 Testing Scenarios

### Test Case 1: Primary Admin Full Access
**User**: admin / admin123
**Steps**:
1. Login
2. Create new queue
3. Add patients
4. Send messages
5. Configure WhatsApp
6. View analytics
7. Manage users

### Test Case 2: Moderator Limited Access
**User**: mod1 / mod123
**Steps**:
1. Login
2. View assigned queues only
3. Add patients to queue
4. Send messages
5. Cannot configure WhatsApp

### Test Case 3: User Read-Only Access
**User**: user1 / user123
**Steps**:
1. Login
2. View own queue status
3. Cannot make changes
4. View messages sent

---

## 🐛 Known Issues & Recommendations

### Security Considerations
- ✅ Use HTTPS in production
- ✅ Implement CSRF protection
- ✅ Rate limiting on login
- ✅ Password hashing
- ✅ JWT token expiration
- ✅ Secure WhatsApp credentials storage

### Performance Optimization
- ✅ Paginate large datasets
- ✅ Cache queue data
- ✅ Lazy load analytics
- ✅ Compress API responses
- ✅ CDN for static assets

### User Experience
- ✅ Loading indicators
- ✅ Error messages
- ✅ Confirmation dialogs
- ✅ Toast notifications
- ✅ Dark mode option
- ✅ Mobile responsiveness

---

## 📞 Support & References

### Files to Review
- Prototype: `External Documents (related)/Prototype.html`
- Architecture: `ARCHITECTURE.md`
- Database Schema: Check migrations in `src/Infrastructure/Migrations/`

### Additional Resources
- WhatsApp Web documentation
- JWT implementation guide
- Tailwind CSS documentation
- React Query documentation

---

## ✅ Checklist for Implementation

- [ ] Database design complete
- [ ] API endpoints designed
- [ ] Authentication system working
- [ ] Queue management implemented
- [ ] Patient management implemented
- [ ] Message templates system implemented
- [ ] WhatsApp integration working
- [ ] Analytics dashboard built
- [ ] User roles enforced
- [ ] Error handling comprehensive
- [ ] Logging implemented
- [ ] Tests written
- [ ] Documentation complete
- [ ] Security audit done
- [ ] Performance tested

---

**Last Updated**: October 22, 2025  
**Prototype Version**: 1.0  
**Status**: Ready for Implementation
