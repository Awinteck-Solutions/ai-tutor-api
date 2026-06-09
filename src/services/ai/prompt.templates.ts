import {
  buildLessonPromptHeader,
  LessonPromptOptions,
  normalizeStudentLevel,
  RAG_GROUNDING_MATERIAL,
  RAG_GROUNDING_PROMPT_ONLY,
} from "./lessonPrompt.shared";

const LESSON_CONTEXT_SLICE = 16000;

export const PROMPTS = {
  lessonGeneration: (content: string, options: LessonPromptOptions = {}) => {
    const studentLevel = normalizeStudentLevel(options.studentLevel);
    const header = buildLessonPromptHeader({ ...options, studentLevel });

    return `
${header}

${RAG_GROUNDING_MATERIAL}

Transform the following source material into a complete structured lesson.

Material:
${content.slice(0, 14000)}
`.trim();
  },

  lessonFromPrompt: (prompt: string, options: LessonPromptOptions = {}) => {
    const studentLevel = normalizeStudentLevel(options.studentLevel);
    const header = buildLessonPromptHeader({ ...options, studentLevel });

    return `
${header}

${RAG_GROUNDING_PROMPT_ONLY}

Create a complete self-study lesson from the student's learning goal below.

Student learning goal:
${prompt.slice(0, 8000)}
`.trim();
  },

  flashcardGeneration: (
    lessonContent: string,
    count = 10,
    difficulty = "medium"
  ) => `
You are an expert curriculum designer creating flashcards for spaced repetition.

Generate ${count} educational flashcards from this lesson.
Target difficulty: ${difficulty} (most cards should match this level).

Extract from objectives, core concepts, deep dive, and common mistakes.
Stay faithful to the lesson content — do not introduce facts not covered in the lesson.
Vary question types: definitions, applications, comparisons, and misconception checks.

Return ONLY a valid JSON array:
[
  {
    "question": "string",
    "answer": "string",
    "difficulty": "easy|medium|hard"
  }
]

Lesson:
${lessonContent.slice(0, LESSON_CONTEXT_SLICE)}
`,

  quizGeneration: (
    lessonContent: string,
    count = 10,
    difficulty = "medium"
  ) => `
You are an expert curriculum designer creating assessment questions.

Generate ${count} quiz questions from this lesson.
Target difficulty: ${difficulty} (most questions should match this level).

Extract from objectives, core concepts, deep dive, practical examples, and common mistakes.
Stay faithful to the lesson content — do not introduce facts not covered in the lesson.
Include a mix of conceptual reasoning and applied questions.

Return ONLY a valid JSON array:
[
  {
    "type": "mcq|true_false|fill_blank",
    "question": "string",
    "options": ["string"],
    "correctAnswer": "string",
    "explanation": "string",
    "difficulty": "easy|medium|hard"
  }
]

Rules:
- For mcq: provide 4 options in "options"
- For true_false: options should be ["True", "False"]
- For fill_blank: options can be empty array

Lesson:
${lessonContent.slice(0, LESSON_CONTEXT_SLICE)}
`,

  chatSystem: (context: string) => `
You are an AI tutor for an educational platform. Your role is to help students learn clearly and accurately.

STRICT RULES:
1. Answer primarily using the provided educational context below and general educational knowledge appropriate to the topic.
2. Do NOT fabricate citations, page numbers, or specific facts not supported by the context.
3. If the context does not contain enough information, say: "I don't have enough information from the course material to answer that accurately. Try asking about topics covered in your uploaded materials."
4. If context is thin, you may state assumptions and continue in a general educational manner.
5. Keep answers clear, structured, and age-appropriate.
6. When helpful, reference which part of the material your answer comes from.

Educational Context:
${context}
`,

  summaryGeneration: (content: string) => `
Summarize the following educational content in 3-5 concise paragraphs suitable for students.

Content:
${content}
`,
};
