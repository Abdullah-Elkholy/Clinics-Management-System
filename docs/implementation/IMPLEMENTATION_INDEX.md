# 📋 Implementation Index - All Screens & Features

Complete mapping of all screens, modals, and features from the prototype to implementation.

---

## 🎯 Complete Screen List (16 Screens)

### 1. **Login Screen** - `loginScreen`
**Path**: Authentication Entry Point  
**Components**:
- Username input field
- Password input field
- Login button
- Credential display/hints

**Features**:
- User authentication
- Login validation
- Error handling
- Test credentials display

**API Calls**:
- POST `/api/auth/login`

**Files to Create**:
- `screens/login.md`
- `components/auth/LoginForm.tsx`
- `api/auth.md`

---

### 2. **Main Application** - `mainApp`
**Path**: Application Container  
**Contains**: Header, Navigation, Main Content Area

**Components**:
- Header with branding
- Left navigation panel
- Content area (dynamic)
- Queues sidebar
- User menu

**Role-Based Visibility**:
- Primary Admin: All features
- Secondary Admin: Messages, Management (limited)
- Moderator: Messages, assigned queues
- User: Dashboard only

**Files to Create**:
- `layouts/main-layout.md`
- `components/layouts/MainLayout.tsx`
- `components/layouts/Header.tsx`
- `components/layouts/Navigation.tsx`

---

### 3. **Welcome Screen** - `welcomeScreen`
**Path**: Dashboard/Home  
**Status**: Shown when no content selected

**Components**:
- Welcome message
- System description
- Quick start guide

**Files to Create**:
- `screens/dashboard.md`
- `components/screens/WelcomeScreen.tsx`

---

### 4. **Messages Screen** - `messagesScreen`
**Path**: Messages Tab  
**Main Feature Screen**

**Sub-Features**:
- Patient management (add, upload, delete)
- Patient list
- Message sending
- Message tracking (ongoing, failed)
- Templates management

**Tabs** (3 tabs):
- **Dashboard** - Overview
- **Ongoing Messages** - In-progress tracking
- **Failed Messages** - Retry management

**Components**:
- Patient data grid
- Filter/Search controls
- Action buttons (Add, Upload, Delete, Send)
- Tab switcher

**API Calls**:
- GET `/api/patients` (with queue filter)
- POST `/api/patients`
- DELETE `/api/patients/{id}`
- POST `/api/messages/send`
- GET `/api/messages/status`

**Files to Create**:
- `screens/messages.md`
- `components/messages/PatientList.tsx`
- `components/messages/MessageTracker.tsx`
- `components/messages/OngoingMessages.tsx`
- `components/messages/FailedMessages.tsx`
- `api/messages.md`
- `api/patients.md`

---

### 5. **Management Screen** - `managementScreen`
**Path**: Management Tab  
**Administrative Features**

**Sub-Features**:
- Queue management
- User management
- WhatsApp management
- Templates management
- Account settings
- Quota management
- Analytics

**Sections**:
- Queue list by moderator
- Queue details view
- Active queue session tracking

**API Calls**:
- GET `/api/queues`
- POST `/api/queues`
- PUT `/api/queues/{id}`
- DELETE `/api/queues/{id}`
- GET `/api/users`
- POST `/api/users`
- PUT `/api/users/{id}`

**Files to Create**:
- `screens/management.md`
- `components/management/QueueManager.tsx`
- `components/management/UserManager.tsx`
- `components/management/WhatsAppManager.tsx`
- `api/queues.md`
- `api/users.md`

---

## 🪟 Modal Windows (12 Modals)

### Modal 1: Add Queue - `addQueueModal`
**Trigger**: "إضافة طابور" button  
**Fields**:
- Queue name (text)
- Session duration (number)
- Session count (number)
- Assigned moderator (select)
- Auto-start (toggle)

**Actions**:
- Save (POST `/api/queues`)
- Cancel

---

### Modal 2: Add Patient - `addPatientModal`
**Trigger**: "إضافة مريض" button  
**Fields** (Dynamic):
- Patient name
- Phone number
- (Repeat fields with Add button)

**Actions**:
- Add patient slot (dynamic)
- Remove patient slot
- Save all
- Cancel

**API**: POST `/api/patients`

---

### Modal 3: Upload Excel - `uploadModal`
**Trigger**: "رفع ملف إكسل" button  
**Features**:
- File input (Excel)
- File preview
- Mapping configuration
- Progress tracking

**Actions**:
- Select file
- Process
- Cancel

**API**: POST `/api/patients/bulk`

---

### Modal 4: Message Selection - `messageSelectionModal`
**Trigger**: "تحديد الرسالة" button  
**Features**:
- Message template selection
- Condition builder (if needed)
- Filter by queue/moderator
- Add conditions (multiple rows)

**Components**:
- Template dropdown
- Condition row builder
- Add condition button

**Actions**:
- Apply
- Cancel

---

### Modal 5: Message Preview - `messagePreviewModal`
**Trigger**: Auto-shown after template selection  
**Features**:
- Message preview (formatted)
- Recipient count
- Variable replacement preview
- Expandable message list

**Actions**:
- Send confirmed
- Cancel

---

### Modal 6: Add Message Template - `addMessageTemplateModal`
**Trigger**: "إضافة قالب" button  
**Fields**:
- Template name
- Template text (textarea)
- Variable insert buttons ({PN}, {PQP}, {CQP}, {ETS}, {ETR})

**Actions**:
- Save (POST `/api/templates`)
- Cancel

---

### Modal 7: Account Info - `accountInfoModal`
**Trigger**: User menu  
**Sections**:
- Current username
- Full name
- Email
- Password change toggle

**Sub-Section: Password Change**:
- Current password
- New password
- Confirm password

**Actions**:
- Toggle password change
- Save
- Cancel

**API**: PUT `/api/account/profile`, PUT `/api/account/password`

---

### Modal 8: WhatsApp Auth - `whatsappAuthModal`
**Trigger**: WhatsApp setup button  
**Features**:
- QR code display area
- Connection status
- Manual phone number input (fallback)

**Actions**:
- Authenticate (trigger WhatsApp Web flow)
- Close

**API**: POST `/api/whatsapp/auth`

---

### Modal 9: Edit Queue - `editQueueModal`
**Trigger**: Edit button on queue  
**Fields**:
- Queue name
- Session duration
- Session count
- Status (active/paused)
- Moderator assignment

**Actions**:
- Save (PUT `/api/queues/{id}`)
- Cancel

---

### Modal 10: Edit User - `editUserModal`
**Trigger**: Edit button on user  
**Fields**:
- Username
- Full name
- Email
- Role (dropdown)
- Status (active/inactive)
- Password reset button

**Actions**:
- Save (PUT `/api/users/{id}`)
- Reset password
- Cancel

---

### Modal 11: Retry Preview - `retryPreviewModal`
**Trigger**: "معاينة الإعادة" button  
**Features**:
- Failed messages list
- Retry configuration
- Message preview

**Actions**:
- Confirm retry
- Cancel

---

### Modal 12: Quota Management - `quotaManagementModal`
**Trigger**: Admin menu  
**Sections**:
1. Messages Quota
   - Current usage
   - Quota limit
   - Add quota input
2. Queues Quota
   - Current count
   - Max allowed
   - Add quota input

**Actions**:
- Add quota for messages
- Add quota for queues
- Close

**API**: POST `/api/admin/quota`

---

### Modal 13: Edit Patient - `editPatientModal`
**Trigger**: Edit button on patient  
**Fields**:
- Patient name
- Phone number

**Actions**:
- Save (PUT `/api/patients/{id}`)
- Cancel

---

## 🔄 Navigation Flows

### Main Navigation
```
Login Screen
    ↓
[Authentication]
    ↓
Main Application
├── Header
├── Navigation (Left Panel)
│   ├── Messages Button → showMessages()
│   └── Management Button → showManagement()
└── Content Area
    ├── Welcome Screen (default)
    ├── Messages Screen (tab-based)
    │   ├── Dashboard Tab
    │   ├── Ongoing Tab
    │   └── Failed Tab
    └── Management Screen
        ├── Queues Section
        ├── Users Section
        ├── WhatsApp Section
        └── Templates Section
```

---

## 📊 Tab-Based Navigation

### Messages Screen Tabs
```
showTab('dashboard')
├── Patient list
├── Message templates by moderator
└── Add patient / Upload buttons

showTab('ongoing')
├── Queue sessions (ongoing)
├── Patient status tracking
└── Message delivery status

showTab('failed')
├── Failed messages list
├── Retry options
└── Delete/Edit actions
```

---

## 🎨 Component Reusability

### Shared Components (Build First)
```
components/
├── shared/
│   ├── Button.tsx (colored variants)
│   ├── Modal.tsx (base modal)
│   ├── DataGrid.tsx (table component)
│   ├── Tabs.tsx (tab navigation)
│   ├── FormInput.tsx (text input)
│   ├── FormSelect.tsx (dropdown)
│   ├── FormCheckbox.tsx (toggle)
│   └── Toast.tsx (notifications)
├── layouts/
│   ├── MainLayout.tsx
│   ├── Header.tsx
│   ├── Navigation.tsx
│   └── SidePanel.tsx
├── modals/
│   ├── Modal.tsx (base)
│   ├── AddQueueModal.tsx
│   ├── AddPatientModal.tsx
│   ├── UploadModal.tsx
│   ├── MessageSelectionModal.tsx
│   ├── MessagePreviewModal.tsx
│   ├── AddTemplateModal.tsx
│   ├── AccountInfoModal.tsx
│   ├── WhatsAppAuthModal.tsx
│   ├── EditQueueModal.tsx
│   ├── EditUserModal.tsx
│   ├── RetryPreviewModal.tsx
│   ├── QuotaManagementModal.tsx
│   └── EditPatientModal.tsx
├── messages/
│   ├── PatientList.tsx
│   ├── MessageTracker.tsx
│   ├── OngoingMessages.tsx
│   ├── FailedMessages.tsx
│   └── TemplatesList.tsx
├── management/
│   ├── QueueManager.tsx
│   ├── UserManager.tsx
│   ├── WhatsAppManager.tsx
│   └── TemplateManager.tsx
└── auth/
    └── LoginForm.tsx
```

---

## 🔌 API Endpoints Required

### Authentication (3 endpoints)
1. POST `/api/auth/login` - User login
2. POST `/api/auth/logout` - User logout
3. POST `/api/auth/refresh` - Refresh token

### Patients (5 endpoints)
1. GET `/api/patients` - List patients (with filters)
2. POST `/api/patients` - Add patient
3. PUT `/api/patients/{id}` - Edit patient
4. DELETE `/api/patients/{id}` - Delete patient
5. POST `/api/patients/bulk` - Bulk import

### Messages (6 endpoints)
1. POST `/api/messages/send` - Send messages
2. GET `/api/messages/status` - Get message status
3. POST `/api/messages/retry` - Retry failed messages
4. GET `/api/templates` - List templates
5. POST `/api/templates` - Create template
6. DELETE `/api/templates/{id}` - Delete template

### Queues (6 endpoints)
1. GET `/api/queues` - List queues
2. POST `/api/queues` - Create queue
3. PUT `/api/queues/{id}` - Update queue
4. DELETE `/api/queues/{id}` - Delete queue
5. GET `/api/queues/{id}/sessions` - Queue sessions
6. GET `/api/queues/{id}/patients` - Queue patients

### Users (5 endpoints)
1. GET `/api/users` - List users
2. POST `/api/users` - Create user
3. PUT `/api/users/{id}` - Update user
4. DELETE `/api/users/{id}` - Delete user
5. PUT `/api/users/{id}/password` - Reset password

### WhatsApp (4 endpoints)
1. POST `/api/whatsapp/auth` - Authenticate WhatsApp
2. GET `/api/whatsapp/status` - Check WhatsApp status
3. POST `/api/whatsapp/send` - Send via WhatsApp
4. GET `/api/whatsapp/messages` - Get WhatsApp messages

### Account (3 endpoints)
1. GET `/api/account/profile` - Get profile
2. PUT `/api/account/profile` - Update profile
3. PUT `/api/account/password` - Change password

### Admin (3 endpoints)
1. GET `/api/admin/quota` - Get quota info
2. POST `/api/admin/quota` - Update quota
3. GET `/api/admin/analytics` - Get analytics data

**Total**: 35 API endpoints

---

## 👥 Role-Based Access Control (RBAC)

### Primary Admin (ID: 1)
- ✅ All screens accessible
- ✅ All modals available
- ✅ User management
- ✅ Quota management
- ✅ All queues visible

### Secondary Admin (ID: 2)
- ✅ Messages screen
- ✅ Management screen (limited)
- ✅ Can't manage users
- ✅ Can't change quota
- ✅ Can see all queues

### Moderator (ID: 3)
- ✅ Messages screen
- ✅ Assigned queues only
- ❌ Can't create queues
- ❌ Can't manage users
- ❌ Limited template access

### User (ID: 4)
- ✅ Dashboard only
- ❌ No message sending
- ❌ No queue management
- ❌ View-only access

---

## 📋 Implementation Priority

### Phase 1 (Must Have) - Week 1-2
1. ✅ Login screen
2. ✅ Main layout
3. ✅ Database auth
4. ✅ Patient CRUD
5. ✅ Message sending

### Phase 2 (Should Have) - Week 2-3
6. Queue management
7. Template management
8. Message templates
9. Message tracking

### Phase 3 (Nice to Have) - Week 3-4
10. WhatsApp integration
11. Bulk upload
12. User management

### Phase 4 (Polish) - Week 4+
13. Analytics
14. Settings
15. Admin features

---

## 🔍 Quick Reference

| Feature | Screen | Modal | API | Priority |
|---------|--------|-------|-----|----------|
| Login | loginScreen | - | `/auth/login` | 🔴 P0 |
| Add Patient | messagesScreen | addPatientModal | `/patients` | 🔴 P0 |
| Send Message | messagesScreen | messagePreviewModal | `/messages/send` | 🔴 P0 |
| Manage Queues | managementScreen | editQueueModal | `/queues` | 🔴 P0 |
| Message Templates | managementScreen | addTemplateModal | `/templates` | 🟡 P1 |
| WhatsApp | - | whatsappAuthModal | `/whatsapp` | 🟡 P1 |
| User Management | managementScreen | editUserModal | `/users` | 🟢 P2 |
| Analytics | - | - | `/analytics` | 🟢 P2 |

---

**Total Implementation Size**: ~50 components + 35 API endpoints + 12 modals  
**Estimated Time**: 4-5 weeks full-time development  
**Start Point**: `implementation/screens/login.md`

---

Generated: October 22, 2025  
Version: 1.0  
Status: Ready for Development ✅
