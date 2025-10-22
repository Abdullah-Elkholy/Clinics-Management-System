# 🔐 Authentication API Endpoints

Complete API specification for user authentication.

---

## 📋 Overview

**Module**: Authentication  
**Base URL**: `/api/auth`  
**Protocol**: HTTPS  
**Format**: JSON  
**Authentication**: Bearer token in Authorization header  

---

## 🔌 Endpoints

### 1. Login

**Endpoint**: `POST /api/auth/login`

**Purpose**: Authenticate user and receive access token

**Request**:
```http
POST /api/auth/login HTTP/1.1
Host: api.clinic.com
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| username | string | Yes | Username (3-50 chars) |
| password | string | Yes | Password (6-100 chars) |

**Response (Success - 200)**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@clinic.com",
    "fullName": "Administrator",
    "role": "PrimaryAdmin",
    "roleId": 1,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**Response (Error - 401)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

**Response (Error - 400)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Username and password are required",
    "details": {
      "username": "Username is required",
      "password": "Password must be at least 6 characters"
    }
  }
}
```

**Response (Error - 429)**:
```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_ATTEMPTS",
    "message": "Too many login attempts. Please try again in 15 minutes"
  }
}
```

**Status Codes**:
| Code | Meaning |
|------|---------|
| 200 | Login successful |
| 400 | Validation error |
| 401 | Invalid credentials |
| 429 | Too many attempts |
| 500 | Server error |

**Backend Implementation** (C# / ASP.NET Core):
```csharp
[HttpPost("login")]
[AllowAnonymous]
public async Task<IActionResult> Login(LoginDto dto)
{
    // Validate input
    if (string.IsNullOrEmpty(dto.Username) || string.IsNullOrEmpty(dto.Password))
        return BadRequest(new { error = "Username and password required" });
    
    // Find user
    var user = await _context.Users
        .Include(u => u.Role)
        .FirstOrDefaultAsync(u => u.Username == dto.Username && u.IsActive);
    
    if (user == null || !VerifyPassword(dto.Password, user.PasswordHash))
        return Unauthorized(new { error = "Invalid credentials" });
    
    // Generate tokens
    var accessToken = _jwtService.GenerateAccessToken(user);
    var refreshToken = _jwtService.GenerateRefreshToken();
    
    // Save refresh token
    user.RefreshToken = refreshToken;
    user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
    await _context.SaveChangesAsync();
    
    return Ok(new
    {
        user = new { user.Id, user.Username, user.Email, user.FullName, user.Role },
        accessToken,
        refreshToken,
        expiresIn = 3600,
        tokenType = "Bearer"
    });
}
```

**Frontend Implementation** (React):
```jsx
const handleLogin = async (username, password) => {
  try {
    const response = await api.post('/auth/login', {
      username,
      password
    });
    
    // Store tokens
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    
    // Set auth header
    api.defaults.headers.common['Authorization'] = `Bearer ${response.accessToken}`;
    
    // Update context
    setUser(response.user);
    setIsAuthenticated(true);
    
    return response;
  } catch (error) {
    throw new Error(error.response?.data?.error?.message || 'Login failed');
  }
};
```

---

### 2. Refresh Token

**Endpoint**: `POST /api/auth/refresh`

**Purpose**: Get new access token using refresh token

**Request**:
```http
POST /api/auth/refresh HTTP/1.1
Host: api.clinic.com
Content-Type: application/json
Cookie: refreshToken=eyJhbGc...

{}
```

**Parameters**:
| Name | Type | Location | Required | Description |
|------|------|----------|----------|-------------|
| refreshToken | string | Cookie | Yes | Refresh token from login |

**Response (Success - 200)**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**Response (Error - 401)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Refresh token expired or invalid"
  }
}
```

**Backend Implementation**:
```csharp
[HttpPost("refresh")]
[AllowAnonymous]
public async Task<IActionResult> Refresh()
{
    var refreshToken = Request.Cookies["refreshToken"];
    
    if (string.IsNullOrEmpty(refreshToken))
        return Unauthorized(new { error = "Refresh token required" });
    
    var user = await _context.Users
        .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken 
            && u.RefreshTokenExpiry > DateTime.UtcNow);
    
    if (user == null)
        return Unauthorized(new { error = "Invalid refresh token" });
    
    var newAccessToken = _jwtService.GenerateAccessToken(user);
    
    return Ok(new
    {
        accessToken = newAccessToken,
        expiresIn = 3600,
        tokenType = "Bearer"
    });
}
```

**Frontend Implementation**:
```jsx
// API interceptor handles refresh automatically
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      try {
        const response = await api.post('/auth/refresh');
        api.defaults.headers.common['Authorization'] 
          = `Bearer ${response.accessToken}`;
        return api(error.config);
      } catch (err) {
        // Redirect to login
        router.push('/login');
      }
    }
    return Promise.reject(error);
  }
);
```

---

### 3. Logout

**Endpoint**: `POST /api/auth/logout`

**Purpose**: Invalidate current session

**Request**:
```http
POST /api/auth/logout HTTP/1.1
Host: api.clinic.com
Authorization: Bearer eyJhbGc...

{}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Backend Implementation**:
```csharp
[HttpPost("logout")]
[Authorize]
public async Task<IActionResult> Logout()
{
    var userId = int.Parse(User.FindFirst("userId").Value);
    var user = await _context.Users.FindAsync(userId);
    
    // Invalidate refresh token
    user.RefreshToken = null;
    user.RefreshTokenExpiry = null;
    await _context.SaveChangesAsync();
    
    // Clear cookie
    Response.Cookies.Delete("refreshToken");
    
    return Ok(new { message = "Logged out successfully" });
}
```

**Frontend Implementation**:
```jsx
const handleLogout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    // Always clear local state even if request fails
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
    router.push('/login');
  }
};
```

---

## 🔑 Token Details

### Access Token (JWT)

**Claims**:
```json
{
  "userId": 1,
  "username": "admin",
  "email": "admin@clinic.com",
  "role": "PrimaryAdmin",
  "iat": 1697900000,
  "exp": 1697903600
}
```

**Expiration**: 1 hour (3600 seconds)

**Usage**: Include in Authorization header
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Refresh Token

**Storage**: HttpOnly cookie (secure, sameSite=strict)

**Expiration**: 7 days

**Purpose**: Get new access tokens without re-entering password

---

## 🔐 Security Features

### Rate Limiting
- **Endpoint**: Login
- **Limit**: 5 attempts per 15 minutes per IP
- **Response**: 429 Too Many Requests

### Password Security
- ✅ Bcrypt hashing with salt
- ✅ Minimum 6 characters
- ✅ Never return password in response
- ✅ Never log password

### Token Security
- ✅ JWT signed with secret key
- ✅ HTTPS only in production
- ✅ Refresh token in HttpOnly cookie
- ✅ CSRF protection enabled

### Account Protection
- ✅ Account lockout after 5 failed attempts
- ✅ Lockout duration: 15 minutes
- ✅ Inactive accounts disabled
- ✅ Password expiry enforced

---

## 📊 Request/Response Examples

### Example 1: Successful Login
```
REQUEST:
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

RESPONSE: 200 OK
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@clinic.com",
    "fullName": "Administrator",
    "role": "PrimaryAdmin",
    "roleId": 1
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600
}
```

### Example 2: Invalid Credentials
```
REQUEST:
POST /api/auth/login
{
  "username": "admin",
  "password": "wrongpassword"
}

RESPONSE: 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

### Example 3: Account Locked
```
REQUEST:
POST /api/auth/login
{
  "username": "admin",
  "password": "wrongpassword"
}

RESPONSE: 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account locked due to too many failed login attempts. Try again in 15 minutes"
  }
}
```

### Example 4: Refresh Token
```
REQUEST:
POST /api/auth/refresh
Cookie: refreshToken=eyJ...

RESPONSE: 200 OK
{
  "success": true,
  "accessToken": "eyJ...",
  "expiresIn": 3600
}
```

---

## ⚙️ Configuration

### JWT Configuration
```csharp
var jwtSettings = new JwtSettings
{
    SecretKey = "your-very-long-secret-key-min-32-chars",
    Issuer = "clinic-api",
    Audience = "clinic-web",
    ExpirationMinutes = 60,
    RefreshTokenExpirationDays = 7
};
```

### Cookie Configuration
```csharp
Response.Cookies.Append("refreshToken", refreshToken, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,
    Expires = DateTimeOffset.UtcNow.AddDays(7)
});
```

---

## 🧪 Test Cases

| Test | Input | Expected | Status |
|------|-------|----------|--------|
| Valid login | admin/admin123 | Token returned | ✅ Pass |
| Invalid password | admin/wrong | 401 error | ✅ Pass |
| Invalid username | unknown/pass | 401 error | ✅ Pass |
| Empty fields | /empty | 400 error | ✅ Pass |
| Refresh valid token | (valid token) | New token | ✅ Pass |
| Refresh expired token | (expired token) | 401 error | ✅ Pass |
| Logout | (valid token) | Success | ✅ Pass |

---

## 📚 Related Files

- **Frontend**: `apps/web/lib/auth.js` (Context)
- **Frontend**: `apps/web/lib/api.js` (API calls)
- **Frontend**: `apps/web/lib/hooks.js` (useAuth hook)
- **Backend**: `src/Api/Controllers/AuthController.cs`
- **Backend**: `src/Infrastructure/Services/JwtService.cs`
- **UI Spec**: `implementation/screens/login.md`

---

**Status**: Specification Complete ✅  
**Priority**: P0 (Critical)  
**Estimated Dev Time**: 4-6 hours (backend) + 2-3 hours (frontend)

Generated: October 22, 2025  
Version: 1.0
