import { CaptionClip } from "../types/project";

/**
 * Converts seconds float into SRT timestamp format: HH:MM:SS,mmm
 */
export function formatSecondsToSrtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (num: number, digits: number = 2) =>
    num.toString().padStart(digits, "0");

  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Parses timestamp string (00:01:23,450 or 00:01:23.450 or 01:23.450) into seconds
 */
export function parseSrtTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(",", ".");
  const parts = clean.split(":");

  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return parseFloat(clean) || 0;
}

/**
 * Generates word-level timestamps distributed across a caption's duration
 */
export function generateWordTimings(
  text: string,
  startTime: number,
  duration: number,
): { word: string; start: number; end: number }[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return [];

  const wordDuration = duration / words.length;
  return words.map((word, idx) => {
    const start = Number((startTime + idx * wordDuration).toFixed(2));
    const end = Number((startTime + (idx + 1) * wordDuration).toFixed(2));
    return { word, start, end };
  });
}

/**
 * Splits a long caption section into punchy, short subtitle chunks (2 to 4 words each)
 * with precise proportional timing and karaoke word timings.
 * Prevents long sentences from flooding the screen or wrapping over multiple lines on long frames.
 */
export function splitCaptionIntoPunchySections(
  text: string,
  startTime: number,
  duration: number,
  maxWords: number = 3,
  maxDuration: number = 1.8,
): { text: string; startTime: number; duration: number }[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return [];

  // If text is already short and duration is reasonable, keep as single section
  if (words.length <= maxWords && duration <= maxDuration) {
    return [{ text: words.join(" "), startTime: Number(startTime.toFixed(2)), duration: Number(duration.toFixed(2)) }];
  }

  const chunks: { text: string; startTime: number; duration: number }[] = [];
  const totalWords = words.length;
  const wordTimeWeight = duration / totalWords;

  let currentWords: string[] = [];
  let chunkStartWordIndex = 0;

  for (let i = 0; i < totalWords; i++) {
    const word = words[i];
    currentWords.push(word);

    // Natural punctuation pause
    const hasPunctuationEnd = /[.?!,]$/.test(word);
    const reachedWordLimit = currentWords.length >= maxWords;
    const isLastWord = i === totalWords - 1;

    // Flush chunk if word limit reached, punctuation encountered, or at end
    if (reachedWordLimit || (hasPunctuationEnd && currentWords.length >= 2) || isLastWord) {
      const chunkWordCount = currentWords.length;
      const rawChunkStart = startTime + chunkStartWordIndex * wordTimeWeight;
      const rawChunkDuration = chunkWordCount * wordTimeWeight;

      const finalStart = Number(rawChunkStart.toFixed(2));
      const finalDur = Math.max(0.6, Number(rawChunkDuration.toFixed(2)));

      chunks.push({
        text: currentWords.join(" "),
        startTime: finalStart,
        duration: finalDur,
      });

      currentWords = [];
      chunkStartWordIndex = i + 1;
    }
  }

  return chunks;
}

/**
 * Re-chunks an array of existing CaptionClips into short, punchy phrases (2 to 4 words each).
 */
export function rechunkCaptionClips(
  clips: CaptionClip[],
  maxWords: number = 3,
  maxDuration: number = 1.8,
): CaptionClip[] {
  const result: CaptionClip[] = [];

  clips.forEach((clip, cIdx) => {
    const sections = splitCaptionIntoPunchySections(
      clip.text,
      clip.startTime,
      clip.duration,
      maxWords,
      maxDuration,
    );

    sections.forEach((sec, sIdx) => {
      const words = generateWordTimings(sec.text, sec.startTime, sec.duration);
      result.push({
        ...clip,
        id: `cap-chunk-${Date.now()}-${cIdx}-${sIdx}`,
        text: clip.uppercase ? sec.text.toUpperCase() : sec.text,
        startTime: sec.startTime,
        duration: sec.duration,
        words: clip.uppercase
          ? words.map((w) => ({ ...w, word: w.word.toUpperCase() }))
          : words,
      });
    });
  });

  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Parses raw SRT or WebVTT content into strongly-typed CaptionClip items
 */
export function parseSrtOrVttContent(
  rawContent: string,
  defaultHighlightColor: string = "#FFE600",
  styleOverrides?: Partial<CaptionClip> & { maxWordsPerCue?: number },
): CaptionClip[] {
  if (!rawContent || !rawContent.trim()) return [];

  // Strip WebVTT headers and normalize line endings
  let text = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (text.startsWith("WEBVTT")) {
    text = text.replace(/^WEBVTT[^\n]*\n+/i, "");
  }

  // Regex to match timestamp line: e.g. 00:00:01.200 --> 00:00:04.500
  const timestampRegex =
    /(?:(\d{1,2}:)?\d{1,2}:\d{2}[,\.]\d{2,3})\s*-->\s*(?:(\d{1,2}:)?\d{1,2}:\d{2}[,\.]\d{2,3})/g;

  // Split into cue blocks
  const blocks = text.split(/\n\s*\n/);
  const captions: CaptionClip[] = [];
  const maxWords = styleOverrides?.maxWordsPerCue ?? 3;

  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const block = blocks[bIdx].trim();
    if (!block) continue;

    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const timeParts = lines[timeLineIdx].split("-->");
    if (timeParts.length < 2) continue;

    const startSec = parseSrtTimeToSeconds(timeParts[0]);
    // Strip WebVTT cue settings like line:80% position:50%
    const endRaw = timeParts[1].trim().split(/\s+/)[0];
    const endSec = parseSrtTimeToSeconds(endRaw);

    const duration = Math.max(0.6, Number((endSec - startSec).toFixed(2)));

    // Remaining lines after timestamp line are subtitle text
    const textLines = lines
      .slice(timeLineIdx + 1)
      .map((line) => line.replace(/<[^>]+>/g, "").trim()) // strip html formatting tags
      .filter(Boolean);

    const captionText = textLines.join(" ");
    if (!captionText) continue;

    // Split long subtitle cues into punchy sections (2-4 words)
    const punchySections = splitCaptionIntoPunchySections(
      captionText,
      startSec,
      duration,
      maxWords,
      1.8,
    );

    punchySections.forEach((section, sIdx) => {
      const words = generateWordTimings(section.text, section.startTime, section.duration);
      const isUpper = styleOverrides?.uppercase;

      captions.push({
        id: `cap-srt-${Date.now()}-${bIdx}-${sIdx}`,
        text: isUpper ? section.text.toUpperCase() : section.text,
        startTime: section.startTime,
        duration: section.duration,
        position: styleOverrides?.position || { x: 50, y: 82 },
        scale: styleOverrides?.scale || 1.0,
        rotation: styleOverrides?.rotation || 0,
        animation: styleOverrides?.animation || "karaoke",
        enableWordHighlight: styleOverrides?.enableWordHighlight !== false,
        highlightColor: styleOverrides?.highlightColor || defaultHighlightColor,
        presetId: styleOverrides?.presetId || "mrbeast",
        uppercase: isUpper,
        words: isUpper
          ? words.map((w) => ({ ...w, word: w.word.toUpperCase() }))
          : words,
        style: {
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: "900",
          fontFamily: "Impact, Arial Black, sans-serif",
          strokeColor: "#000000",
          strokeWidth: 3.5,
          textEffect: "3d",
          backgroundColor: "transparent",
          textAlign: "center",
          ...(styleOverrides?.style || {}),
        },
      });
    });
  }

  return captions.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Exports an array of CaptionClip items into standard .SRT subtitle format
 */
export function exportCaptionsToSrt(captions: CaptionClip[]): string {
  if (!captions || captions.length === 0) return "";

  const sorted = [...captions].sort((a, b) => a.startTime - b.startTime);
  const lines: string[] = [];

  sorted.forEach((cap, index) => {
    const cueNumber = index + 1;
    const startStr = formatSecondsToSrtTime(cap.startTime);
    const endStr = formatSecondsToSrtTime(cap.startTime + cap.duration);

    lines.push(`${cueNumber}`);
    lines.push(`${startStr} --> ${endStr}`);
    lines.push(cap.text || "");
    lines.push(""); // blank line between cues
  });

  return lines.join("\n");
}

/**
 * Triggers client-side download of SRT file
 */
export function downloadSrtFile(
  captions: CaptionClip[],
  filename: string = "subtitles.srt",
): void {
  const srtContent = exportCaptionsToSrt(captions);
  if (!srtContent) return;

  if (typeof document !== "undefined" && typeof window !== "undefined") {
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }
}
