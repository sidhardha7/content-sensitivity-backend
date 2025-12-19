# API Documentation

Complete API reference for the Video Content Sensitivity Analysis Platform.

## Base URL

```
Development: http://localhost:5000/api
Production: https://content-sensitivity-backend-production.up.railway.app/api
```

## Authentication

Most endpoints require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained from the `/api/auth/login` endpoint and expire after 24 hours.

---

## Authentication Endpoints

### Register User

Register a new user and create a tenant (first user becomes admin).

**Endpoint:** `POST /api/auth/register`

**Request Body:**

```json
{
  "tenantName": "My Company",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "tenantId": "507f1f77bcf86cd799439012"
  }
}
```

**Errors:**

- `400` - Validation error (missing fields, invalid email)
- `409` - Email already exists

---

### Login

Authenticate user and receive JWT token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "tenantId": "507f1f77bcf86cd799439012"
  }
}
```

**Errors:**

- `400` - Missing email or password
- `401` - Invalid credentials
- `403` - User is inactive

---

### Get Current User

Get authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "tenantId": "507f1f77bcf86cd799439012",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**

- `401` - Unauthenticated (missing or invalid token)

---

## Video Endpoints

### Upload Video

Upload a new video file. Videos are uploaded with status `uploaded` and require manual analysis trigger.

**Endpoint:** `POST /api/videos/upload`

**Required Role:** `editor` or `admin`

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- `video` (file) - Video file (max 500MB)
- `title` (string, required) - Video title
- `description` (string, optional) - Video description

**Response (201):**

```json
{
  "video": {
    "_id": "507f1f77bcf86cd799439013",
    "title": "My Video",
    "description": "Video description",
    "status": "uploaded",
    "safetyStatus": "unknown",
    "size": 52428800,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors:**

- `400` - Missing file, invalid file type, or file too large
- `401` - Unauthenticated
- `403` - Insufficient permissions

---

### List Videos

Get list of videos with role-based filtering.

**Endpoint:** `GET /api/videos`

**Query Parameters:**

- `status` (optional) - Filter by status: `uploaded`, `processing`, `processed`, `failed`
- `safetyStatus` (optional) - Filter by safety: `safe`, `flagged`, `unknown`
- `search` (optional) - Search in title and description
- `fromDate` (optional) - Filter videos from date (ISO 8601)
- `toDate` (optional) - Filter videos to date (ISO 8601)

**Role-Based Access:**

- **Viewer**: Only sees videos assigned to them
- **Editor**: Sees videos they own OR videos assigned to them
- **Admin**: Sees all videos in tenant

**Response (200):**

```json
{
  "videos": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "title": "My Video",
      "description": "Video description",
      "originalFilename": "video.mp4",
      "size": 52428800,
      "duration": 120,
      "status": "processed",
      "safetyStatus": "safe",
      "owner": "507f1f77bcf86cd799439011",
      "assignedTo": ["507f1f77bcf86cd799439014"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

---

### Get Video Details

Get detailed information about a specific video.

**Endpoint:** `GET /api/videos/:id`

**Response (200):**

```json
{
  "video": {
    "_id": "507f1f77bcf86cd799439013",
    "title": "My Video",
    "description": "Video description",
    "originalFilename": "video.mp4",
    "size": 52428800,
    "duration": 120,
    "status": "processed",
    "safetyStatus": "safe",
    "owner": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "assignedTo": [
      {
        "_id": "507f1f77bcf86cd799439014",
        "name": "Jane Smith",
        "email": "jane@example.com"
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

**Errors:**

- `401` - Unauthenticated
- `404` - Video not found or access denied

---

### Stream Video

Stream video file with HTTP range request support for efficient playback.

**Endpoint:** `GET /api/videos/:id/stream`

**Query Parameters:**

- `token` (optional) - JWT token (alternative to Authorization header)

**Headers:**

```
Authorization: Bearer <token>
Range: bytes=0-1023 (optional, for partial content)
```

**Response (200 or 206):**

- `200` - Full video file
- `206` - Partial content (range request)

**Headers:**

```
Content-Type: video/mp4
Content-Length: <file-size>
Accept-Ranges: bytes
Content-Range: bytes 0-1023/<total-size> (for 206)
Cache-Control: public, max-age=3600
```

**Errors:**

- `401` - Unauthenticated
- `404` - Video not found or access denied
- `416` - Range not satisfiable

---

### Start Sensitivity Analysis

Manually trigger content sensitivity analysis for a video. Returns Server-Sent Events (SSE) stream with real-time progress.

**Endpoint:** `POST /api/videos/:id/analyze`

**Required Role:** `editor` or `admin`

**Headers:**

```
Authorization: Bearer <token>
Accept: text/event-stream
```

**Response (200 - SSE Stream):**

```
data: {"progress": 10, "message": "Starting analysis...", "status": "processing"}

data: {"progress": 30, "message": "Extracting video metadata...", "status": "processing"}

data: {"progress": 50, "message": "Analyzing content sensitivity...", "status": "processing"}

data: {"progress": 80, "message": "Finalizing results...", "status": "processing", "safetyStatus": "safe"}

data: {"progress": 100, "message": "Analysis complete!", "status": "processed", "safetyStatus": "safe"}
```

**Errors:**

- `400` - Video is already being processed
- `401` - Unauthenticated
- `403` - Insufficient permissions or video not owned/assigned
- `404` - Video not found

**Note:** Editors can only analyze videos they own or videos assigned to them.

---

### Delete Video

Delete a video and its associated file.

**Endpoint:** `DELETE /api/videos/:id`

**Required Role:** `editor` or `admin`

**Response (200):**

```json
{
  "message": "Video deleted successfully"
}
```

**Errors:**

- `401` - Unauthenticated
- `403` - Insufficient permissions
- `404` - Video not found

**Note:** Editors can only delete videos they own or videos assigned to them.

---

### Assign Users to Video

Add users to video assignment (for viewer access).

**Endpoint:** `POST /api/videos/:id/assign/add`

**Required Role:** `editor` or `admin`

**Request Body:**

```json
{
  "userIds": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"]
}
```

**Response (200):**

```json
{
  "video": {
    "_id": "507f1f77bcf86cd799439013",
    "title": "My Video",
    "assignedTo": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"]
  }
}
```

**Errors:**

- `400` - Invalid userIds array
- `401` - Unauthenticated
- `403` - Insufficient permissions
- `404` - Video not found

---

### Remove Users from Video

Remove users from video assignment.

**Endpoint:** `POST /api/videos/:id/assign/remove`

**Required Role:** `editor` or `admin`

**Request Body:**

```json
{
  "userIds": ["507f1f77bcf86cd799439014"]
}
```

**Response (200):**

```json
{
  "video": {
    "_id": "507f1f77bcf86cd799439013",
    "title": "My Video",
    "assignedTo": ["507f1f77bcf86cd799439015"]
  }
}
```

---

## Admin Endpoints

All admin endpoints require `admin` role.

### List Users

Get all users in the tenant.

**Endpoint:** `GET /api/admin/users`

**Response (200):**

```json
{
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Create User

Create a new user (invite user).

**Endpoint:** `POST /api/admin/users`

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "editor"
}
```

**Response (201):**

```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439014",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "editor",
    "isActive": true,
    "password": "ChangeMe123!"
  }
}
```

**Note:** Default password is `ChangeMe123!`. User should change it on first login.

---

### Update User

Update user information.

**Endpoint:** `PATCH /api/admin/users/:id`

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane.doe@example.com",
  "role": "viewer",
  "isActive": false
}
```

**Response (200):**

```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439014",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "role": "viewer",
    "isActive": false
  }
}
```

---

### Delete User

Delete a user from the tenant.

**Endpoint:** `DELETE /api/admin/users/:id`

**Response (200):**

```json
{
  "message": "User deleted successfully"
}
```

---

### Get User Video Permissions

Get videos owned by and assigned to a specific user.

**Endpoint:** `GET /api/admin/users/:id/videos`

**Response (200):**

```json
{
  "ownedVideos": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "title": "My Video",
      "status": "processed",
      "safetyStatus": "safe"
    }
  ],
  "assignedVideos": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "title": "Assigned Video",
      "status": "processed",
      "safetyStatus": "flagged"
    }
  ]
}
```

---

## Real-Time Events (Socket.io)

Connect to Socket.io server for real-time updates.

**Connection:**

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "your-jwt-token",
  },
});
```

**Events:**

### `processing:start`

Emitted when video processing starts.

```json
{
  "videoId": "507f1f77bcf86cd799439013",
  "status": "processing",
  "progress": 10
}
```

### `processing:progress`

Emitted during video processing with progress updates.

```json
{
  "videoId": "507f1f77bcf86cd799439013",
  "status": "processing",
  "progress": 50,
  "message": "Analyzing content sensitivity...",
  "safetyStatus": "safe"
}
```

### `processing:completed`

Emitted when video processing completes.

```json
{
  "videoId": "507f1f77bcf86cd799439013",
  "status": "processed",
  "progress": 100,
  "safetyStatus": "safe",
  "duration": 120
}
```

### `processing:failed`

Emitted when video processing fails.

```json
{
  "videoId": "507f1f77bcf86cd799439013",
  "status": "failed",
  "error": "Processing failed: ..."
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "message": "Error description"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `206` - Partial Content (range requests)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `416` - Range Not Satisfiable
- `500` - Internal Server Error

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting for production deployments.

## CORS

CORS is configured to allow requests from the `CLIENT_ORIGIN` environment variable. For development, this is typically `http://localhost:5173`.

---

## Examples

### cURL Examples

**Login:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

**Upload Video:**

```bash
curl -X POST http://localhost:5000/api/videos/upload \
  -H "Authorization: Bearer <token>" \
  -F "video=@video.mp4" \
  -F "title=My Video" \
  -F "description=Video description"
```

**List Videos:**

```bash
curl -X GET "http://localhost:5000/api/videos?status=processed&safetyStatus=safe" \
  -H "Authorization: Bearer <token>"
```

---

For more information, see the [Backend README](./README.md).
