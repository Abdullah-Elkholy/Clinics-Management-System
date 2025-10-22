# 📌 Quick Reference Card - Prototype Features

## 🔐 Login Credentials

```
┌─────────────────────┬──────────────┬────────────┐
│ Role                │ Username     │ Password   │
├─────────────────────┼──────────────┼────────────┤
│ Primary Admin       │ admin        │ admin123   │
│ Secondary Admin     │ admin2       │ admin123   │
│ Moderator           │ mod1         │ mod123     │
│ User                │ user1        │ user123    │
└─────────────────────┴──────────────┴────────────┘
```

## 📱 Prototyp Access

**URL**: http://localhost:8888/Prototype.html

## 🎯 Main Features

### Messages (الرسائل)
- ➕ Add Patient - Add single patient
- ⬆️ Upload - Bulk import Excel
- ✉️ Send - Send to selected patients
- ⏸️ Pause - Pause message sending
- 🔄 Retry - Retry failed messages

### Management (الإدارة)
- 🏥 Queues - Create/edit/delete queues
- 👥 Patients - Manage patient lists
- 👨‍💼 Users - User management
- ⚙️ Settings - System configuration

### Analytics (التحليلات)
- 📊 Dashboard - Overview metrics
- 📈 Reports - Detailed analysis
- 📉 Performance - Queue performance
- 📋 Logs - Activity logs

### WhatsApp (واتساب)
- 📞 Connect - Scan QR code
- 💬 Send - Send via WhatsApp
- ✓ Delivery - Track messages
- 📱 Status - Connection status

## 🎭 Message Template Variables

| Variable | Value | Example |
|----------|-------|---------|
| `{PN}` | Patient Name | محمد علي |
| `{PQP}` | Patient Position | 5 |
| `{CQP}` | Queue Position | 12 |
| `{ETS}` | Time/Session | 15 min |
| `{ETR}` | Time Remaining | 60 min |

## 👤 Role Permissions

### Primary Admin ✓
```
✓ All messages features
✓ All management features
✓ WhatsApp integration
✓ System settings
✓ User management
✓ Analytics
✓ Queue management
```

### Secondary Admin ✓
```
✓ Messages (assigned)
✓ Queue management (assigned)
✓ Patient management
✓ Analytics (limited)
✗ System settings
✗ User management
✗ WhatsApp config
```

### Moderator ✓
```
✓ Send messages
✓ Manage own queue
✓ Add patients
✓ View analytics
✗ Create queues
✗ Manage users
✗ Delete queues
```

### User ✓
```
✓ View dashboard
✓ See queue status
✓ View messages
✗ No write access
✗ No management
✗ View-only mode
```

## 🔄 Message Lifecycle

```
1. Create Template
   ↓
2. Select Recipients
   ↓
3. Preview Messages
   ↓
4. Confirm Send
   ↓
5. Queue Task
   ↓
6. Send (Ongoing)
   ├─ Success → Delivered
   ├─ Failure → Retry
   └─ Max Retries → Failed
```

## 📊 Key Metrics

**Dashboard Shows**:
- Total messages sent: 1,234
- Success rate: 96.5%
- Failed count: 45
- Avg response: 2.5s
- Active queues: 8
- Total patients: 450

## 🎨 UI Elements

### Header
- Logo & app name
- Current user role
- WhatsApp status
- Logout button

### Sidebar
- Navigation items
- Role-based visibility
- Active state indicator

### Main Content
- Tabbed interface
- Action buttons
- Data tables
- Charts/metrics

### Modals
- Forms
- Confirmations
- Previews
- Alerts

## 🛠️ Common Actions

**Send Message**:
```
1. Messages tab
2. Add/select patients
3. Click "Send to Selected"
4. Choose template
5. Preview message
6. Confirm send
```

**Create Queue**:
```
1. Management tab
2. Click "Add Queue"
3. Fill form
4. Click "Create"
5. Assign moderator
6. View in list
```

**Add Patient**:
```
1. Click "Add Patient"
2. Enter name & phone
3. Select queue
4. Click "Add"
5. View in table
```

**Upload Patients**:
```
1. Click "Upload"
2. Select Excel file
3. Verify data
4. Click "Upload"
5. Monitor progress
```

**WhatsApp Setup**:
```
1. Settings tab
2. Click "Authenticate"
3. Scan QR code
4. Wait for connection
5. Status: Connected ✓
```

## 📱 Responsive Layout

**Desktop**: Full sidebar + content  
**Tablet**: Collapsible sidebar  
**Mobile**: Bottom navigation  

## 🌍 Language

**Default**: Arabic (RTL)  
**UI Direction**: Right-to-left  
**Messages**: Arabic throughout  

## ⏱️ Performance Metrics

- Page load: < 2 seconds
- Message send: < 5 seconds
- File upload: Depends on file size
- API response: < 1 second

## 🔒 Security

- JWT token auth
- Role-based access
- Session management
- Password hashing
- HTTPS ready

## 💾 Data Models

**Queue**:
```json
{
  "id": 1,
  "name": "عيادة الأسنان",
  "clinic": "Clinic name",
  "capacity": 30,
  "estimatedTimePerSession": 15
}
```

**Patient**:
```json
{
  "id": 1,
  "name": "محمد علي",
  "phone": "+966501234567",
  "queueId": 1,
  "status": "ACTIVE"
}
```

**Message**:
```json
{
  "id": 1,
  "phone": "+966501234567",
  "content": "Text...",
  "status": "SENT",
  "timestamp": "2025-10-22T10:30:00Z"
}
```

## 🎯 Testing Priorities

1. **Critical**: Login, Messages, Queue Management
2. **High**: WhatsApp, Templates, Analytics
3. **Medium**: User Management, Settings
4. **Low**: Logging, Audit trails

## 📞 Quick Support

**Feature Not Working?**
1. Refresh page
2. Clear cache
3. Logout & login
4. Check user role
5. Review documentation

**Feature Not Visible?**
1. Check user role
2. Check permissions
3. Review navigation
4. Check sidebar items

**Message Not Sending?**
1. Check phone format
2. Check queue status
3. Check quota limit
4. Review failed logs

---

**Generated**: October 22, 2025  
**Prototype Version**: 1.0  
**Status**: Ready for reference and implementation
