# 🎬 Prototype Tour - Step by Step Guide

## Overview
This document provides a complete walkthrough of the Clinics Management System prototype with all test user scenarios.

**Access**: http://localhost:8888/Prototype.html

---

## 🔑 Test Credentials

### 1. Primary Admin Account
- **Username**: admin
- **Password**: admin123
- **Access Level**: Full system access
- **Arabic Name**: مدير أساسي

### 2. Secondary Admin Account
- **Username**: admin2
- **Password**: admin123
- **Access Level**: Limited admin (assigned queues only)
- **Arabic Name**: مدير ثانوي

### 3. Moderator Account
- **Username**: mod1
- **Password**: mod123
- **Access Level**: Moderator (own queues)
- **Arabic Name**: مشرف

### 4. User Account
- **Username**: user1
- **Password**: user123
- **Access Level**: Read-only
- **Arabic Name**: مستخدم

---

## 📖 Complete Tour

### PART 1: Login as Primary Admin

#### Step 1.1 - Login Screen
```
URL: http://localhost:8888/Prototype.html

Elements Visible:
✓ Clinic logo with medical icon
✓ "نظام إدارة العيادات" (Clinic Management System) title
✓ "تسجيل الدخول إلى النظام" (Login to System) subtitle
✓ Username input field
✓ Password input field
✓ Login button
✓ Test credentials display panel
```

**Action**: Enter credentials and click Login
```javascript
Username: admin
Password: admin123
```

#### Step 1.2 - Dashboard - Welcome Screen
```
URL shows: Dashboard → Welcome Tab

Header Elements:
├─ Logo and app title
├─ Current user role: "مدير أساسي" (Primary Admin)
├─ WhatsApp status indicator (initially disconnected)
└─ Logout button

Sidebar Navigation:
├─ Messages (الرسائل)
├─ Management (الإدارة)
└─ Analytics (التحليلات)

Main Content Area:
└─ Welcome screen with options
```

---

### PART 2: Explore Messages Section

#### Step 2.1 - Click "Messages" in Sidebar
```
New Interface Shows: Message Dashboard with 3 Tabs

Tabs Visible:
1. Dashboard (لوحة التحكم) ← Currently Active
2. Ongoing (جارية)
3. Failed (فشلت)

Dashboard Tab Content:
├─ Summary cards:
│  ├─ Total messages sent: 1,234
│  ├─ Successful: 96.5%
│  ├─ Failed: 45
│  └─ Average response time: 2.5s
│
├─ Quick Action Buttons:
│  ├─ [+ إضافة مريض] Add Patient
│  ├─ [↑ رفع المرضى] Upload Patients
│  ├─ [🗑 حذف المحددة] Delete Selected
│  └─ [✉ إرسال للمحددين] Send to Selected
│
├─ Patient List Table:
│  ├─ Checkbox column
│  ├─ Patient name
│  ├─ Phone number
│  ├─ Queue name
│  ├─ Status
│  └─ Actions
│
└─ Message Template Section
   ├─ List of saved templates
   └─ + Add new template button
```

#### Step 2.2 - Try "Add Patient" Button
```
Modal Opens: Add Patient Modal

Form Elements:
├─ Patient Name input
│  └─ Example: "محمد علي"
│
├─ Phone Number input
│  └─ Example: "0501234567"
│
├─ Queue Selection dropdown
│  └─ Options: List of all available queues
│
└─ Action Buttons
   ├─ [✓ إضافة] Add button
   └─ [✕ إلغاء] Cancel button

Function: Add a single patient to selected queue
```

**Action**: Fill form and click "Add"

#### Step 2.3 - Try "Upload Patients" Button
```
Modal Opens: Upload Patients Modal

Content:
├─ Queue Selection dropdown
├─ Excel File Upload Zone
│  ├─ Drag & drop area
│  └─ "اختر ملف" Choose file button
│
├─ File Requirements:
│  ├─ Excel format (.xlsx)
│  ├─ Columns: Name, Phone, Notes
│  └─ Example preview table
│
└─ Action Buttons
   ├─ [✓ رفع] Upload button
   └─ [✕ إلغاء] Cancel button

Feature: Bulk import patients from Excel file
```

#### Step 2.4 - Select Patients and Send Messages

```
Action: Check checkboxes next to patient names

Button State: "Send to Selected" button becomes active

Click "Send to Selected":

Modal Opens: Message Template Selection

Content:
├─ Template List
│  ├─ Template 1: "تذكير الموعد" (Appointment Reminder)
│  │  └─ Preview: "السلام عليكم {PN}، موضعك {PQP} من {CQP}"
│  │
│  ├─ Template 2: "تحديث الحالة" (Status Update)
│  │  └─ Preview: "تم تحديث موضعك إلى {PQP}"
│  │
│  └─ [+ إضافة قالب جديد] Add new template
│
├─ Condition Builder
│  ├─ Select recipients by:
│  │  ├─ Queue
│  │  ├─ Status
│  │  ├─ Custom filters
│  │  └─ Manual selection
│  │
│  └─ Show/hide advanced options
│
└─ Action Buttons
   ├─ [→ التالي] Next/Preview
   └─ [✕ إلغاء] Cancel
```

#### Step 2.5 - Message Preview

```
After selecting template and recipients:

Preview Modal Shows:
├─ Selected template
├─ Recipient count
├─ Message preview with replacements:
│  └─ "السلام عليكم محمد علي، موضعك 5 من 12"
│
├─ Toggle to show all messages
│  └─ Expandable list of all previews
│
├─ Quota information
│  └─ "Messages remaining: 250/500"
│
└─ Action Buttons
   ├─ [✓ إرسال] Send
   ├─ [← السابق] Back
   └─ [✕ إلغاء] Cancel

Function: Confirm and send messages
```

#### Step 2.6 - Ongoing Tab

```
Click "Ongoing" Tab:

Content Shows:
├─ Active Message Tasks
│  ├─ Task ID
│  ├─ Type: "Send Message"
│  ├─ Status: "RUNNING"
│  ├─ Progress bar: 45%
│  ├─ Items: 45/100 completed
│  ├─ Start time
│  └─ Estimated completion
│
├─ Control Buttons
│  ├─ [⏸ إيقاف الكل] Pause all
│  ├─ [▶ استئناف الكل] Resume all
│  └─ Per-task actions
│
└─ Performance Metrics
   ├─ Messages/second rate
   ├─ Estimated time remaining
   └─ Success rate in progress
```

#### Step 2.7 - Failed Tab

```
Click "Failed" Tab:

Content Shows:
├─ Failed Message Logs
│  ├─ Failed message count
│  ├─ Failure reasons breakdown
│  │  ├─ Invalid phone: 15
│  │  ├─ Network error: 8
│  │  ├─ Blocked number: 5
│  │  └─ Other: 17
│  │
│  └─ Failed Messages Table
│     ├─ Checkbox column
│     ├─ Patient name
│     ├─ Phone number
│     ├─ Failure reason
│     ├─ Retry count
│     ├─ Timestamp
│     └─ Actions (Delete, Retry)
│
├─ Bulk Actions
│  ├─ [🔄 إعادة المحاولة] Retry selected
│  ├─ [🗑 حذف] Delete selected
│  └─ [📋 معاينة] Preview before retry
│
└─ Retry Strategy Options
   ├─ Immediate retry
   ├─ Retry after delay
   └─ Schedule for later
```

---

### PART 3: Management Section

#### Step 3.1 - Click "Management" in Sidebar
```
New Interface Shows: Management Dashboard

Tabs:
1. Queues (الطوابير)
2. Users (المستخدمون)
3. Settings (الإعدادات)

Queues Tab Content (Currently Active):
├─ Add Queue Button
│  └─ [+ إضافة طابور جديد] Add new queue
│
├─ Queues List/Grid
│  ├─ Queue Card 1: Dental Clinic
│  │  ├─ Queue name: "عيادة الأسنان"
│  │  ├─ Clinic: "عيادة الأسنان المتخصصة"
│  │  ├─ Moderator: "محمد علي"
│  │  ├─ Capacity: 20/30
│  │  ├─ Status: ACTIVE
│  │  ├─ Current position: 5
│  │  ├─ Estimated time/session: 15 min
│  │  └─ Actions:
│  │     ├─ [✎ تعديل] Edit
│  │     ├─ [⏸ إيقاف] Pause
│  │     └─ [🗑 حذف] Delete
│  │
│  └─ Queue Card 2: Cardiology Clinic
│     ├─ (Similar structure)
│     └─ Actions
│
└─ Statistics
   ├─ Total queues: 8
   ├─ Active queues: 7
   ├─ Paused queues: 1
   └─ Total patients: 450
```

#### Step 3.2 - Create New Queue

```
Click [+ إضافة طابور جديد] Add Queue:

Add Queue Modal Opens:

Form Fields:
├─ Queue Name (اسم الطابور)
│  └─ Example: "عيادة الجراحة"
│
├─ Clinic Name (اسم العيادة)
│  └─ Dropdown or input
│
├─ Moderator Assignment (تعيين المشرف)
│  └─ Dropdown of available moderators
│
├─ Capacity (السعة)
│  └─ Number input: 25
│
├─ Estimated Time per Session (الوقت المقدر للجلسة)
│  └─ Number input: 15 minutes
│
├─ Description (الوصف)
│  └─ Text area: Optional notes
│
└─ Action Buttons
   ├─ [✓ إنشاء] Create
   └─ [✕ إلغاء] Cancel
```

**Action**: Fill and create queue

#### Step 3.3 - Edit Queue

```
Click [✎ تعديل] Edit on a queue card:

Edit Queue Modal Opens:

Content:
├─ All fields pre-filled with current values
├─ Can modify:
│  ├─ Queue name
│  ├─ Moderator assignment
│  ├─ Capacity
│  ├─ Estimated time
│  └─ Status (Active/Paused)
│
└─ Action Buttons
   ├─ [✓ حفظ] Save
   └─ [✕ إلغاء] Cancel
```

#### Step 3.4 - Queue Patient Management

```
Inside a Queue (Double-click or select):

Queue Details View:
├─ Queue Information
│  ├─ Name, clinic, moderator
│  ├─ Status indicator
│  └─ Current statistics
│
├─ Patients in Queue Tab
│  ├─ Patient list table
│  ├─ Add patient button
│  ├─ Bulk upload button
│  └─ Bulk actions
│
├─ Queue Activity Log
│  ├─ Timestamp
│  ├─ Action
│  ├─ User
│  └─ Details
│
└─ Statistics
   ├─ Current position: 5
   ├─ Avg wait time: 45 min
   ├─ Total patients: 450
   └─ Completion rate: 95%
```

---

### PART 4: WhatsApp Integration

#### Step 4.1 - Navigate to Settings

```
In Management → Settings Tab:

Content Shows:
├─ WhatsApp Integration Section
│  ├─ Connection Status: "Disconnected" (red indicator)
│  └─ [✕ توصيل واتساب] Authenticate WhatsApp button
│
├─ Account Settings
│  ├─ User information
│  ├─ Change password
│  └─ Two-factor authentication
│
└─ System Settings
   ├─ Email configuration
   ├─ API keys
   └─ Webhook URLs
```

#### Step 4.2 - Authenticate WhatsApp

```
Click [✕ توصيل واتساب] Authenticate WhatsApp:

WhatsApp Authentication Modal Opens:

Content:
├─ Instructions (in Arabic)
│  ├─ "افتح واتساب على هاتفك"
│  ├─ "وجه كاميرا الهاتف نحو رمز الاستجابة السريعة أدناه"
│  ├─ "سيتم توصيل حسابك تلقائياً"
│
├─ QR Code Display
│  ├─ Large QR code
│  └─ Loading indicator
│
├─ Status Message
│  └─ "Waiting for scan... (جاري انتظار المسح)"
│
└─ Action Buttons
   ├─ [🔄 تحديث] Refresh QR Code
   └─ [✕ إلغاء] Cancel
```

#### Step 4.3 - After WhatsApp Connection

```
Once Connected:

WhatsApp Status Changes to:
├─ Green indicator: "Connected" (متصل)
├─ Account name display
└─ [✕ قطع الاتصال] Disconnect button

Header also shows:
├─ Green dot indicator
└─ "واتساب متصل" (WhatsApp Connected)

Benefits:
✓ Can now send messages via WhatsApp
✓ Automatic message delivery tracking
✓ Read receipts
✓ Delivery confirmations
```

---

### PART 5: Message Templates

#### Step 5.1 - Create Message Template

```
From Messages → Dashboard Tab:

Scroll to Message Template Section:
├─ [+ إضافة قالب جديد] Add new template button

Click button → Modal Opens:

Add Message Template Modal:

Content:
├─ Template Name (اسم القالب)
│  └─ Example: "تذكير موعد تالي"
│
├─ Template Content (محتوى القالب)
│  └─ Rich text editor
│  └─ Available variables buttons
│
├─ Variable Reference Guide
│  ├─ {CQP} - Current Queue Position
│  ├─ {PQP} - Patient Queue Position
│  ├─ {ETS} - Estimated Time per Session
│  ├─ {ETR} - Estimated Time Remaining
│  ├─ {PN} - Patient Name
│  │
│  └─ Click to insert variables
│
├─ Template Preview
│  └─ Shows how message will look with replacements
│
└─ Action Buttons
   ├─ [✓ حفظ] Save template
   └─ [✕ إلغاء] Cancel
```

**Example Template Text**:
```
السلام عليكم {PN}،

دورك يقترب من العيادة.

موضعك الحالي: {PQP} من {CQP}
الوقت المتبقي المقدر: {ETR} دقيقة

نتطلع لرؤيتك قريباً 👋
```

#### Step 5.2 - Variables Explained

```
Variable Reference:

{CQP} - Current Queue Position
└─ Total people currently in this queue
└─ Example: If 12 people in queue, shows "12"

{PQP} - Patient Queue Position
└─ This patient's position in line
└─ Example: "5"
└─ Full message: "Your position is 5 out of 12"

{ETS} - Estimated Time per Session
└─ How long each person's session takes
└─ Set in queue configuration
└─ Example: "15 minutes"

{ETR} - Estimated Time Remaining
└─ Calculated based on position and ETS
└─ Formula: (Position - 1) × ETS
└─ Example: (5 - 1) × 15 = 60 minutes

{PN} - Patient Name
└─ Personal greeting
└─ Example: "محمد علي"
└─ Full message: "السلام عليكم محمد علي"
```

---

### PART 6: Switch User and Test Different Roles

#### Step 6.1 - Logout

```
Click Logout Button (red logout icon in header):

Confirmation:
├─ "Are you sure?" dialog appears
└─ Click [✓ تأكيد] Confirm

Result:
└─ Redirected to login screen
```

#### Step 6.2 - Login as Secondary Admin

```
Username: admin2
Password: admin123

Changes from Primary Admin:
├─ Navigation items same (has management access)
├─ But only sees assigned queues
├─ Cannot access system settings
├─ Cannot manage all users
└─ Role display: "مدير ثانوي" (Secondary Admin)
```

#### Step 6.3 - Login as Moderator

```
Username: mod1
Password: mod123

Visible Features:
├─ Messages ✓ Can send messages
├─ Management ✓ Can manage own queue
├─ Analytics ✓ Can see own analytics
│
└─ Hidden Features:
   ├─ System settings ✗
   ├─ User management ✗
   ├─ Multiple queue management ✗
   └─ Quota management ✗

Role display: "مشرف" (Moderator)
```

#### Step 6.4 - Login as Regular User

```
Username: user1
Password: user123

Visible Features:
├─ Dashboard view only ✓
├─ View own queue status ✓
├─ View received messages ✓
│
└─ Hidden/Disabled Features:
   ├─ Add patients ✗
   ├─ Send messages ✗
   ├─ Create queues ✗
   ├─ Manage anything ✗
   └─ Admin features ✗

Role display: "مستخدم" (User)

Behavior:
├─ All buttons grayed out
├─ Edit features disabled
├─ View-only mode
└─ Read-only tables
```

---

## 🎯 Feature Testing Checklist

### Messages Feature
- [ ] Add single patient
- [ ] Bulk upload patients
- [ ] Select patients
- [ ] Send to selected
- [ ] View ongoing messages
- [ ] View failed messages
- [ ] Retry failed messages

### Queue Management
- [ ] Create new queue
- [ ] Edit queue details
- [ ] Pause queue
- [ ] Resume queue
- [ ] Delete queue
- [ ] View queue statistics

### WhatsApp Integration
- [ ] Authenticate WhatsApp
- [ ] View connection status
- [ ] Send message via WhatsApp
- [ ] Verify delivery
- [ ] Disconnect WhatsApp

### Message Templates
- [ ] Create template
- [ ] Use variables
- [ ] Edit template
- [ ] Delete template
- [ ] Preview template

### User Management
- [ ] Add user
- [ ] Edit user
- [ ] Delete user
- [ ] Assign role
- [ ] Assign queue

### Analytics
- [ ] View dashboard metrics
- [ ] View message reports
- [ ] View queue performance
- [ ] Export reports

### Security
- [ ] Change password
- [ ] Logout functionality
- [ ] Role-based access control
- [ ] Session management

---

## 🎬 Recording Key Features

### Screen Recording Tips

**For Tutorial Video**:
1. Start at login screen
2. Test each role (2-3 minutes each)
3. Show messaging flow (3-5 minutes)
4. Show management section (3-5 minutes)
5. Show WhatsApp integration (2-3 minutes)
6. Show analytics (2-3 minutes)

**Total Duration**: ~15-20 minutes

**Key Timestamps**:
- 00:00 - Login
- 01:00 - Messages dashboard
- 03:00 - Send message flow
- 05:00 - Management section
- 08:00 - Create queue
- 10:00 - WhatsApp auth
- 12:00 - Analytics
- 14:00 - Role switching
- 18:00 - Logout

---

## 💡 Implementation Notes for Backend

### When Implementing, Remember:

1. **Role-Based Visibility**
   ```javascript
   // Show/hide UI based on role
   const permissions = {
     'primary_admin': ['create', 'read', 'update', 'delete', 'settings'],
     'secondary_admin': ['create', 'read', 'update', 'delete'],
     'moderator': ['create', 'read', 'update'],
     'user': ['read']
   }
   ```

2. **Message Variables**
   ```javascript
   // Replace variables before sending
   message = "{PN} - Your position is {PQP} of {CQP}"
   message = "محمد - Your position is 5 of 12"
   ```

3. **Queue State Management**
   ```javascript
   // Track queue changes
   queue.status = "ACTIVE" | "PAUSED" | "CLOSED"
   queue.currentPosition = calculatePosition()
   queue.estimatedWaitTime = calculateWait()
   ```

4. **Message Lifecycle**
   ```javascript
   // Message states
   message.status = "PENDING" → "SENDING" → "SENT" → "DELIVERED" | "FAILED"
   ```

5. **WhatsApp Integration**
   ```javascript
   // WhatsApp message format
   {
     to: "+966501234567",
     body: "Message text",
     mediaUrl?: "https://...",
     template?: "template_name"
   }
   ```

---

## 🎉 Conclusion

The prototype demonstrates a complete, functional Clinics Management System with:
- ✅ Role-based access control
- ✅ Queue management
- ✅ Patient management
- ✅ WhatsApp messaging
- ✅ Message templates with variables
- ✅ Analytics and reporting
- ✅ Comprehensive UI/UX

Use this guide to implement all these features in your actual system!

---

**Prototype Location**: http://localhost:8888/Prototype.html  
**Status**: Fully functional for testing and reference  
**Last Updated**: October 22, 2025
