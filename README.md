# Kalcul8 Grade Calculator

A cross-platform grade tracking app built with React Native and Expo. Track your courses and assessments with a Firebase-backed account, or use the standalone calculator without signing in (not available yet).

Web Version available at [([Kalcul8grades.com](https://kalcul8grades.com/))]

---

## Features

### Standalone Calculator (not implemented without account setup yet)

- Add unlimited assessment rows with a name, weight (%), and grade (%)
- Live calculation of your current weighted grade and the grade needed on remaining work to hit a target
- State persisted in a browser cookie — your data survives page refreshes

### Courses (requires account)

- Create courses with a name, instructor, semester, and status (Active / Completed / Planned)
- Drag-and-drop reordering of courses
- Real-time sync across devices via Firestore

### Course Detail

- Add two types of assessments:
  - **Single** — one grade and weight
  - **Repeated bundle** — multiple attempts (e.g. weekly quizzes); configure how many best grades to count
- Weighted average grade computed live from graded assessments
- Drag-and-drop reordering of assessments
- Grades accepted in the range **−50 to 150** (supports bonus marks and penalties)
- Up to **50 assessments** per course

### Authentication

- Email / password sign-up and sign-in via Firebase Auth
- Email verification required before accessing the app
- Inline error messages for wrong credentials, unverified email, and rate limiting
- All routes protected — direct URL navigation redirects unauthenticated users to login

---

## Tech Stack

| Layer      | Technology                                                   |
| ---------- | ------------------------------------------------------------ |
| Framework  | [Expo](https://expo.dev) ~54 / React Native 0.81             |
| Routing    | [Expo Router](https://expo.github.io/router) ~6 (file-based) |
| Language   | TypeScript ~5.9                                              |
| Backend    | Firebase Auth + Firestore (v12)                              |
| Animations | react-native-reanimated ~4                                   |
| Gestures   | react-native-gesture-handler ~2.28                           |
| Platforms  | Web, iOS, Android                                            |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- A Firebase project with **Authentication** (Email/Password) and **Firestore** enabled

### 1. Clone and install

```bash
git clone <repo-url>
cd GradeCalculator
npm install
```

### 2. Configure Firebase

Copy the example config and fill in your project credentials:

```bash
cp lib/firebase.example.ts lib/firebase.ts
```

Open `lib/firebase.ts` and replace the placeholder values with your Firebase project settings. You can find these at:

> [Firebase Console](https://console.firebase.google.com) → your project → Project Settings → Your apps → SDK setup and configuration

### 3. Set up Firestore Security Rules

In the Firebase Console, go to **Firestore → Rules** and apply rules that restrict each user to their own data:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 4. Run the app

```bash
# Web (recommended for development)
npm run web

# iOS simulator
npm run ios

# Android emulator
npm run android
```

---

## Project Structure

```
app/
  _layout.tsx          # Root layout — AuthProvider + AuthGuard
  _layout.web.tsx      # Web layout — browser tab bar + sign-out
  index.tsx            # Redirect entry point
  settings.tsx         # User settings screen
  (auth)/
    login.tsx          # Sign-in screen
    register.tsx       # Two-step sign-up screen
    verify-email.tsx   # Email verification pending screen
  (tabs)/
    calculator.tsx     # Standalone grade calculator
    courses.tsx        # Course list with drag-to-reorder
  course/
    [id].tsx           # Course detail — assessments and grade view
components/
  app-text-input.tsx   # Shared styled text input
lib/
  auth-context.tsx     # Firebase Auth React context
  confirm.ts           # Cross-platform confirmation dialog utility
  firebase.ts          # Firebase app initialisation (git-ignored)
  firebase.example.ts  # Config template (committed)
  firestore.ts         # Firestore types and CRUD functions
```

---

## Scripts

| Command           | Description               |
| ----------------- | ------------------------- |
| `npm run start`   | Start the Expo dev server |
| `npm run web`     | Start in web mode         |
| `npm run ios`     | Start on iOS simulator    |
| `npm run android` | Start on Android emulator |
| `npm run lint`    | Run ESLint                |

---

## Input Limits

| Field                    | Limit          |
| ------------------------ | -------------- |
| Email / password (auth)  | 100 characters |
| First name / last name   | 100 characters |
| Course name / instructor | 75 characters  |
| Assessment name          | 30 characters  |
| Assessments per course   | 50             |
| Grade value              | −50 to 150     |
