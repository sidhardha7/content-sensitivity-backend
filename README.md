# Backend - Video Content Sensitivity Analysis API

A Node.js + Express + TypeScript backend API for video upload, content sensitivity analysis, and streaming.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- **RESTful API** with Express.js
- **JWT Authentication** with role-based access control
- **Multi-Tenant Architecture** for data isolation
- **Video Upload & Storage** with Multer
- **Content Sensitivity Analysis** using FFmpeg and Sharp
- **Real-Time Updates** via Socket.io
- **Video Streaming** with HTTP range requests
- **MongoDB** for data persistence
- **TypeScript** for type safety

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.x
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Video Processing**: FFmpeg, fluent-ffmpeg
- **Image Analysis**: Sharp
- **Real-Time**: Socket.io
- **Security**: Helmet, CORS, bcryptjs

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **MongoDB Atlas** account (free tier works) or **Local MongoDB** installation
- **FFmpeg** - Required for video processing
  - **Windows**: Download from [FFmpeg.org](https://ffmpeg.org/download.html) or use `winget install Gyan.FFmpeg`
  - **macOS**: `brew install ffmpeg`
  - **Linux**: `sudo apt-get install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (CentOS/RHEL)

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd pulsegen.io/backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration (see [Environment Variables](#environment-variables) section).

### Step 4: Verify FFmpeg Installation

```bash
ffmpeg -version
```

If FFmpeg is not in your PATH, you can specify the paths in `.env`:

```env
FFMPEG_PATH=C:\path\to\ffmpeg.exe
FFPROBE_PATH=C:\path\to\ffprobe.exe
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Required
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters

# Optional
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

# FFmpeg paths (optional, auto-detected if in PATH)
FFMPEG_PATH=C:\path\to\ffmpeg.exe
FFPROBE_PATH=C:\path\to\ffprobe.exe

# Test mode for sensitivity analysis (optional)
TEST_MODE=false
```

### MongoDB Setup

1. **MongoDB Atlas (Recommended)**:
   - Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a new cluster
   - Create a database user
   - Whitelist your IP address (or use `0.0.0.0/0` for development)
   - Get your connection string and add it to `MONGODB_URI`

2. **Local MongoDB**:
   - Install MongoDB locally
   - Start MongoDB service
   - Use connection string: `mongodb://localhost:27017/pulsegen`

## 🏃 Running the Server

### Development Mode

```bash
npm run dev
```

This starts the server with hot-reload using `ts-node-dev`. The server will restart automatically on file changes.

### Production Build

```bash
# Build TypeScript to JavaScript
npm run build

# Start the production server
npm start
```

### Server Status

Once running, you should see:

```
[db] MongoDB connected
Server is running on port 5000
Socket.io server initialized
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.ts              # MongoDB connection
│   │   └── env.ts             # Environment variables
│   ├── middleware/
│   │   └── auth.ts            # JWT authentication & RBAC
│   ├── models/
│   │   ├── index.ts           # Model exports
│   │   ├── Tenant.ts          # Tenant schema
│   │   ├── User.ts            # User schema
│   │   └── Video.ts           # Video schema
│   ├── routes/
│   │   ├── admin.routes.ts    # Admin user management
│   │   ├── auth.routes.ts     # Authentication routes
│   │   └── video.routes.ts    # Video management routes
│   ├── services/
│   │   ├── authService.ts     # Authentication logic
│   │   ├── processingService.ts # Video processing
│   │   ├── sensitivityAnalysis.ts # Content analysis
│   │   ├── storageService.ts  # File storage
│   │   └── videoService.ts    # Video business logic
│   └── realtime/
│       └── socket.ts          # Socket.io setup
├── uploads/                   # Video file storage
├── temp/                      # Temporary frame extraction
├── dist/                      # Compiled JavaScript (production)
├── index.ts                   # Application entry point
├── package.json
├── tsconfig.json
└── .env                       # Environment variables
```

## 🔐 Authentication & Authorization

### User Roles

- **Viewer**: Read-only access to assigned videos
- **Editor**: Can upload videos and manage videos they own or are assigned
- **Admin**: Full system access, including user management

### JWT Token

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are issued on login and expire after 24 hours (configurable).

## 📡 API Documentation

See [API.md](./API.md) for complete API documentation.

### Quick Reference

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

**Videos:**
- `POST /api/videos/upload` - Upload video (Editor/Admin)
- `GET /api/videos` - List videos (role-based)
- `GET /api/videos/:id` - Get video details
- `GET /api/videos/:id/stream` - Stream video
- `POST /api/videos/:id/analyze` - Start sensitivity analysis (Editor/Admin)
- `DELETE /api/videos/:id` - Delete video (Editor/Admin)

**Admin:**
- `GET /api/admin/users` - List users (Admin only)
- `POST /api/admin/users` - Create user (Admin only)
- `PATCH /api/admin/users/:id` - Update user (Admin only)
- `DELETE /api/admin/users/:id` - Delete user (Admin only)

## 🏗️ Architecture

### Request Flow

```
Client Request
    ↓
Express Middleware (CORS, Helmet, Body Parser)
    ↓
Authentication Middleware (JWT verification)
    ↓
Role-Based Access Control (RBAC)
    ↓
Route Handler
    ↓
Service Layer (Business Logic)
    ↓
Database (MongoDB via Mongoose)
    ↓
Response
```

### Video Processing Flow

```
Video Upload
    ↓
Save to Storage (uploads/)
    ↓
Create Video Record (status: 'uploaded')
    ↓
Manual Analysis Trigger
    ↓
Extract Frames (FFmpeg)
    ↓
Analyze Frames (Sharp - brightness, contrast, color variance)
    ↓
Calculate Risk Score
    ↓
Update Video (status: 'processed', safetyStatus: 'safe'/'flagged')
    ↓
Real-Time Updates (Socket.io)
```

### Multi-Tenant Architecture

- Each organization has a unique `tenantId`
- All data (users, videos) is scoped by `tenantId`
- Complete data isolation between tenants
- Users can only access data within their tenant

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **CORS Protection**: Configurable origin whitelist
- **Helmet.js**: Security headers
- **Input Validation**: Request validation and sanitization
- **File Upload Limits**: 500MB max file size
- **Role-Based Access**: Granular permission system

## 🐛 Troubleshooting

### Server Won't Start

**Issue**: `Error: Cannot find module`
- **Solution**: Run `npm install` to install dependencies

**Issue**: `MongoDB connection error`
- **Solution**: 
  - Verify `MONGODB_URI` is correct
  - Check MongoDB Atlas IP whitelist
  - Ensure MongoDB service is running (local)

**Issue**: `Port 5000 already in use`
- **Solution**: Change `PORT` in `.env` or kill the process using port 5000

### FFmpeg Issues

**Issue**: `Cannot find ffmpeg` or `ffprobe not found`
- **Solution**:
  - Install FFmpeg: `winget install Gyan.FFmpeg` (Windows) or `brew install ffmpeg` (macOS)
  - Add FFmpeg to system PATH
  - Or specify paths in `.env`: `FFMPEG_PATH` and `FFPROBE_PATH`

**Issue**: Frame extraction fails
- **Solution**: 
  - Verify video file is valid
  - Check file permissions
  - Ensure sufficient disk space

### Video Processing Fails

**Issue**: Analysis never completes
- **Solution**:
  - Check server logs for errors
  - Verify FFmpeg is working: `ffmpeg -version`
  - Check disk space in `temp/` directory
  - Review video file format (MP4, MOV, etc.)

### Authentication Issues

**Issue**: `Invalid or expired token`
- **Solution**: 
  - Login again to get a new token
  - Check `JWT_SECRET` is set correctly
  - Verify token is sent in Authorization header

## 📝 Development

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Consistent naming conventions

### Adding New Features

1. Create service function in `src/services/`
2. Add route in `src/routes/`
3. Add middleware if needed in `src/middleware/`
4. Update API documentation

### Testing

Currently, manual testing is used. For automated testing:

```bash
# Install test dependencies
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test
```

## 📦 Deployment

See the main [DEPLOYMENT.md](../DEPLOYMENT.md) for deployment instructions.

### Quick Deploy to Railway

1. Connect your GitHub repository to Railway
2. Railway will auto-detect Node.js
3. Set environment variables in Railway dashboard
4. Deploy!

## 📄 License

ISC

## 👥 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Open a GitHub issue
- Check the [API Documentation](./API.md)
- Review the main [README.md](../README.md)

---

Built with ❤️ using Node.js, Express, and TypeScript

