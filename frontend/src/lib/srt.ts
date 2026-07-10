export interface SrtWord {
  text: string;
  start: number;
  end: number;
}

export interface SrtSegment {
  speaker: string | null;
  speakerName?: string | null;
  text: string;
  start: number;
  end: number;
  words?: SrtWord[];
}

function formatSrtTimestamp(milliseconds: number) {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function groupWords(words: SrtWord[]) {
  const groups: SrtWord[][] = [];
  let current: SrtWord[] = [];

  for (const word of words) {
    current.push(word);
    const duration = word.end - (current[0]?.start ?? word.start);
    if (/[.!?…]$/.test(word.text) || current.length >= 12 || duration >= 6_000) {
      groups.push(current);
      current = [];
    }
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

export function buildSrt(words: SrtWord[]) {
  return groupWords(words)
    .map((group, index) => {
      const start = group[0].start;
      const end = group[group.length - 1].end;
      const text = group.map((word) => word.text).join(" ");

      return `${index + 1}\r\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\r\n${text.trim()}\r\n`;
    })
    .join("\r\n");
}

export function buildSrtFromSegments(
  segments: SrtSegment[],
  speakerNames: Record<string, string> = {},
) {
  return segments
    .map((segment, index) => {
      const speaker = segment.speaker
        ? `${speakerNames[segment.speaker] || segment.speakerName || `Người nói ${segment.speaker}`}: `
        : "";

      return `${index + 1}\r\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\r\n${speaker}${segment.text.trim()}\r\n`;
    })
    .join("\r\n");
}

export function downloadSrt(
  filename: string,
  words: SrtWord[],
  segments: SrtSegment[] = [],
  speakerNames: Record<string, string> = {},
) {
  const content =
    segments.length > 0 ? buildSrtFromSegments(segments, speakerNames) : buildSrt(words);
  if (!content) return false;

  const blob = new Blob(["\uFEFF", content], {
    type: "application/x-subrip;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename.replace(/\.[^.]+$/, "") || "transcript"}.srt`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
