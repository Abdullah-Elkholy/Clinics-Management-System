# 🎨 Main Application Layout

Complete specification for the main application layout structure.

---

## 📋 Overview

**Component**: MainLayout  
**Purpose**: Application container with header, navigation, and content area  
**Framework**: React + Next.js  
**Styling**: Tailwind CSS  
**Responsive**: Mobile, Tablet, Desktop  
**RTL**: Yes (Arabic)  

---

## 🎯 Layout Structure

```
┌────────────────────────────────────────────────────┐
│                 FIXED HEADER (64px)                │
│  Logo | Title          [WhatsApp] [User] [Logout]  │
├───────────────────┬────────────────────────────────┤
│                   │                                │
│   SIDEBAR         │       CONTENT AREA             │
│   (25% width)     │       (75% width)              │
│                   │                                │
│  • Messages       │  ┌─────────────────────────┐   │
│  • Management     │  │  Dynamic Content        │   │
│                   │  │  - Screens              │   │
│  ─────────────    │  │  - Modals               │   │
│  QUEUES PANEL     │  │  - Forms                │   │
│  (below nav)      │  └─────────────────────────┘   │
│                   │                                │
└───────────────────┴────────────────────────────────┘
```

---

## 📐 Component Dimensions

### Header (Fixed)
- Height: 64px (pt-16 = 16 × 4px)
- Width: 100% (full viewport)
- Position: Fixed top, z-index: 40
- Padding: 16px (px-6) horizontal, 16px (py-4) vertical

### Sidebar (Left Panel)
- Width: 25% (w-1/4)
- Height: Viewport - header (h-screen pt-16)
- Position: Flex column
- Background: White (bg-white)
- Border: Right shadow + border (border-l border-gray-200)
- Padding: 16px (p-4)

### Content Area (Main)
- Width: 75% (flex-1)
- Height: Viewport - header
- Background: White (bg-white)
- Overflow: Auto
- Padding: 32px (p-8)

---

## 🎨 Header Design

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  [Icon][Title / Subtitle]    [WhatsApp] [User] [Logout] │
└─────────────────────────────────────────────────────────┘
```

### Left Section (Logo & Title)
```jsx
<div className="flex items-center space-x-4 space-x-reverse">
  {/* Logo Icon */}
  <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">
    <i className="fas fa-clinic-medical text-blue-600"></i>
  </div>
  
  {/* Title */}
  <div>
    <h1 className="text-xl font-bold text-gray-800">
      نظام إدارة العيادات
    </h1>
    <p className="text-sm text-gray-600" id="userRole">
      {userRole}
    </p>
  </div>
</div>
```

### Right Section (Status & User)
```jsx
<div className="flex items-center space-x-4 space-x-reverse">
  {/* WhatsApp Status */}
  {whatsappConnected && (
    <div className="flex items-center space-x-2 space-x-reverse 
                    bg-green-100 px-3 py-1 rounded-full">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <span className="text-sm text-green-700">واتساب متصل</span>
    </div>
  )}
  
  {/* User Menu */}
  <div className="flex items-center space-x-3 space-x-reverse">
    <span className="text-sm text-gray-700">{currentUser}</span>
    <button onClick={logout} className="text-red-600 hover:text-red-700">
      <i className="fas fa-sign-out-alt"></i>
    </button>
  </div>
</div>
```

### Styling
| Element | Class | Details |
|---------|-------|---------|
| Header | `bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40` | White, shadow, border |
| Container | `flex items-center justify-between px-6 py-4` | Flexbox, padding |
| Logo Icon | `bg-blue-100 w-10 h-10 rounded-full` | Blue background, circular |
| Title | `text-xl font-bold text-gray-800` | Large, bold, dark |
| Subtitle | `text-sm text-gray-600` | Small, gray |
| Status Badge | `bg-green-100 px-3 py-1 rounded-full` | Green badge |
| Pulse | `animate-pulse` | Tailwind animation |

---

## 🧭 Left Sidebar (Navigation)

### Navigation Menu
```jsx
<nav className="p-4">
  <ul className="space-y-2">
    {/* Messages Link */}
    <li>
      <button
        onClick={showMessages}
        className="nav-item w-full text-right px-4 py-3 rounded-lg 
                   hover:bg-blue-50 hover:text-blue-600 
                   transition duration-200 
                   flex items-center justify-between"
      >
        <span>الرسائل</span>
        <i className="fas fa-comments"></i>
      </button>
    </li>
    
    {/* Management Link */}
    <li>
      <button
        onClick={showManagement}
        className="nav-item w-full text-right px-4 py-3 rounded-lg 
                   hover:bg-blue-50 hover:text-blue-600 
                   transition duration-200 
                   flex items-center justify-between"
      >
        <span>الإدارة</span>
        <i className="fas fa-cog"></i>
      </button>
    </li>
  </ul>
</nav>
```

### Queues Panel (Below Navigation)
```jsx
<div id="queuesPanel" className="p-4 border-t border-gray-200">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-bold text-gray-800">الطوابير</h3>
    
    {/* Add Queue Button (Admin Only) */}
    {isAdmin && (
      <button
        id="addQueueBtn"
        onClick={showAddQueueModal}
        className="bg-blue-600 text-white w-8 h-8 rounded-full 
                   hover:bg-blue-700 transition duration-200"
      >
        <i className="fas fa-plus text-sm"></i>
      </button>
    )}
  </div>
  
  {/* Queues List */}
  <div id="queuesList" className="space-y-2">
    {/* Queue items populated dynamically */}
  </div>
</div>
```

### Styling
| Element | Class | Details |
|---------|-------|---------|
| Container | `w-1/4 bg-white shadow-lg border-l border-gray-200` | 25% width, white, shadow |
| Nav item | `w-full text-right px-4 py-3 rounded-lg hover:bg-blue-50` | Full width, hover effect |
| Active item | `bg-blue-50 text-blue-600 border-r-4 border-blue-600` | Highlight active |
| Panel header | `font-bold text-gray-800` | Bold text |
| Panel border | `border-t border-gray-200` | Top border |

---

## 📄 Content Area

### Main Content Container
```jsx
<div className="flex-1 bg-white p-8">
  {/* Dynamic content based on selected screen */}
  {currentScreen === 'welcome' && <WelcomeScreen />}
  {currentScreen === 'messages' && <MessagesScreen />}
  {currentScreen === 'management' && <ManagementScreen />}
</div>
```

### Screen Transitions
```javascript
const showMessages = () => {
  setCurrentScreen('messages');
  // Hide other content
  // Show messages screen
};

const showManagement = () => {
  setCurrentScreen('management');
  // Hide other content
  // Show management screen
};
```

---

## 🔄 Navigation Functions

### Show Messages
```javascript
function showMessages() {
  // Hide all screens
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('managementScreen').classList.add('hidden');
  
  // Show messages screen
  document.getElementById('messagesScreen').classList.remove('hidden');
  
  // Highlight nav item
  updateActiveNav('messages');
}
```

### Show Management
```javascript
function showManagement() {
  // Hide all screens
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('messagesScreen').classList.add('hidden');
  
  // Show management screen
  document.getElementById('managementScreen').classList.remove('hidden');
  
  // Highlight nav item
  updateActiveNav('management');
}
```

### Show Queues
```javascript
function showQueue(queueId) {
  // Load queue details
  const queue = queues.find(q => q.id === queueId);
  
  // Display queue details in content area
  renderQueueDetails(queue);
}
```

---

## 🎯 Role-Based Visibility

### Navigation Items Visibility

**Primary Admin** ✅
- Messages: Yes
- Management: Yes
- All queues visible

**Secondary Admin** ✅
- Messages: Yes
- Management: Yes (limited)
- All queues visible

**Moderator** ✅
- Messages: Yes
- Management: No (or limited)
- Only assigned queues visible

**User** ✅
- Messages: View only
- Management: No
- Own activities visible

### Implementation
```javascript
const rolePermissions = {
  PrimaryAdmin: ['messages', 'management', 'admin'],
  SecondaryAdmin: ['messages', 'management'],
  Moderator: ['messages'],
  User: []
};

function showNavItem(item) {
  const userRole = getCurrentUserRole();
  const allowed = rolePermissions[userRole]?.includes(item);
  return allowed;
}
```

---

## 📱 Responsive Behavior

### Desktop (1024px+)
- Header: Full width, normal layout
- Sidebar: 25%, visible
- Content: 75%
- Font sizes: Normal

### Tablet (768px - 1023px)
- Header: Full width, compact
- Sidebar: 30%, visible
- Content: 70%
- Font sizes: Slightly reduced

### Mobile (< 768px)
- Header: Full width, compact
- Sidebar: Hidden (hamburger menu)
- Content: Full width
- Font sizes: Reduced

**Implementation**:
```jsx
<div className="flex md:flex-row flex-col">
  <aside className="hidden md:block md:w-1/4 lg:w-1/4">
    {/* Sidebar */}
  </aside>
  
  <main className="w-full md:w-3/4 lg:w-3/4">
    {/* Content */}
  </main>
</div>
```

---

## 🧩 React Component Structure

### MainLayout.tsx
```jsx
export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [queues, setQueues] = useState([]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header 
        user={user}
        whatsappConnected={whatsappConnected}
        onLogout={logout}
      />
      
      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <Sidebar
          onNavigate={setCurrentScreen}
          queues={queues}
        />
        
        {/* Content */}
        <main className="flex-1 bg-white overflow-auto">
          {currentScreen === 'welcome' && <WelcomeScreen />}
          {currentScreen === 'messages' && <MessagesScreen />}
          {currentScreen === 'management' && <ManagementScreen />}
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Header.tsx
```jsx
export function Header({ user, whatsappConnected, onLogout }) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 
                       fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo & Title */}
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* Logo */}
        </div>
        
        {/* WhatsApp & User */}
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* Status & Menu */}
        </div>
      </div>
    </header>
  );
}
```

### Sidebar.tsx
```jsx
export function Sidebar({ onNavigate, queues }) {
  return (
    <aside className="w-1/4 bg-white shadow-lg border-l border-gray-200">
      {/* Navigation */}
      <nav className="p-4">
        {/* Nav items */}
      </nav>
      
      {/* Queues Panel */}
      <div className="p-4 border-t border-gray-200">
        {/* Queues list */}
      </div>
    </aside>
  );
}
```

---

## 🎨 Color Scheme

| Element | Color | Tailwind |
|---------|-------|----------|
| Header | White | `bg-white` |
| Header Border | Light Gray | `border-gray-200` |
| Sidebar | White | `bg-white` |
| Nav Hover | Light Blue | `hover:bg-blue-50` |
| Nav Hover Text | Blue | `hover:text-blue-600` |
| Active Border | Blue | `border-blue-600` |
| Text Primary | Dark Gray | `text-gray-800` |
| Text Secondary | Medium Gray | `text-gray-600` |
| Icon | Blue | `text-blue-600` |
| Status (Active) | Green | `bg-green-100 text-green-700` |

---

## ⌨️ Keyboard Navigation

- **Tab**: Navigate between nav items
- **Enter**: Activate selected item
- **Escape**: Close any open menus
- **Alt+M**: Jump to Messages
- **Alt+A**: Jump to Management
- **Alt+L**: Logout

---

## 🔐 Authentication Check

```javascript
function MainLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading]);
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return null;
  
  return (
    // Layout components
  );
}
```

---

## 📊 State Management

### Local State
```javascript
const [currentScreen, setCurrentScreen] = useState('welcome');
const [queues, setQueues] = useState([]);
const [selectedQueue, setSelectedQueue] = useState(null);
const [sidebarOpen, setSidebarOpen] = useState(true); // Mobile
```

### Global State (Context)
```javascript
const { user, logout } = useAuth();
const { whatsappConnected } = useWhatsApp();
```

---

## 📁 File Structure

```
components/
├── layouts/
│   ├── MainLayout.tsx (main)
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── MainLayout.module.css
├── screens/
│   ├── WelcomeScreen.tsx
│   ├── MessagesScreen.tsx
│   └── ManagementScreen.tsx
└── shared/
    └── LoadingSpinner.tsx
```

---

## ✅ Implementation Checklist

- [ ] Create `components/layouts/MainLayout.tsx`
- [ ] Create `components/layouts/Header.tsx`
- [ ] Create `components/layouts/Sidebar.tsx`
- [ ] Add responsive behavior
- [ ] Add role-based visibility
- [ ] Implement navigation functions
- [ ] Add keyboard shortcuts
- [ ] Add loading states
- [ ] Test header layout
- [ ] Test sidebar collapse (mobile)
- [ ] Test navigation between screens
- [ ] Test responsive design

---

## 🚀 Integration Steps

1. **Create Base Layout**
   - MainLayout.tsx with header + sidebar structure

2. **Add Navigation**
   - Link nav buttons to screen functions

3. **Add Queues Panel**
   - Fetch and display queues

4. **Add Responsiveness**
   - Mobile hamburger menu
   - Tablet layout adjustments

5. **Add Role-Based Logic**
   - Show/hide based on user role

6. **Test Everything**
   - All screen transitions
   - All responsive sizes
   - All role combinations

---

**Status**: Specification Complete ✅  
**Complexity**: Medium  
**Estimated Time**: 4-5 hours  

Generated: October 22, 2025  
Version: 1.0
