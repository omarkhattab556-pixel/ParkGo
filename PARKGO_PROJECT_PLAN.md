# 🚗 ParkGo - Automated Parking Management System

> **Production-grade Specification Document for Claude Code**
> **Version:** 1.0.0
> **Stack:** React + Vite + TailwindCSS + Supabase
> **Architecture:** Monorepo with separate Frontend & Backend projects

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Database Schema (DO NOT MODIFY)](#3-database-schema)
4. [Project Structure](#4-project-structure)
5. [Authentication & User Roles](#5-authentication--user-roles)
6. [Core Business Logic](#6-core-business-logic)
7. [Frontend - Subscriber Module](#7-frontend---subscriber-module)
8. [Frontend - Attendant Module](#8-frontend---attendant-module)
9. [Frontend - Manager Module](#9-frontend---manager-module)
10. [Backend API Specification](#10-backend-api-specification)
11. [Parallel Installer Simulation](#11-parallel-installer-simulation)
12. [Reports & Analytics](#12-reports--analytics)
13. [UI/UX Design System](#13-uiux-design-system)
14. [Email & Notifications](#14-email--notifications)
15. [Validation Rules](#15-validation-rules)
16. [Development Roadmap](#16-development-roadmap)
17. [Environment Setup](#17-environment-setup)

---

## 1. Project Overview

### 🎯 Mission
**ParkGo** is an automated parking management system that solves urban parking shortages by providing:
- **Vehicle drop-off & pickup services** at the entrance/exit
- **Subscriber management** (registration & tracking)
- **User services** — available spot identification, parking reservations, parking time extensions
- **Information management** — analytics, reports, and statistical insights

### 👥 User Types
| Role | Hebrew | Description |
|------|--------|-------------|
| `subscriber` | מנוי | End user who parks vehicles |
| `attendant` | סדרן | Staff who registers subscribers & monitors facility |
| `manager` | מנהל | Admin who manages facilities & views reports |

### 🔑 Key Business Rules
- ✅ Initial subscriber registration is **ONLY** done by an Attendant
- ✅ Login is via **EMAIL + PASSWORD** — direct routing based on `user_type`
- ✅ Reservations: must be **at least 24 hours** in advance, **no more than 7 days** ahead
- ✅ Reservations only allowed if **≥ 40% of spots are free**
- ✅ If subscriber doesn't arrive within **15 minutes** of reservation time → auto-cancel
- ✅ Default parking time: **4 hours** (extendable up to 4 more hours)
- ✅ After **3 late returns** → subscription is automatically cancelled
- ✅ Lost confirmation code → emailed to user on demand
- ✅ Parking installers operate **in parallel** — each takes **20 seconds** to process a vehicle

---

## 2. Tech Stack & Architecture

### 🏗️ Architecture
```
parkgo/
├── parkgo-frontend/    ← React 18 + Vite + Tailwind + React Router
└── parkgo-backend/     ← Node.js + Express + Supabase JS SDK
```

### 📦 Frontend Stack
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI library |
| **Vite** | Build tool & dev server |
| **TailwindCSS** | Styling |
| **shadcn/ui** | Component library (Radix UI primitives) |
| **React Router v6** | Routing |
| **Zustand** | Global state management |
| **TanStack Query** | Server state & caching |
| **Axios** | HTTP client |
| **React Hook Form + Zod** | Forms & validation |
| **Recharts** | Charts & reports |
| **Lucide React** | Icons |
| **date-fns** | Date manipulation |
| **react-hot-toast** | Notifications |
| **Framer Motion** | Animations |

### 🔧 Backend Stack
| Technology | Purpose |
|-----------|---------|
| **Node.js + Express** | API server |
| **@supabase/supabase-js** | Database client |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT auth tokens |
| **nodemailer** | Email sending |
| **node-cron** | Scheduled jobs (auto-cancel reservations, etc.) |
| **express-validator** | Request validation |
| **cors / helmet / morgan** | Security & logging |
| **dotenv** | Environment variables |

---

## 3. Database Schema

> ⚠️ **CRITICAL: DO NOT MODIFY this schema. Work with it as-is.**

```sql
-- ENUM types
CREATE TYPE user_type_enum     AS ENUM ('subscriber', 'attendant', 'manager');
CREATE TYPE status_enum        AS ENUM ('active', 'inactive');
CREATE TYPE reservation_status AS ENUM ('active', 'cancelled');
CREATE TYPE msg_type_enum      AS ENUM ('Order Code', 'Late Alert');

-- Users
CREATE TABLE "user" (
    id           SERIAL PRIMARY KEY,
    first_name   VARCHAR(50)  NOT NULL,
    last_name    VARCHAR(50)  NOT NULL,
    email        VARCHAR(100) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,  -- bcrypt hash
    phone_number VARCHAR(15),
    user_type    user_type_enum NOT NULL
);

-- Subscribers
CREATE TABLE subscriber (
    subscriber_num       INT PRIMARY KEY,
    registration_date    DATE        DEFAULT CURRENT_DATE,
    delay_count          INT         DEFAULT 0,
    status               status_enum DEFAULT 'active',
    license_plate_number VARCHAR(8),
    FOREIGN KEY (subscriber_num) REFERENCES "user"(id) ON DELETE CASCADE
);

-- Parking spaces
CREATE TABLE parking_space (
    space_number INT PRIMARY KEY,
    location     VARCHAR(50),
    is_occupied  BOOLEAN DEFAULT FALSE
);

-- Reservations
CREATE TABLE reservation (
    reservation_id    SERIAL PRIMARY KEY,
    subscriber_num    INT NOT NULL,
    parking_space     INT NOT NULL,
    reservation_start TIMESTAMP NOT NULL,
    reservation_end   TIMESTAMP GENERATED ALWAYS AS
                        (reservation_start + INTERVAL '4 hours') STORED,
    confirmation_code INT NOT NULL,
    status            reservation_status DEFAULT 'active',
    created_at        TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (subscriber_num) REFERENCES subscriber(subscriber_num),
    FOREIGN KEY (parking_space)  REFERENCES parking_space(space_number)
);

-- Active parking sessions
CREATE TABLE parking (
    parking_code      SERIAL PRIMARY KEY,
    parking_space     INT NOT NULL,
    parking_date      TIMESTAMP NOT NULL,
    retrieval_time    TIMESTAMP DEFAULT NULL,
    confirmation_code INT NOT NULL,
    subscriber_num    INT NOT NULL,
    extension_count   INT DEFAULT 0,
    max_time_minutes  INT DEFAULT 240,
    FOREIGN KEY (parking_space)  REFERENCES parking_space(space_number),
    FOREIGN KEY (subscriber_num) REFERENCES subscriber(subscriber_num)
);

-- Installers (parking machines/robots)
CREATE TABLE installer (
    installer_id   SERIAL PRIMARY KEY,
    installer_name VARCHAR(50) NOT NULL,
    is_free        BOOLEAN DEFAULT TRUE,
    busy_until     TIMESTAMP DEFAULT NULL
);
```

### 📊 Initial Seed Data
```sql
-- Seed parking spaces (e.g., 50 spots)
INSERT INTO parking_space (space_number, location)
SELECT i, 'Zone-' || CHR(65 + ((i-1) / 10))
FROM generate_series(1, 50) AS i;

-- Seed installers (3 parallel machines)
INSERT INTO installer (installer_name) VALUES
('Installer-A'), ('Installer-B'), ('Installer-C');

-- Seed a default manager
INSERT INTO "user" (first_name, last_name, email, password, phone_number, user_type)
VALUES ('Admin', 'Manager', 'admin@parkgo.com',
        '$2a$10$...', '0500000000', 'manager');
```

---

## 4. Project Structure

### 🎨 Frontend Structure
```
parkgo-frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── axios.js               # Axios instance with interceptors
│   │   ├── auth.api.js
│   │   ├── reservation.api.js
│   │   ├── parking.api.js
│   │   ├── subscriber.api.js
│   │   └── reports.api.js
│   ├── assets/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.jsx
│   │   │   ├── card.jsx
│   │   │   ├── dialog.jsx
│   │   │   ├── input.jsx
│   │   │   ├── table.jsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── DashboardLayout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── common/
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   ├── CodeDisplay.jsx    # Big animated code display
│   │   │   └── InstallerAnimation.jsx
│   │   └── charts/
│   │       ├── OccupancyChart.jsx
│   │       ├── DurationPieChart.jsx
│   │       └── ReservationStatsChart.jsx
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.jsx
│   │   ├── subscriber/
│   │   │   ├── SubscriberDashboard.jsx
│   │   │   ├── ReserveParkingPage.jsx
│   │   │   ├── DropOffCarPage.jsx
│   │   │   ├── PickUpCarPage.jsx
│   │   │   ├── ParkingHistoryPage.jsx
│   │   │   ├── ReservationHistoryPage.jsx
│   │   │   ├── UpdateDetailsPage.jsx
│   │   │   ├── CancelReservationPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   ├── attendant/
│   │   │   ├── AttendantDashboard.jsx
│   │   │   ├── RegisterSubscriberPage.jsx
│   │   │   ├── ActiveSubscribersPage.jsx
│   │   │   ├── ActiveParkingsPage.jsx
│   │   │   ├── FacilityMaintenancePage.jsx
│   │   │   ├── FacilityStatusPage.jsx
│   │   │   └── LoadLevelPage.jsx
│   │   └── manager/
│   │       ├── ManagerDashboard.jsx
│   │       ├── AddFacilityPage.jsx
│   │       ├── RemoveFacilityPage.jsx
│   │       ├── ReportsPage.jsx
│   │       ├── OccupancyReport.jsx
│   │       ├── BehaviorReport.jsx
│   │       └── ReservationsReport.jsx
│   ├── store/
│   │   ├── authStore.js           # Zustand: user, token, role
│   │   └── uiStore.js             # Zustand: sidebar, modals
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useReservations.js
│   │   ├── useParking.js
│   │   └── useInstallers.js
│   ├── utils/
│   │   ├── formatters.js          # date, currency, etc.
│   │   ├── validators.js          # Zod schemas
│   │   ├── constants.js
│   │   └── permissions.js
│   ├── lib/
│   │   └── utils.js               # cn() for Tailwind
│   ├── styles/
│   │   └── globals.css            # Tailwind directives + custom CSS
│   ├── App.jsx                    # Router setup
│   └── main.jsx
├── .env
├── .env.example
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── package.json
```

### ⚙️ Backend Structure
```
parkgo-backend/
├── src/
│   ├── config/
│   │   ├── supabase.js            # Supabase client
│   │   ├── nodemailer.js          # Email transport
│   │   └── constants.js           # Business constants
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── subscriber.controller.js
│   │   ├── reservation.controller.js
│   │   ├── parking.controller.js
│   │   ├── installer.controller.js
│   │   ├── facility.controller.js
│   │   └── reports.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── subscriber.routes.js
│   │   ├── reservation.routes.js
│   │   ├── parking.routes.js
│   │   ├── installer.routes.js
│   │   ├── facility.routes.js
│   │   └── reports.routes.js
│   ├── middleware/
│   │   ├── auth.middleware.js     # JWT verification
│   │   ├── role.middleware.js     # Role-based access
│   │   ├── error.middleware.js
│   │   └── validate.middleware.js # express-validator
│   ├── services/
│   │   ├── installer.service.js   # Parallel installer logic
│   │   ├── email.service.js
│   │   ├── reservation.service.js # Business rules engine
│   │   ├── parking.service.js
│   │   └── reports.service.js
│   ├── jobs/
│   │   ├── cancelExpiredReservations.job.js  # Runs every minute
│   │   ├── checkLateReturns.job.js           # Runs every 5 minutes
│   │   └── freeInstallers.job.js             # Runs every 5 seconds
│   ├── utils/
│   │   ├── codeGenerator.js       # 6-digit confirmation codes
│   │   ├── logger.js
│   │   └── helpers.js
│   └── server.js
├── .env
├── .env.example
└── package.json
```

---

## 5. Authentication & User Roles

### 🔐 Login Flow
```
1. User enters email + password on /login
2. POST /api/auth/login → { email, password }
3. Backend:
   - Find user by email
   - bcrypt.compare(password, user.password)
   - Generate JWT with { id, user_type, email }
   - Return { token, user }
4. Frontend:
   - Store token in localStorage + Zustand
   - Route based on user_type:
     • subscriber  → /subscriber
     • attendant   → /attendant
     • manager     → /manager
```

### 🛡️ Protected Routes
- **`<ProtectedRoute allowedRoles={['subscriber']}>`** → wraps subscriber pages
- **`<ProtectedRoute allowedRoles={['attendant']}>`** → wraps attendant pages
- **`<ProtectedRoute allowedRoles={['manager']}>`** → wraps manager pages

### 🔑 JWT Middleware (Backend)
```javascript
// middleware/auth.middleware.js
export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// middleware/role.middleware.js
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.user_type)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

---

## 6. Core Business Logic

### 🎯 Confirmation Code Generation
- **Format:** 6-digit integer (100000–999999)
- **Uniqueness:** Must be unique among currently active parkings + reservations
- **Generated when:**
  - A reservation is created
  - A walk-in drop-off occurs (no prior reservation)

```javascript
// utils/codeGenerator.js
export const generateConfirmationCode = async (supabase) => {
  let code, exists = true;
  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000);
    const { data: r } = await supabase.from('reservation')
      .select('reservation_id')
      .eq('confirmation_code', code)
      .eq('status', 'active');
    const { data: p } = await supabase.from('parking')
      .select('parking_code')
      .eq('confirmation_code', code)
      .is('retrieval_time', null);
    exists = (r?.length || 0) + (p?.length || 0) > 0;
  }
  return code;
};
```

### 📏 The 40% Free Rule
```javascript
// services/reservation.service.js
export const canMakeReservation = async (supabase, reservationStart) => {
  // Get total spaces
  const { count: totalSpaces } = await supabase
    .from('parking_space').select('*', { count: 'exact', head: true });

  // Calculate overlapping reservations + active parkings at that time
  const resEnd = new Date(reservationStart);
  resEnd.setHours(resEnd.getHours() + 4);

  const { count: overlappingRes } = await supabase
    .from('reservation')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .or(`and(reservation_start.lte.${resEnd.toISOString()},reservation_end.gte.${reservationStart})`);

  const occupiedCount = overlappingRes; // simplified - add active parkings too
  const freePercent = ((totalSpaces - occupiedCount) / totalSpaces) * 100;
  return freePercent >= 40;
};
```

### ⏰ Time Window Validation
```javascript
export const isValidReservationTime = (reservationStart) => {
  const now = new Date();
  const start = new Date(reservationStart);
  const diffHours = (start - now) / (1000 * 60 * 60);
  return diffHours >= 24 && diffHours <= 168; // 24h–7 days
};
```

### 🚨 Late Return & Delay Count
```javascript
// jobs/checkLateReturns.job.js — runs every 5 minutes
export const checkLateReturns = async () => {
  const { data: activeParkings } = await supabase
    .from('parking')
    .select('*, subscriber!inner(*)')
    .is('retrieval_time', null);

  for (const p of activeParkings) {
    const parkingStart = new Date(p.parking_date);
    const maxTime = p.max_time_minutes;
    const elapsed = (Date.now() - parkingStart) / 1000 / 60; // minutes

    if (elapsed > maxTime && !p.late_notified) {
      // Send late email
      await sendLateEmail(p.subscriber_num);

      // Increment delay_count
      const newCount = p.subscriber.delay_count + 1;
      const status = newCount >= 3 ? 'inactive' : 'active';

      await supabase.from('subscriber')
        .update({ delay_count: newCount, status })
        .eq('subscriber_num', p.subscriber_num);

      if (newCount >= 3) {
        await sendSubscriptionCancelledEmail(p.subscriber_num);
      }
    }
  }
};
```

### ⏳ Auto-Cancel No-Show Reservations
```javascript
// jobs/cancelExpiredReservations.job.js — runs every minute
export const cancelExpiredReservations = async () => {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000); // 15 min ago

  const { data: expired } = await supabase
    .from('reservation')
    .select('*')
    .eq('status', 'active')
    .lt('reservation_start', cutoff.toISOString());

  for (const res of expired) {
    // Check if user actually dropped off
    const { data: parking } = await supabase
      .from('parking')
      .select('*')
      .eq('confirmation_code', res.confirmation_code)
      .single();

    if (!parking) {
      // Cancel reservation, free the space
      await supabase.from('reservation')
        .update({ status: 'cancelled' })
        .eq('reservation_id', res.reservation_id);

      await supabase.from('parking_space')
        .update({ is_occupied: false })
        .eq('space_number', res.parking_space);
    }
  }
};
```

---

## 7. Frontend - Subscriber Module

### 🏠 Subscriber Dashboard (`/subscriber`)

**Layout:**
- **Sidebar (right side, RTL friendly):**
  - 📜 Parking History
  - 📋 Reservation History
  - ✏️ Update Details
  - ❌ Cancel Reservation
  - 👤 Profile
  - 🚪 Logout

- **Main content (3 big cards):**
  - 🅿️ **ORDER NOW** → `/subscriber/reserve`
  - 🚗 **DROP OFF CAR** → `/subscriber/drop-off`
  - 🔑 **PICK UP CAR** → `/subscriber/pick-up`

- **Stats Strip at top:**
  - Free spots count: `X / 50`
  - Active reservations: `X`
  - Current parking session: `Code XXXXXX` (if exists)

### 🅿️ ORDER NOW Page (`/subscriber/reserve`)

**Flow:**
1. Show date picker (min: now + 24h, max: now + 7 days)
2. Show time picker (15-minute intervals)
3. On submit:
   - Validate 24h–7d window
   - Backend checks 40% free rule
   - Pick a random free parking_space
   - Generate confirmation_code
   - Insert into `reservation`
   - Return: `{ confirmation_code, space_number, reservation_start }`
4. Show success modal with **HUGE animated confirmation code** + "Save this code!"
5. Send email with the code

**UI Components:**
- Date/time picker with Hebrew locale
- Free spots indicator (live)
- Animated confirmation code reveal (Framer Motion)

### 🚗 DROP OFF CAR Page (`/subscriber/drop-off`)

**Flow:**
```
A. Has reservation?
   → Input confirmation_code
   → Backend verifies code, status='active'
   → Find an available installer
   → Show 20s animation: "Installer-A is parking your car..."
   → After 20s:
     - Insert into `parking` (link to reservation's space)
     - Mark parking_space as occupied
     - Free installer
     - Show success: "Car parked at space #X"

B. No reservation?
   → Check if any space is free (no 40% rule for walk-ins)
   → If yes: generate code, pick space
   → Find available installer
   → Show 20s animation
   → After 20s:
     - Insert into `parking`
     - Display confirmation_code BIG
     - Send email
```

**The Installer Animation:**
- Live progress bar (20 seconds)
- Animated car icon moving into a parking slot
- Installer name displayed
- Queue indicator if all busy: "Waiting for free installer..."

### 🔑 PICK UP CAR Page (`/subscriber/pick-up`)

**Flow:**
```
1. Input confirmation_code
2. Has "Lost code?" button → triggers email resend
3. Backend verifies code → finds active parking
4. Check parking duration:
   - If > max_time_minutes:
     - Show: "You exceeded your time. Extend or pay penalty"
     - Allow extension (up to +240 more minutes, extension_count++)
5. If valid: find free installer
6. Show 20s animation: "Retrieving your vehicle..."
7. After 20s:
   - Update parking.retrieval_time = NOW()
   - Free parking_space
   - Free installer
   - Show: "Your car is at the pickup zone!"
```

### 📋 Submodules

#### Parking History (`/subscriber/parking-history`)
- Table: parking_code, parking_date, retrieval_time, duration, space_number, extension_count
- Filters: date range
- Pagination

#### Reservation History (`/subscriber/reservation-history`)
- Table: reservation_id, start, end, space, code, status
- Filter: active/cancelled

#### Update Details (`/subscriber/update-details`)
- Form fields: license_plate, phone_number, password (with current password check)
- Cannot change: email, first_name, last_name

#### Cancel Reservation (`/subscriber/cancel-reservation`)
- List of active reservations
- Each row has "Cancel" button + confirmation dialog
- On cancel: update reservation.status='cancelled', free the space

#### Profile (`/subscriber/profile`)
- Display all user + subscriber data (read-only)
- Stats: total parkings, total reservations, current delay_count, status

---

## 8. Frontend - Attendant Module

### 🏠 Attendant Dashboard (`/attendant`)

**Sidebar:**
- ➕ Register New Subscriber
- 👥 Active Subscribers
- 🅿️ Active Parkings
- 🔧 Facility Maintenance
- 📊 Facility Status
- 📈 Load Level
- 🚪 Logout

**Top Stats Strip:**
- Total subscribers
- Active subscribers
- Currently parked vehicles
- Free spots / Total

### ➕ Register New Subscriber (`/attendant/register`)

**Form:**
- First name, Last name, Email, Phone, License plate, Initial password
- Validation: unique email, valid Israeli phone, license plate format
- Backend flow:
  1. INSERT into `user` (user_type='subscriber')
  2. INSERT into `subscriber` (subscriber_num = user.id)
  3. Send welcome email with credentials

### 👥 Active Subscribers (`/attendant/subscribers`)

- Searchable table
- Columns: ID, name, email, phone, license_plate, status, delay_count, registration_date
- Filter by status
- View detail modal → all parkings + reservations for that subscriber

### 🅿️ Active Parkings (`/attendant/active-parkings`)

- Real-time table (polling every 10s)
- Columns: parking_code, subscriber name, license_plate, space, parking_date, time_remaining, extension_count
- Color-coded rows: green (OK), yellow (< 30 min left), red (overtime)

### 🔧 Facility Maintenance (`/attendant/maintenance`)

- Big button: "Call Technician"
- Shows technician phone number: `+972-XX-XXX-XXXX`
- Log entry: "Maintenance called at HH:MM"

### 📊 Facility Status (`/attendant/facility-status`)

- Grid view of all installers
- Each card shows:
  - Installer name
  - Status: Free (green) / Busy (yellow)
  - If busy: progress bar with time remaining
  - Current vehicle being handled (if any)

### 📈 Load Level (`/attendant/load-level`)

- Live visual gauge: 0–100% occupied
- Real-time donut chart: Free vs Occupied vs Reserved
- 24-hour timeline showing hourly occupancy
- Auto-refresh every 5 seconds

---

## 9. Frontend - Manager Module

### 🏠 Manager Dashboard (`/manager`)

**Sidebar:**
- ➕ Add Facility (parking space or installer)
- ➖ Remove Facility
- 📊 View Reports
- 👥 All Subscribers (read-only)
- 🅿️ All Active Parkings
- 🚪 Logout

**Dashboard KPIs (large cards with Recharts mini-charts):**
- Total Revenue Estimate (calculated)
- Occupancy Rate (live)
- Total Active Subscribers
- Free Spots
- Average Parking Duration
- Top Peak Hour today

### ➕ Add Facility (`/manager/add-facility`)

**Two tabs:**
1. **Add Parking Space**
   - space_number (auto-suggest next available)
   - location (Zone-A, Zone-B, ...)
2. **Add Installer**
   - installer_name

### ➖ Remove Facility (`/manager/remove-facility`)

- List of all spaces + installers
- Cannot remove occupied/busy ones
- Confirmation modal before delete

### 📊 Reports Page (`/manager/reports`)

**Three Report Tabs:**

#### 📈 Report 1: Monthly Occupancy
- Average monthly occupancy (e.g., 78%) → Big number + trend arrow
- Peak hours occupancy (e.g., 95%) → Heatmap
- Off-peak hours occupancy (e.g., 40%) → Mini chart
- Visual: Stacked bar chart per day of month

#### ⏱️ Report 2: Parking Duration & User Behavior
- Average parking duration: 2.8 hours
- Duration breakdown (Pie Chart):
  - Up to 1 hour: 20%
  - 1–4 hours: 65%
  - Over 4 hours: 15%
- Extensions: 22% (Bar)
- Late returns: 9% (Bar)

#### 📋 Report 3: Pre-Reservations
- Total reservations this month: 420
- Reservations actually used: 82% (Donut)
- Cancellations / no-shows: 17% (Donut)
- Reservation occupancy share: 40% (Bar)
- Timeline: reservations per day of month

**All Charts:** Recharts with Tailwind-styled tooltips & gradients
**Export:** PDF + CSV buttons on each report

---

## 10. Backend API Specification

### 🔐 Auth Routes (`/api/auth`)
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/login` | `{ email, password }` | Returns `{ token, user }` |
| GET | `/me` | — | Returns current user |
| POST | `/logout` | — | Clears server-side session |

### 👥 Subscriber Routes (`/api/subscribers`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/` | attendant | Register a new subscriber |
| GET | `/` | attendant, manager | List all subscribers |
| GET | `/:id` | any | Get subscriber details |
| PATCH | `/:id` | subscriber (self) | Update license_plate, phone, password |
| GET | `/me/profile` | subscriber | My profile + stats |

### 📋 Reservation Routes (`/api/reservations`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/` | subscriber | Create new reservation |
| GET | `/` | attendant, manager | All reservations |
| GET | `/my` | subscriber | My reservations |
| PATCH | `/:id/cancel` | subscriber | Cancel a reservation |
| POST | `/check-availability` | subscriber | Check if 40% rule passes |

### 🅿️ Parking Routes (`/api/parking`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/drop-off` | subscriber | Drop off vehicle (with or without code) |
| POST | `/pick-up` | subscriber | Pick up vehicle |
| POST | `/extend/:parkingCode` | subscriber | Extend parking time |
| POST | `/lost-code` | subscriber | Resend code via email |
| GET | `/active` | attendant, manager | All active parkings |
| GET | `/my-history` | subscriber | My parking history |

### 🔧 Installer Routes (`/api/installers`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/` | any | List installers + status |
| GET | `/free` | system | Get a free installer (internal) |

### 🏢 Facility Routes (`/api/facility`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/spaces` | manager | Add parking space |
| DELETE | `/spaces/:num` | manager | Remove space |
| POST | `/installers` | manager | Add installer |
| DELETE | `/installers/:id` | manager | Remove installer |
| GET | `/status` | attendant, manager | Full facility status |
| GET | `/load` | attendant, manager | Current load level |

### 📊 Reports Routes (`/api/reports`)
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/occupancy` | manager | Monthly occupancy report |
| GET | `/behavior` | manager | User behavior report |
| GET | `/reservations` | manager | Reservations report |
| GET | `/export/:type` | manager | Export as CSV/PDF |

### 📐 Example Response Shapes

**POST /api/parking/drop-off (with reservation):**
```json
Request: { "confirmation_code": 123456 }

Response (after 20s simulation):
{
  "success": true,
  "parking_code": 42,
  "space_number": 17,
  "installer_used": "Installer-B",
  "parked_at": "2026-01-15T14:30:00Z",
  "max_time_minutes": 240,
  "message": "Your car is parked at space #17"
}
```

**GET /api/reports/occupancy:**
```json
{
  "month": "2026-01",
  "average_occupancy": 78,
  "peak_hours_occupancy": 95,
  "off_peak_occupancy": 40,
  "daily": [
    { "date": "2026-01-01", "occupancy": 72 },
    { "date": "2026-01-02", "occupancy": 81 }
  ],
  "hourly_heatmap": [/* 24 values 0-100 */]
}
```

---

## 11. Parallel Installer Simulation

### 🤖 The Concept
Installers are the physical robots/elevators that move cars to spots. There are **multiple installers running in parallel**. Each operation takes **exactly 20 seconds** to simulate real hardware.

### 🔄 Algorithm
```javascript
// services/installer.service.js
export class InstallerService {
  // Get the first free installer; if none, queue request
  static async acquire(supabase) {
    const { data: free, error } = await supabase
      .from('installer')
      .select('*')
      .eq('is_free', true)
      .order('installer_id')
      .limit(1);

    if (!free || free.length === 0) {
      throw new Error('NO_FREE_INSTALLER');
    }

    const installer = free[0];
    const busyUntil = new Date(Date.now() + 20 * 1000); // 20 seconds

    await supabase.from('installer')
      .update({ is_free: false, busy_until: busyUntil.toISOString() })
      .eq('installer_id', installer.installer_id);

    return installer;
  }

  // Release an installer (also called by cron job to auto-release)
  static async release(supabase, installerId) {
    await supabase.from('installer')
      .update({ is_free: true, busy_until: null })
      .eq('installer_id', installerId);
  }

  // The full operation
  static async performOperation(supabase, callback) {
    const installer = await this.acquire(supabase);
    try {
      // Schedule release after 20s
      setTimeout(async () => {
        await this.release(supabase, installer.installer_id);
      }, 20 * 1000);

      // Return immediately so client can show animation
      return { installer, completes_at: new Date(Date.now() + 20 * 1000) };
    } catch (err) {
      await this.release(supabase, installer.installer_id);
      throw err;
    }
  }
}

// jobs/freeInstallers.job.js — runs every 5 seconds (safety net)
export const releaseExpiredInstallers = async () => {
  const now = new Date();
  await supabase.from('installer')
    .update({ is_free: true, busy_until: null })
    .lt('busy_until', now.toISOString())
    .eq('is_free', false);
};
```

### 🎭 Frontend Animation Flow
```
1. User clicks "Drop Off Car"
2. POST /api/parking/drop-off → returns { installer: 'Installer-A', completes_at }
3. Frontend shows full-screen animation:
   - Car icon animating into a parking slot
   - "Installer-A is processing your vehicle..."
   - Live countdown: 20s → 19s → ... → 0s
   - Progress bar filling
4. After 20 seconds:
   - Frontend POSTs /api/parking/drop-off/confirm
   - Backend creates parking record + frees installer
5. Show success modal with parking_code or confirmation_code
```

> **Important:** The 20s wait happens client-side via `setTimeout`, and the actual `parking` row is inserted in a follow-up endpoint OR the backend inserts it scheduled. Recommended: **insert in confirm step** to keep DB consistent if user closes browser.

### 🚦 Queue Indicator
If all installers are busy when user requests drop-off:
- Frontend shows: "All bays occupied. Position in queue: 2"
- Polls `/api/installers` every 2s
- When one frees up → automatically retry the operation

---

## 12. Reports & Analytics

### 📊 Report Calculation Logic

#### Occupancy Report
```sql
-- Average occupancy for current month
WITH hourly_occupancy AS (
  SELECT
    date_trunc('hour', parking_date) AS hour,
    COUNT(*) AS occupied_count
  FROM parking
  WHERE parking_date >= date_trunc('month', NOW())
    AND (retrieval_time IS NULL OR retrieval_time > date_trunc('hour', parking_date))
  GROUP BY hour
)
SELECT
  AVG(occupied_count::float / (SELECT COUNT(*) FROM parking_space) * 100) AS avg_occupancy
FROM hourly_occupancy;
```

#### Duration Distribution
```sql
SELECT
  CASE
    WHEN EXTRACT(EPOCH FROM (retrieval_time - parking_date))/3600 <= 1 THEN 'up_to_1h'
    WHEN EXTRACT(EPOCH FROM (retrieval_time - parking_date))/3600 <= 4 THEN '1_to_4h'
    ELSE 'over_4h'
  END AS bucket,
  COUNT(*) AS count
FROM parking
WHERE retrieval_time IS NOT NULL
  AND parking_date >= date_trunc('month', NOW())
GROUP BY bucket;
```

#### Extension Rate
```sql
SELECT
  AVG(CASE WHEN extension_count > 0 THEN 1.0 ELSE 0 END) * 100 AS extension_rate
FROM parking
WHERE parking_date >= date_trunc('month', NOW());
```

### 🎨 Chart Design Principles
- **Color palette:**
  - Primary: `from-blue-500 to-indigo-600` gradient
  - Success: `emerald-500`
  - Warning: `amber-500`
  - Danger: `red-500`
- **All charts** use Recharts with custom Tailwind-styled tooltips
- **Animations** on chart mount via Framer Motion
- **Responsive:** all charts use `ResponsiveContainer`

---

## 13. UI/UX Design System

### 🎨 Color Tokens (Tailwind Config)
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          900: '#1e3a8a'
        },
        accent: {
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706'
        },
        success: { 500: '#10b981' },
        danger:  { 500: '#ef4444' },
        surface: { 50: '#f8fafc', 100: '#f1f5f9' }
      },
      fontFamily: {
        sans: ['Inter', 'Heebo', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0,0,0,0.04)',
        elevated: '0 8px 32px rgba(0,0,0,0.08)'
      }
    }
  }
};
```

### 🧩 Component Patterns

#### Big Action Card (for dashboard)
```jsx
<motion.button
  whileHover={{ scale: 1.03, y: -4 }}
  whileTap={{ scale: 0.98 }}
  className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600
             p-8 text-white shadow-xl transition-all hover:shadow-2xl"
>
  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10
                  group-hover:scale-150 transition-transform" />
  <Icon className="h-12 w-12 mb-4" />
  <h3 className="text-2xl font-bold mb-2">ORDER NOW</h3>
  <p className="text-blue-100">Reserve your spot 24h–7d in advance</p>
</motion.button>
```

#### Confirmation Code Display
```jsx
<div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100
                border-2 border-emerald-200 p-8 text-center">
  <p className="text-emerald-700 font-medium mb-3">Your Confirmation Code</p>
  <div className="text-7xl font-mono font-bold text-emerald-900 tracking-widest">
    {code.toString().split('').map((d, i) => (
      <motion.span key={i} initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}>
        {d}
      </motion.span>
    ))}
  </div>
  <p className="text-sm text-emerald-700 mt-4">📧 Also sent to your email</p>
</div>
```

#### Sidebar Item
```jsx
<NavLink to={path} className={({ isActive }) => cn(
  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
  isActive
    ? 'bg-blue-500 text-white shadow-md'
    : 'text-slate-600 hover:bg-slate-100'
)}>
  <Icon className="h-5 w-5" />
  <span className="font-medium">{label}</span>
</NavLink>
```

### 🎯 Layout Principles
- **Generous whitespace** — `p-8` minimum for cards
- **Rounded corners** — `rounded-2xl` or `rounded-3xl` for major elements
- **Soft shadows** — `shadow-soft` for cards, `shadow-elevated` on hover
- **Gradients** for primary actions
- **Glass morphism** for modals: `bg-white/80 backdrop-blur-xl`
- **Smooth transitions** — `transition-all duration-200`
- **Hebrew RTL support** — set `dir="rtl"` on the root for Hebrew text where needed

---

## 14. Email & Notifications

### 📧 Email Templates

#### Welcome Email (on registration)
```
Subject: ברוכים הבאים ל-ParkGo! 🚗

שלום {first_name},

נרשמת בהצלחה למערכת ParkGo.

פרטי הכניסה שלך:
- אימייל: {email}
- סיסמה: {initial_password}

מומלץ לשנות את הסיסמה לאחר הכניסה הראשונה.

בברכה,
צוות ParkGo
```

#### Confirmation Code Email
```
Subject: קוד אישור להזמנת חניה - ParkGo

שלום {first_name},

הזמנת החניה שלך אושרה!

🔑 קוד אישור: {confirmation_code}
🅿️ מקום חניה: #{space_number}
🕐 מועד: {reservation_start}

שמור על הקוד - תזדקק לו בעת הגעתך לחניון.
```

#### Late Return Alert
```
Subject: ⚠️ איחור בהוצאת רכב - ParkGo

שלום {first_name},

הרכב שלך עדיין בחניון {minutes_late} דקות אחרי הזמן המקסימלי.
זהו האיחור ה-{delay_count} שלך החודש.

{if delay_count >= 3:
  ⛔ המנוי שלך בוטל אוטומטית עקב 3 איחורים.
  פנה לסדרן לחידוש המנוי.
}

ParkGo
```

#### Lost Code Recovery
```
Subject: שחזור קוד חניה - ParkGo

שלום {first_name},

הקוד שלך לחניה הפעילה:
🔑 {confirmation_code}

מקום: #{space_number}
זמן חניה: החל מ-{parking_date}
```

### 🔧 Nodemailer Config
```javascript
// config/nodemailer.js
import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"ParkGo" <${process.env.SMTP_FROM}>`,
    to, subject, html
  });
};
```

---

## 15. Validation Rules

### 🛡️ Zod Schemas (Frontend & Backend)

```javascript
// utils/validators.js
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'At least 6 characters')
});

export const subscriberRegistrationSchema = z.object({
  first_name: z.string().min(2).max(50),
  last_name: z.string().min(2).max(50),
  email: z.string().email(),
  phone_number: z.string().regex(/^0\d{8,9}$/, 'Invalid Israeli phone'),
  license_plate: z.string().regex(/^\d{2,3}-\d{2,3}-\d{2,3}$/, 'Format: 12-345-67'),
  password: z.string().min(8, 'At least 8 characters')
});

export const reservationSchema = z.object({
  reservation_start: z.string().datetime().refine(val => {
    const start = new Date(val);
    const now = new Date();
    const hoursFromNow = (start - now) / 3600000;
    return hoursFromNow >= 24 && hoursFromNow <= 168;
  }, 'Reservation must be 24h–7d from now')
});

export const updateDetailsSchema = z.object({
  license_plate: z.string().regex(/^\d{2,3}-\d{2,3}-\d{2,3}$/).optional(),
  phone_number: z.string().regex(/^0\d{8,9}$/).optional(),
  current_password: z.string().min(6),
  new_password: z.string().min(8).optional()
});

export const confirmationCodeSchema = z.object({
  confirmation_code: z.number().int().min(100000).max(999999)
});
```

---

## 16. Development Roadmap

### 🚀 Phase 1: Foundation (Day 1)
- [ ] Initialize both repos with Vite + Node.js
- [ ] Install all dependencies
- [ ] Configure Tailwind + shadcn/ui
- [ ] Set up Supabase project & run schema SQL
- [ ] Create seed data (50 spaces, 3 installers, 1 manager)
- [ ] Set up environment variables
- [ ] Configure Axios interceptors

### 🚀 Phase 2: Authentication (Day 2)
- [ ] Login page UI
- [ ] POST /api/auth/login backend
- [ ] JWT middleware
- [ ] Role-based ProtectedRoute
- [ ] Zustand auth store with persistence

### 🚀 Phase 3: Subscriber Core (Days 3-4)
- [ ] Subscriber dashboard layout + sidebar
- [ ] ORDER NOW flow (with 40% validation)
- [ ] DROP OFF CAR flow (with installer simulation)
- [ ] PICK UP CAR flow (with extension UI)
- [ ] Confirmation code modal + email
- [ ] Lost code recovery

### 🚀 Phase 4: Subscriber Extras (Day 5)
- [ ] Parking History page
- [ ] Reservation History page
- [ ] Update Details form
- [ ] Cancel Reservation flow
- [ ] Profile page

### 🚀 Phase 5: Attendant Module (Day 6)
- [ ] Attendant dashboard
- [ ] Register Subscriber form
- [ ] Active Subscribers table
- [ ] Active Parkings real-time view
- [ ] Facility Maintenance page
- [ ] Facility Status grid
- [ ] Load Level live gauge

### 🚀 Phase 6: Manager Module (Day 7)
- [ ] Manager dashboard with KPIs
- [ ] Add/Remove Facility pages
- [ ] All 3 reports with Recharts
- [ ] CSV/PDF export

### 🚀 Phase 7: Background Jobs (Day 8)
- [ ] cron: cancelExpiredReservations (every minute)
- [ ] cron: checkLateReturns (every 5 minutes)
- [ ] cron: releaseExpiredInstallers (every 5 seconds)
- [ ] Email service integration

### 🚀 Phase 8: Polish & Testing (Day 9)
- [ ] Framer Motion animations throughout
- [ ] Loading states & skeletons
- [ ] Error boundaries & toast notifications
- [ ] Empty states for all tables
- [ ] Mobile responsiveness
- [ ] Hebrew RTL where needed
- [ ] End-to-end testing of all flows

---

## 17. Environment Setup

### 📋 `.env` — Backend
```env
PORT=5000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJxxxxx...
SUPABASE_ANON_KEY=eyJxxxxx...

# JWT
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d

# Email (use Mailtrap for dev, Gmail/SendGrid for prod)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=xxxxx
SMTP_PASS=xxxxx
SMTP_FROM=noreply@parkgo.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Business Constants
MAX_PARKING_HOURS=4
MAX_EXTENSION_HOURS=4
MIN_FREE_PERCENT=40
MIN_RESERVATION_HOURS_AHEAD=24
MAX_RESERVATION_DAYS_AHEAD=7
NO_SHOW_GRACE_MINUTES=15
MAX_DELAYS_BEFORE_CANCEL=3
INSTALLER_OPERATION_SECONDS=20
```

### 📋 `.env` — Frontend
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=ParkGo
VITE_TOTAL_PARKING_SPACES=50
```

### 📦 Quick Start Commands

**Backend:**
```bash
cd parkgo-backend
npm install
npm run dev  # nodemon on port 5000
```

**Frontend:**
```bash
cd parkgo-frontend
npm install
npm run dev  # Vite on port 5173
```

### 🔌 package.json — Backend Dependencies
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.7",
    "express-validator": "^7.0.1",
    "node-cron": "^3.0.3",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 🔌 package.json — Frontend Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.13.4",
    "zustand": "^4.4.7",
    "axios": "^1.6.2",
    "react-hook-form": "^7.48.2",
    "@hookform/resolvers": "^3.3.2",
    "zod": "^3.22.4",
    "recharts": "^2.10.3",
    "lucide-react": "^0.294.0",
    "date-fns": "^3.0.0",
    "react-hot-toast": "^2.4.1",
    "framer-motion": "^10.16.16",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0",
    "class-variance-authority": "^0.7.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tabs": "^1.0.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}
```

---

## ✅ Final Notes for Claude Code

### 🎯 Critical Implementation Guidelines

1. **DO NOT modify the database schema.** Work with the provided tables as-is.
2. **All passwords must be bcrypt-hashed** before insertion into the `user` table.
3. **All times stored in UTC** in the database; convert to local time for display.
4. **The 40% free rule** is non-negotiable — always validate before creating reservations.
5. **Installer simulation must be parallel** — multiple users should be able to drop off at the same time if multiple installers are free.
6. **Confirmation codes must be unique** across active reservations + parkings.
7. **Email is mandatory** for: registration, reservation creation, late alerts, lost code recovery, subscription cancellation.
8. **Real-time updates** in attendant dashboards via polling (every 5-10 seconds) — no WebSockets needed for MVP.
9. **All forms** use React Hook Form + Zod validation.
10. **Hebrew/English support** — primary UI in English with Hebrew labels where natural; date pickers should support Hebrew locale.

### 🧪 Test Scenarios to Verify

- [ ] Subscriber A reserves at 14:00 tomorrow → gets code 123456
- [ ] Subscriber A arrives at 13:55 → drops off with code → gets parked
- [ ] Subscriber B tries to reserve when occupancy is 65% → succeeds (35% free, fails! ≥40% needed)
- [ ] Subscriber C arrives 20 minutes late → reservation auto-cancelled, walk-in fails too
- [ ] Subscriber D parks at 10:00, doesn't pick up by 14:00 → late email sent, delay_count++
- [ ] Subscriber E hits 3rd late return → subscription set to 'inactive'
- [ ] 3 subscribers drop off simultaneously → all 3 installers busy → 4th must wait
- [ ] Manager removes Installer-A while it's busy → blocked
- [ ] Manager views January 2026 occupancy report → shows correct percentages

### 🎨 Design Inspiration
Think **Apple Wallet meets Linear meets Stripe Dashboard**:
- Minimal but rich
- Soft shadows, generous spacing
- Subtle animations on every interaction
- Confidence-inspiring confirmation moments (big codes, big checkmarks)

---

## 🎬 Ready to Build!

This document is the **single source of truth** for the ParkGo project.
Use it sequentially through the 9 phases. Each phase should produce working, testable code.

**Good luck, and let's build something exceptional! 🚀**
