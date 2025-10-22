# 🔐 Login Screen Implementation

Complete specification for the login screen component.

---

## 📋 Screen Overview

**Screen ID**: `loginScreen`  
**Purpose**: User authentication entry point  
**Framework**: React + Next.js  
**Styling**: Tailwind CSS  
**RTL**: Yes (Arabic)  
**Components Needed**: 1 main component  

---

## 🎨 Visual Layout

```
┌─────────────────────────────────────────┐
│                                         │
│   [GRADIENT BACKGROUND: Blue-Purple]    │
│                                         │
│    ┌──────────────────────────────┐    │
│    │     WHITE CARD (SHADOW)      │    │
│    │                              │    │
│    │   [CLINIC ICON] (Blue BG)   │    │
│    │                              │    │
│    │   نظام إدارة العيادات       │    │
│    │   (System Title - Large)     │    │
│    │   تسجيل الدخول إلى النظام    │    │
│    │   (Login Subtitle - Gray)    │    │
│    │                              │    │
│    │   ┌──────────────────────┐  │    │
│    │   │ اسم المستخدم        │  │    │
│    │   │ [Username Input]     │  │    │
│    │   └──────────────────────┘  │    │
│    │                              │    │
│    │   ┌──────────────────────┐  │    │
│    │   │ كلمة المرور          │  │    │
│    │   │ [Password Input]     │  │    │
│    │   └──────────────────────┘  │    │
│    │                              │    │
│    │   [Login Button - Full Width]│   │
│    │                              │    │
│    │   Test Credentials:          │    │
│    │   مدير أساسي: admin/admin123 │   │
│    │   مدير ثانوي: admin2/admin123│   │
│    │   مشرف: mod1/mod123          │    │
│    │   مستخدم: user1/user123      │    │
│    │                              │    │
│    └──────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📐 Dimensions & Spacing

**Screen Dimensions**:
- Min Height: Full viewport (100vh)
- Flexbox centered
- Direction: RTL

**Card**:
- Max Width: 448px (md breakpoint)
- Padding: 32px (8 × 4)
- Border Radius: 16px (2xl)
- Shadow: shadow-2xl

**Spacing**:
- Between sections: 24px
- Between inputs: 24px
- Icon size: 80px
- Icon border: 40px

---

## 🎨 Color Scheme

| Element | Color | Tailwind |
|---------|-------|----------|
| Background | Linear gradient | `from-blue-600 to-purple-700` |
| Card | White | `bg-white` |
| Icon BG | Light Blue | `bg-blue-100` |
| Icon | Blue | `text-blue-600` |
| Title | Dark Gray | `text-gray-800` |
| Subtitle | Medium Gray | `text-gray-600` |
| Label | Dark Gray | `text-gray-700` |
| Input Border | Light Gray | `border-gray-300` |
| Input Focus Ring | Blue | `focus:ring-blue-500` |
| Button | Blue | `bg-blue-600` |
| Button Hover | Dark Blue | `hover:bg-blue-700` |
| Credentials Text | Dark Gray | `text-gray-600` |

---

## 🧩 Component Structure

### Main Component: `LoginForm.tsx`

```jsx
export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  return (
    // Full viewport gradient background
    // Centered white card
    // Form fields
    // Submit button
    // Credentials display
  );
}
```

### Sub-Components (Optional, if breaking down):
- `FormInput.tsx` - Reusable input field
- `FormLabel.tsx` - Reusable label
- `CredentialsDisplay.tsx` - Test credentials section

---

## 🔌 API Integration

### Endpoint
```
POST /api/auth/login
```

### Request Body
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Response (Success)
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Administrator",
    "email": "admin@clinic.com",
    "role": "PrimaryAdmin",
    "roleId": 1
  },
  "accessToken": "eyJhbGc...",
  "expiresIn": 3600
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

---

## 📝 Form Fields

### Field 1: Username
- **Type**: Text input
- **Placeholder**: "أدخل اسم المستخدم"
- **Required**: Yes
- **Validation**:
  - Not empty
  - Min length: 3 characters
- **Icon**: Optional (users icon)
- **Error Message**: "Username is required"

### Field 2: Password
- **Type**: Password input (masked)
- **Placeholder**: "أدخل كلمة المرور"
- **Required**: Yes
- **Validation**:
  - Not empty
  - Min length: 6 characters
- **Show/Hide Toggle**: Optional
- **Error Message**: "Password is required"

---

## 🔘 Buttons

### Login Button
- **Text**: "تسجيل الدخول"
- **Type**: Submit
- **Width**: Full width
- **Height**: 48px (py-3)
- **Color**: Blue (`bg-blue-600`)
- **Hover**: Dark blue (`hover:bg-blue-700`)
- **State Variations**:
  - Normal: Blue background
  - Hover: Darker blue
  - Loading: Disabled + spinner
  - Error: Red outline (if needed)

**CSS Classes**:
```
w-full bg-blue-600 text-white py-3 rounded-lg 
hover:bg-blue-700 transition duration-200 font-medium 
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## 🎯 Functionality

### 1. Form Submission
```javascript
async handleLogin() {
  // Validate inputs
  if (!username || !password) {
    setError('All fields required');
    return;
  }
  
  // Show loading state
  setLoading(true);
  setError('');
  
  try {
    // Call API
    const response = await api.post('/auth/login', {
      username,
      password
    });
    
    // Store token
    localStorage.setItem('accessToken', response.accessToken);
    
    // Update auth context
    setUser(response.user);
    
    // Navigate to main app
    router.push('/dashboard');
    
  } catch (err) {
    setError(err.message || 'Login failed');
  } finally {
    setLoading(false);
  }
}
```

### 2. Form Validation
```javascript
const validateForm = () => {
  const errors = {};
  
  if (!username.trim()) {
    errors.username = 'Username is required';
  } else if (username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  }
  
  if (!password.trim()) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  
  return { isValid: Object.keys(errors).length === 0, errors };
};
```

### 3. Enter Key Support
```javascript
const handleKeyPress = (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
};
```

### 4. Error Display
```javascript
{error && (
  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-700 text-sm">{error}</p>
  </div>
)}
```

---

## 🎨 Styling Details

### Typography
- **Title** (`<h1>`):
  - Font size: 24px (text-2xl)
  - Font weight: Bold (font-bold)
  - Color: Dark gray (text-gray-800)
  - Margin bottom: 8px

- **Subtitle** (`<p>`):
  - Font size: 14px (text-sm)
  - Font weight: Normal
  - Color: Medium gray (text-gray-600)

- **Labels**:
  - Font size: 14px (text-sm)
  - Font weight: 500 (font-medium)
  - Color: Dark gray (text-gray-700)
  - Margin bottom: 8px

- **Inputs**:
  - Font size: 14px (text-base)
  - Font weight: Normal
  - Color: Dark gray
  - Padding: 12px 16px (px-4 py-3)

### Spacing
- Icon center margin: 16px (mb-4)
- Title section margin: 32px bottom (mb-8)
- Form section margin: 24px (space-y-6)
- Credentials section margin: 24px top (mt-6)

### Borders & Shadows
- Card shadow: `shadow-2xl`
- Input border: `border border-gray-300`
- Input focus ring: `focus:ring-2 focus:ring-blue-500`
- Input border transparent on focus: `focus:border-transparent`
- Button border radius: `rounded-lg`

---

## 📱 Responsive Design

### Desktop (1024px+)
- Card width: 448px (max-w-md)
- Normal spacing: 32px padding
- Font sizes: As specified

### Tablet (768px - 1023px)
- Card width: 90% of viewport
- Padding: 24px
- Font sizes: Slightly reduced

### Mobile (< 768px)
- Card width: 90% of viewport
- Padding: 20px
- Font sizes: Responsive

**Implementation**:
```jsx
<div className="w-full max-w-md md:max-w-sm lg:max-w-md">
  {/* Card content */}
</div>
```

---

## ♿ Accessibility

### ARIA Labels
```jsx
<input
  aria-label="Username"
  aria-required="true"
  required
/>
<input
  aria-label="Password"
  aria-required="true"
  type="password"
  required
/>
```

### Keyboard Navigation
- Tab: Move between fields
- Shift+Tab: Move back
- Enter: Submit form
- All buttons keyboard accessible

### Color Contrast
- All text meets WCAG AA standards
- Icons not the only indicator of state
- Error messages use color + text

### Focus States
```css
input:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

---

## 🧪 Test Credentials

| Role | Username | Password | ID |
|------|----------|----------|-----|
| Primary Admin | admin | admin123 | 1 |
| Secondary Admin | admin2 | admin123 | 2 |
| Moderator | mod1 | mod123 | 3 |
| User | user1 | user123 | 4 |

**Usage in Component**:
```jsx
const testCredentials = [
  { role: 'مدير أساسي', username: 'admin', password: 'admin123' },
  { role: 'مدير ثانوي', username: 'admin2', password: 'admin123' },
  { role: 'مشرف', username: 'mod1', password: 'mod123' },
  { role: 'مستخدم', username: 'user1', password: 'user123' }
];

return (
  <div className="mt-6 text-center">
    <p className="text-sm text-gray-600">للتجربة، استخدم:</p>
    <div className="mt-2 space-y-1 text-xs">
      {testCredentials.map(cred => (
        <p key={cred.username}>
          <strong>{cred.role}:</strong> {cred.username} / {cred.password}
        </p>
      ))}
    </div>
  </div>
);
```

---

## 🔐 Security Considerations

### Password Input
- ✅ Type: "password" (masked)
- ✅ Autocomplete: "current-password"
- ✅ No password display in localStorage
- ✅ Token stored in httpOnly cookie

### Form Submission
- ✅ HTTPS only in production
- ✅ CSRF protection enabled
- ✅ Rate limiting on endpoint
- ✅ Account lockout after 5 failed attempts

### Error Messages
- ⚠️ Generic message: "Invalid username or password"
- ⚠️ Don't reveal which field is invalid
- ⚠️ Don't confirm username existence

---

## 🔄 State Management

### Local State
```javascript
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
```

### Global State (Context)
```javascript
const { setUser, setToken, setIsAuthenticated } = useAuth();
```

### Persistence
```javascript
// After successful login
localStorage.setItem('accessToken', token);
// OR use HttpOnly cookie (recommended)
```

---

## 📦 Dependencies

```json
{
  "react": "^18.0",
  "next": "^15.0",
  "axios": "^1.0",
  "tailwindcss": "^3.0"
}
```

---

## 📁 File Structure

```
components/
├── auth/
│   ├── LoginForm.tsx (main component)
│   ├── FormInput.tsx (reusable input)
│   └── LoginForm.module.css (optional styles)
lib/
├── api.ts (API calls)
├── auth.ts (Auth context)
└── hooks.ts (Auth hooks)
```

---

## ✅ Implementation Checklist

- [ ] Create `components/auth/LoginForm.tsx`
- [ ] Create `components/shared/FormInput.tsx`
- [ ] Create `lib/api.ts` with login endpoint
- [ ] Setup authentication context
- [ ] Add RTL support (dir="rtl")
- [ ] Add Tailwind styling
- [ ] Add form validation
- [ ] Add error handling
- [ ] Add loading state
- [ ] Test with all 4 credentials
- [ ] Test keyboard navigation
- [ ] Test mobile responsiveness
- [ ] Test error scenarios (wrong password, etc.)
- [ ] Test Enter key submission
- [ ] Verify token storage

---

## 🚀 Integration Steps

### 1. Component Creation
```bash
# Create the component
# File: components/auth/LoginForm.tsx
```

### 2. API Setup
```bash
# Ensure /api/auth/login endpoint exists
# Test with Postman first
```

### 3. Page Integration
```bash
# In pages/index.tsx or pages/login.tsx
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return <LoginForm />;
}
```

### 4. Context Setup
```bash
# Ensure AuthProvider wraps the app
# In _app.tsx or layout.tsx
```

### 5. Testing
```bash
# Test all 4 credentials
# Test validation
# Test error handling
```

---

## 🎯 Success Criteria

After login with valid credentials:
- ✅ Token stored securely
- ✅ User context updated
- ✅ Redirected to dashboard/main app
- ✅ Navigation available
- ✅ API calls authenticated

---

## 📚 References

- Prototype: `External Documents (related)/Prototype.html` (lines 36-75)
- API Spec: `implementation/api/auth.md`
- Component Spec: `implementation/components/auth/LoginForm.tsx`
- Context: `apps/web/lib/auth.js`

---

**Status**: Ready for Implementation ✅  
**Complexity**: Medium  
**Estimated Time**: 2-3 hours  
**Dependencies**: Auth API working  

Generated: October 22, 2025  
Version: 1.0
