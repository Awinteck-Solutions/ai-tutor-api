# API ↔ Frontend Gap Analysis

Last updated: 2026-06-02

## Summary

| Area | Backend routes | Frontend wired | Coverage |
|------|----------------|----------------|----------|
| Auth | 8 | 5 | Profile/password UI pending |
| Organization admin | 14 + portals | ~90% | Invites/assignments/create member **added this pass** |
| Teacher portal | 7 + shared | ~75% | Analytics/search/notifications services added |
| Student portal | 19 | 0% | Flutter app (out of web scope) |
| Parent portal | 4 | 0% | Not in V1 web scope |

---

## New backend endpoints (implemented this pass)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/organizations/:id/invites` | List pending invitations |
| `POST` | `/organizations/:id/members/create` | Create user + add to org (replaces broken `POST /members` with userId) |
| `GET` | `/organizations/:id/assignments` | List teacher/subject, student/enrollment, parent links |

**Also fixed:** `PATCH /organizations/:id/members/:userId/suspend` accepts `{ suspend: boolean }` for reactivation.

---

## Frontend fixes (implemented this pass)

| Issue | Fix |
|-------|-----|
| `markAllNotificationsRead` used POST | Changed to **PATCH** `/notifications/read-all` |
| `addMember` sent wrong body | Uses **POST** `/members/create` with firstName, lastName, email, password, role |
| `getTopics()` without subjectId | Now throws — only calls `GET .../subjects/:subjectId/topics` |
| Settings sent invalid fields | Sends `name`, `logo`, `subscriptionPlan` only |
| Members page | Loads **pending invites** via new API |
| Assignments page | Loads **assignment summary** via new API |

---

## Frontend services added (call existing backend)

### Organization (`organization.services.jsx`)
- `listOrganizations`, `createOrganization`, `deleteOrganization`
- `getInvites`, `createMember`, `acceptInvite`
- `getAssignments`
- `getMaterial`, `getMaterialChunks`, `archiveMaterial`, `getMaterialLogs`
- `getLesson`, `getLessonSources`, `generateLessonFlashcards`, `getLessonFlashcards`, `generateLessonQuiz`, `getLessonQuiz`, `getLessonQuizQuestions`
- `getFlashcardRetention`, `searchContent`
- Audit params: `activityType`, `userId`

### Teacher (`teacher.services.jsx`)
- `getTeacherAnalytics`, `searchContent`, notifications
- `deleteMaterial`, `deleteLesson`, lesson flashcard/quiz helpers
- `pollJobUntilComplete` helper

### Auth (`auth.service.jsx`)
- `updateProfile`, `changePassword`, `forgotPassword`, `resetPassword`, `acceptInvite`

---

## Still unwired in UI (services exist, pages TODO)

| Endpoint | Suggested page |
|----------|----------------|
| `PATCH /auth/profile`, `PATCH /auth/change-password` | User account tab in Settings |
| `POST /organizations`, `GET /organizations` | Onboarding + super-admin org picker |
| `POST /organizations/invites/accept` | `/invite?token=` landing page |
| `GET /materials/:id`, `/chunks`, `PATCH /archive` | Materials detail drawer |
| `GET /lessons/:id`, flashcard/quiz generate | Lessons row actions |
| `GET /analytics/teacher` | Teacher dashboard analytics section |
| `GET /search` | Global search in app header |
| `GET /analytics/flashcards/retention` | Admin analytics / student detail |
| Audit query filters | Audit page filter bar |

---

## Recommended future backend endpoints (not yet built)

| Endpoint | Why |
|----------|-----|
| `PATCH/DELETE /academic/subjects/:id` | Edit/delete subjects in admin UI |
| `PATCH/DELETE /academic/topics/:id` | Edit/delete topics |
| `DELETE /organizations/:id/invites/:inviteId` | Revoke pending invite |
| `DELETE /organizations/:id/assignments/teacher` | Unassign teacher from subject |
| `DELETE /organizations/:id/assignments/student` | Unenroll student |
| `GET /organizations/:id/assignments` ✅ | **Done** |
| `GET /teacher/notifications` | Optional alias — use shared `/notifications` |

---

## Portals out of web V1 scope

- **Student** (`/student/*`) — 19 routes for Flutter app
- **Parent** (`/parent/*`) — 4 routes
- **Chat** (`/chat/*`) — used by student; simplified in student portal

Regenerate `api/src/swagger-output.json` to include new org member routes.
