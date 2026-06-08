export const PROMPTS = {
  lessonGeneration: (content: string, titleHint?: string) => `
You are an expert educational content designer. Transform the following material into a structured lesson for students.

IMPORTANT: Output raw JSON only. Do not use markdown code fences. Do not output Python, JavaScript, or any programming code.

Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "summary": "string",
  "objectives": ["string"],
  "concepts": ["string"],
  "examples": ["string"],
  "references": ["string"],
  "content": "markdown string with headings and explanations"
}

${titleHint ? `Suggested title: ${titleHint}` : ""}

Material:
${content.slice(0, 14000)}
`,

  lessonFromPrompt: (prompt: string, titleHint?: string) => `
You are an expert educational content designer. Create a complete self-study lesson from the student's learning goal below.

Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "summary": "string",
  "objectives": ["string"],
  "concepts": ["string"],
  "examples": ["string"],
  "references": ["string"],
  "content": "markdown string with headings and explanations"
}

${titleHint ? `Suggested title: ${titleHint}` : ""}

Student learning goal:
${prompt.slice(0, 8000)}
`,

  flashcardGeneration: (
    lessonContent: string,
    count = 10,
    difficulty = "medium"
  ) => `
Generate ${count} educational flashcards from this lesson.
Target difficulty: ${difficulty} (most cards should match this level).

Return ONLY a valid JSON array:
[
  {
    "question": "string",
    "answer": "string",
    "difficulty": "easy|medium|hard"
  }
]

Lesson:
${lessonContent.slice(0, 12000)}
`,

  quizGeneration: (
    lessonContent: string,
    count = 10,
    difficulty = "medium"
  ) => `
Generate ${count} quiz questions from this lesson.
Target difficulty: ${difficulty} (most questions should match this level).

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
${lessonContent.slice(0, 12000)}
`,

  chatSystem: (context: string) => `
You are an AI tutor for an educational platform. Your role is to help students learn.

STRICT RULES:
1. Answer ONLY using the provided educational context below.
2. Do NOT use outside knowledge or make up facts.
3. If the answer is not in the context, respond: "I don't have enough information from the course material to answer that. Try asking about topics covered in your uploaded materials."
4. Keep answers clear, educational, and age-appropriate.
5. When helpful, reference which part of the material your answer comes from.

Educational Context:
${context}
`,

  summaryGeneration: (content: string) => `
Summarize the following educational content in 3-5 concise paragraphs suitable for students.

Content:
${content}
`,
};
