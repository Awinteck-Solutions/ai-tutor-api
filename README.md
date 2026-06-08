# AI Tutor API

Backend API for an AI-powered educational platform.

## Stack

- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT (access + refresh tokens)
- Qdrant (vector search / RAG)
- Cloudflare R2 (file storage)
- OpenAI / Gemini (AI generation)
- BullMQ + Redis (background jobs)
- Swagger (API docs)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:3000`  
Swagger: `http://localhost:3000/swagger`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run generate-swagger` | Generate Swagger docs |
| `npm run generate -- -n <name>` | Scaffold a feature module |

## Architecture

```
src/
├── config/           # Environment configuration
├── database/         # MongoDB connection
├── middlewares/      # Auth, validation, security, errors
├── shared/           # Enums, errors, utils
├── services/         # Cross-cutting: AI, Qdrant, R2, queue
├── helpers/          # Token, email, upload utilities
├── routes/           # Route aggregator
└── Features/         # Feature modules (auth, organization, ...)
    └── <feature>/
        ├── controllers/
        ├── services/
        ├── models/
        ├── dto/
        ├── validators/
        └── routes/
```

## Phase 1 (Implemented)

- Auth: register, login, refresh, logout, forgot/reset password, profile, change password
- Organizations: CRUD, member management, subscription plans

## Phase 2 (Implemented)

- **Materials**: PDF upload (R2), text upload, YouTube links
- **AI Processing Pipeline** (async via BullMQ + Redis):
  1. Extract text (PDF / raw text / YouTube transcript)
  2. Chunk content
  3. Generate embeddings (OpenAI)
  4. Store vectors in Qdrant (`ai_tutor_materials` collection)
  5. Generate AI summary

### Material Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/materials/upload/pdf` | Upload PDF (multipart: `file`, `organizationId`, `title`) |
| POST | `/materials/upload/text` | Upload text content |
| POST | `/materials/youtube` | Add YouTube URL |
| GET | `/materials?organizationId=` | List materials (paginated) |
| GET | `/materials/:id` | Get material + processing status |
| GET | `/materials/:id/chunks` | Get indexed text chunks |
| POST | `/materials/:id/reprocess` | Re-queue AI processing |
| DELETE | `/materials/:id` | Delete material, R2 file, vectors |

### Phase 2 Infrastructure

| Service | Required for | Notes |
|---------|--------------|-------|
| Redis | All processing | BullMQ job queue |
| Qdrant | Vector indexing | `QDRANT_URL` |
| OpenAI | Embeddings + summaries | `OPENAI_API_KEY` |
| Cloudflare R2 | PDF uploads only | Text/YouTube work without R2 |

## Phase 3 (Implemented)

- **Lessons**: AI-generated from processed materials (objectives, concepts, examples, markdown content)
- **Flashcards**: Auto-generated after lesson completes (~10 cards)
- **Quizzes**: Auto-generated after lesson completes (MCQ, True/False, Fill-in-blank)

### AI Generation Flow

```
Material (COMPLETED) → POST /lessons/generate
  → Lesson (async)
  → Flashcards (auto-queued)
  → Quiz (auto-queued)
```

### Lesson / Flashcard / Quiz Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lessons/generate` | Generate lesson from material |
| GET | `/lessons?organizationId=` | List lessons |
| GET | `/lessons/:id` | Get lesson |
| POST | `/lessons/:id/regenerate` | Regenerate lesson |
| DELETE | `/lessons/:id` | Delete lesson + flashcards + quiz |
| POST | `/lessons/:lessonId/flashcards/generate` | Regenerate flashcards |
| GET | `/lessons/:lessonId/flashcards` | List flashcards |
| POST | `/lessons/:lessonId/quiz/generate` | Regenerate quiz |
| GET | `/lessons/:lessonId/quiz` | Get quiz metadata |
| GET | `/lessons/:lessonId/quiz/questions` | Get quiz questions |
| GET | `/quizzes/:id?includeAnswers=true` | Get full quiz with questions |

## Phase 4 (Implemented)

- **AI Chat (RAG)**: Contextual tutor chat scoped to material, lesson, or organization
- **Student Progress**: Dashboard, lesson completion, quiz scores, flashcard performance, weak topics, study streaks

### RAG Chat Flow

```
Student question → Embed query → Qdrant vector search
  → Retrieve chunks + lesson context → AI prompt → Grounded answer + sources
```

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/sessions` | Create session (MATERIAL / LESSON / ORGANIZATION scope) |
| GET | `/chat/sessions?organizationId=` | List sessions |
| GET | `/chat/sessions/:sessionId` | Get session + history |
| POST | `/chat/sessions/:sessionId/messages` | Send message (RAG response) |
| DELETE | `/chat/sessions/:sessionId` | Delete session |

### Progress Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/progress/dashboard?organizationId=` | Full progress dashboard |
| GET | `/progress/lessons?organizationId=` | Lesson progress list |
| PATCH | `/progress/lessons/:lessonId` | Update progress / mark complete |
| POST | `/progress/quiz-attempts` | Submit and grade quiz |
| POST | `/progress/flashcard-reviews` | Record flashcard result |

### Dashboard includes

- Lessons completed / total, completion rate
- Quiz average score, attempts count
- Flashcard accuracy
- Study streak (current + longest)
- Total study time
- Weak topics (from failed quizzes/flashcards)

## API Response Format

```json
{ "success": true, "message": "...", "data": {} }
{ "success": false, "message": "...", "error": {} }
```

## Roles

`SUPER_ADMIN` | `SCHOOL_ADMIN` | `TEACHER` | `PARENT` | `STUDENT`
