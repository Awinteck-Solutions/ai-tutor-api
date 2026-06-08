import { YoutubeTranscript } from "youtube-transcript";
import { AppError } from "../../shared/errors/AppError";

export class YoutubeParserService {
  static extractVideoId(url: string): string {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }

    throw new AppError("Invalid YouTube URL", 400);
  }

  static async extractTranscript(url: string): Promise<string> {
    const videoId = this.extractVideoId(url);

    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      const text = segments.map((s) => s.text).join(" ").trim();

      if (!text) {
        throw new AppError("No transcript available for this video", 422);
      }

      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "Failed to fetch YouTube transcript. Video may not have captions enabled.",
        422
      );
    }
  }
}
