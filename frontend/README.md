# CloudStore Frontend - Microservices E-Commerce

Next.js 16 frontend application written with **TypeScript**, **Redux Toolkit**, **Tailwind CSS**, and **Axios** connecting to the **Auth Microservice** (`http://localhost:4000/api/auth`).

---

## 🛠️ Tech Stack & Features

- **Next.js 16 (App Router)** with React 19 & Turbopack
- **Redux Toolkit (`@reduxjs/toolkit` & `react-redux`)**:
  - Global centralized state in `src/store`
  - Typed hooks (`useAppDispatch`, `useAppSelector`)
  - Async Thunks for `checkAuth`, `loginUser`, `registerUser`, `logoutUser`, `refreshUserSession`
- **TypeScript** with complete strict typings for all auth payloads and state
- **Appealing Modern Light Theme**:
  - Crisp, bright, eye-pleasing aesthetic with slate neutral backgrounds (`bg-slate-50`)
  - Elevated white cards with soft shadows (`shadow-xl shadow-slate-200/50`)
  - Vibrant Indigo/Violet gradient accents
  - Clear visual feedback, loading spinners, and status badges
- **Axios Client (`src/lib/axios.ts`)**:
  - Configured with `withCredentials: true` for HTTP-only JWT cookies
  - Response interceptor with automatic silent token refresh on `401 Unauthorized` responses

---

## 🔐 Implemented Authentication Routes & Flows

| Route | Description | Microservice Endpoint |
|---|---|---|
| `/login` | User login with email & password | `POST /api/auth/login` |
| `/register` | Sign up with live password requirement validation | `POST /api/auth/register` |
| `/profile` | Protected dashboard with user info, roles, and manual refresh | `GET /api/auth/profile`, `POST /api/auth/refresh` |
| `/forgot-password` | Request password reset token | `POST /api/auth/forgot-password` |
| `/reset-password` | Set new password using email token | `POST /api/auth/reset-password` |
| `/verify-email` | Activate account via verification token | `POST /api/auth/verify-email` |
| Navigation Header | Shows authenticated user badge, admin pill, and sign out | `POST /api/auth/logout` |

---

## ⚙️ Configuration

Environment variables in `.env.local`:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:4000/api/auth
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
npm run build
npm start
```
