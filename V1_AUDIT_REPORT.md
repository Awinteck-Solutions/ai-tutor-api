# AI Tutor API — V1 Audit Report

**Date:** 2026-05-28  
**Scope:** `/api` backend — production & frontend readiness

---

## Version 1 Readiness Score: **86 / 100**

| Area | Score | Notes |
|------|-------|-------|
| Core platform | 90 | Auth, orgs, materials, lessons, RAG, workers |
| Frontend portal APIs | 85 | New `/teacher`, `/student`, `/parent`, `/organization` routes |
| Security | 72 | Org isolation solid; gaps in enrollment filtering & audit read |
| Test coverage | 45 | 17 tests (unit + HTTP smoke); no full DB integration suite |
| Scalability | 78 | Queues + indexes; failed job listing; storage bytes from `fileSize` |

---

## Architecture Audit

### Strengths
- Feature-based folders (`Features/*`) with clear controller → service → model flow
- Shared cross-cutting services (`AccessControlService`, `AcademicHierarchyService`, `content.service`)
- Async AI pipeline via BullMQ (`material-processing`, `ai-generation`)
- RAG with Qdrant + MongoDB fallback

### Weaknesses
| Issue | Severity | Status |
|-------|----------|--------|
| `OrganizationAccessService` duplicates `AccessControlService` | Low | Deprecated wrapper remains |
| Empty `Features/accounts/` folder | Low | Placeholder |
| No repository layer — services hit Mongoose directly | Medium | Acceptable for V1 |
| Audit log write-only, no read API | Medium | Open |
| Student lesson lists not filtered by enrollment everywhere | Medium | Partial in student portal |

### Duplicated logic
- Progress dashboard reused by analytics + student portal (good)
- Lesson material loading duplicated in `LessonService` + `content.service` (acceptable)

---

## Security Audit

### Verified
- JWT access + refresh tokens, bcrypt passwords, logout
- `assertOrgRead` / `assertOrgManage` / `assertAdmin` on most resources
- RAG Qdrant filter always includes `organizationId`
- Chat sessions scoped to `userId`
- Parent access via `ParentStudentLink`

### Fixed in this pass
- `GET /progress/flashcards/due` — added `assertOrgRead`
- `GET /analytics/flashcards/retention` — added `canAccessStudentData` when viewing other users

### Remaining risks
| Risk | Recommendation |
|------|----------------|
| JWT claims stale after role/org change | Short access token TTL or re-fetch user on sensitive ops |
| Self-registration may allow non-student roles | Restrict register to STUDENT; force invites for staff |
| Job status endpoint not org-scoped | Filter job data by organizationId in payload |
| No automated cross-tenant integration tests | Add supertest suite |

---

## AI / RAG Audit

### Verified
- Chunking → embedding → Qdrant upsert on material processing
- Scopes: organization, academic year, subject, topic, material, lesson (via material IDs)
- `AISafetyService` prompt validation + jailbreak patterns
- Conversation memory: last 10 messages per session
- Lesson context injected from MongoDB + material chunks from Qdrant

### Qdrant payload (per chunk)
```json
{
  "organizationId": "✓",
  "academicYearId": "✓",
  "subjectId": "✓",
  "topicId": "✓",
  "lessonId": "" (empty until lesson re-index implemented),
  "materialId": "✓",
  "chunkIndex": "✓",
  "sourceType": "✓",
  "page": "✓"
}
```

### Chat citations (added)
Assistant messages now return:
```json
{
  "answer": "...",
  "citations": [{ "materialId", "materialName", "page", "chunkIndex", "score", "preview" }]
}
```

---

## Queue Audit

| Feature | Status |
|---------|--------|
| Retries (3x exponential backoff) | ✓ |
| Failed job retention (50) | ✓ |
| Job HTTP monitoring `/jobs/*` | ✓ |
| Material reprocess | ✓ `POST /materials/:id/reprocess` |
| Dead-letter queue | ✗ Not implemented |
| Failed job admin UI | ✗ Use Bull Board later |

---

## Completed Features (Verified)

- Authentication (register, login, refresh, logout, password reset, profile)
- Organizations, members, invites, parent links, teacher/subject assignment, student enrollment
- Academic hierarchy (year, term, subject, topic)
- Materials (PDF, text, YouTube) + R2 + async processing + Qdrant
- Multi-material lessons + AI generation + flashcards + quizzes
- Contextual RAG chat (optional scope fields)
- Progress, spaced repetition, quiz attempts
- Analytics (student, teacher, organization)
- Search, notifications, usage limits, audit logging (write)
- Health checks, graceful shutdown, Swagger

---

## Fixed / Improved in This Pass

1. **Portal APIs** for Teacher, Student, Parent, Organization admin
2. **`GET /lessons/:id/sources`** — materials used to build a lesson
3. **Chat citations** with `materialName` + `page`
4. **RAG multi-filter** — AND topic/subject/year with material filters
5. **Security** on flashcard retention + due cards endpoints
6. **Legacy lesson** compatibility (placement backfill, material fallback)

---

## New APIs Added

### Teacher (`/teacher/*`) — roles: TEACHER, SCHOOL_ADMIN, SUPER_ADMIN
| Method | Path |
|--------|------|
| GET | `/teacher/dashboard?organizationId=` |
| GET | `/teacher/subjects?organizationId=` |
| GET | `/teacher/topics?organizationId=&subjectId=` |
| GET | `/teacher/lessons?organizationId=` |
| GET | `/teacher/materials?organizationId=` |
| GET | `/teacher/students?organizationId=` |
| GET | `/teacher/students/:id?organizationId=` |

### Student (`/student/*`) — roles: STUDENT, SUPER_ADMIN
| Method | Path |
|--------|------|
| GET | `/student/dashboard?organizationId=` |
| GET | `/student/continue-learning?organizationId=` |
| GET | `/student/lessons?organizationId=` |
| GET | `/student/lessons/:id?organizationId=` |
| POST | `/student/lessons/:id/complete` |
| GET | `/student/flashcards/review?organizationId=` |
| POST | `/student/flashcards/:id/review` |
| POST | `/student/quizzes/:id/start` |
| POST | `/student/quizzes/:id/submit` |
| POST | `/student/chat` |
| GET | `/student/chat/history?organizationId=` |
| GET | `/student/chat/sessions?organizationId=` |
| GET | `/student/chat/sessions/:id` |
| DELETE | `/student/chat/sessions/:id` |
| GET | `/student/recommendations?organizationId=` |
| GET | `/student/learning-path?organizationId=` |
| GET | `/student/revision-plan?organizationId=` |
| GET | `/student/history?organizationId=` |
| GET | `/student/achievements?organizationId=` |

### Parent (`/parent/*`) — roles: PARENT, SUPER_ADMIN
| Method | Path |
|--------|------|
| GET | `/parent/dashboard?organizationId=` |
| GET | `/parent/students/:id/progress?organizationId=` |
| GET | `/parent/students/:id/analytics?organizationId=` |
| GET | `/parent/students/:id/activity?organizationId=` |

### Organization admin (`/organization/*`) — roles: SCHOOL_ADMIN, SUPER_ADMIN
| Method | Path |
|--------|------|
| GET | `/organization/dashboard?organizationId=` |
| GET | `/organization/usage?organizationId=` |
| GET | `/organization/subscription?organizationId=` |

### Other
| Method | Path |
|--------|------|
| GET | `/lessons/:id/sources` |

**Note:** Existing generic APIs (`/lessons`, `/materials`, `/chat`, `/progress`, `/analytics`) remain available for Admin Portal.

---

## Resolved (2026-05-28 follow-up)

| Risk | Resolution |
|------|------------|
| DB migration | Skipped — database cleared |
| Enrollment enforcement | `EnrollmentScopeService` filters lessons/materials/search for students (enrollment) and teachers (subject assignment) |
| Storage metrics | `UsageLimitService.getStorageUsage()` aggregates `Material.fileSize` |
| Failed jobs | `GET /jobs/failed?queue=` |
| Swagger portal routes | Added to `swagger-output.json` |
| Student chat sessions | `POST /student/chat` accepts optional `sessionId` |
| Self-registration roles | Only `STUDENT` allowed on `/auth/register` |
| Audit read API | `GET /audit?organizationId=` (admin) |
| Job org scoping | `JobAccessService` validates org before returning job status |

## Remaining Risks (Post-V1)

1. **Test coverage** — 17 tests; still below 80% target; add Mongo-backed integration tests
2. **DLQ / Bull Board** — failed jobs listed but no separate dead-letter queue or UI
3. **JWT stale claims** — role/org changes not reflected until token refresh
4. **Qdrant `lessonId` in vectors** — still empty at material index time (by design; lesson scope uses material IDs)
5. **Students with zero enrollments** — see no lessons until enrolled in a subject

---

## Frontend Mapping

| App | Primary prefix | Fallback |
|-----|----------------|----------|
| React Admin Portal | `/organizations`, `/analytics/organization` | `/organization/dashboard` |
| Teacher Portal | `/teacher/*` | `/lessons`, `/materials` |
| Flutter Student App | `/student/*` | `/progress`, `/chat` |
| Parent Portal | `/parent/*` | `/analytics/student?studentId=` |

All portal routes require `?organizationId=` (from JWT or org picker).

---

## Performance Notes

- Indexes exist on `organizationId`, `topicId`, `lessonId`, chat `userId`
- Teacher dashboard uses parallel `countDocuments` + aggregations
- Student learning path loads topics sequentially — consider aggregation pipeline for scale
- N+1 risk in `getLearningPath` — acceptable for V1 class sizes

---

## Recommended Next Steps

1. Add supertest integration tests for auth + org isolation
2. Backfill migration script for curriculum fields
3. Update Swagger with portal paths
4. Restrict registration to STUDENT role
5. Add `GET /audit/logs?organizationId=` for admins
