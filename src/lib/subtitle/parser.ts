import type { SubtitleCue, SubtitleFormat } from './types';

export function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

export function parseSRTTime(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match) return -1;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export function parseASSTime(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!match) return -1;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centiseconds = parseInt(match[4], 10);

  return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function stripASSFormatting(text: string): string {
  let result = text;
  result = result.replace(/\{\\[^}]*\}/g, '');
  result = result.replace(/\\N/g, '\n');
  result = result.replace(/\\n/g, ' ');
  result = result.replace(/\\h/g, ' ');
  return result.trim();
}

export function parseSRT(content: string): SubtitleCue[] {
  try {
    const cleaned = stripBOM(content);
    const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split(/\n\n+/);

    const cues: SubtitleCue[] = [];

    for (const block of blocks) {
      try {
        const lines = block.trim().split('\n');
        if (lines.length < 2) continue;

        let timeLineIdx = -1;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('-->')) {
            timeLineIdx = i;
            break;
          }
        }

        if (timeLineIdx === -1) continue;

        const id = timeLineIdx > 0 ? lines[timeLineIdx - 1].trim() : String(cues.length + 1);

        const timeParts = lines[timeLineIdx].split('-->');
        if (timeParts.length !== 2) continue;

        const startTime = parseSRTTime(timeParts[0]);
        const endTime = parseSRTTime(timeParts[1]);

        if (startTime < 0 || endTime < 0 || startTime >= endTime) continue;

        const textLines = lines.slice(timeLineIdx + 1);
        const originalText = textLines.join('\n').trim();
        const text = stripHtmlTags(originalText).replace(/\n/g, ' ');

        if (!text) continue;

        cues.push({ id, startTime, endTime, text, originalText });
      } catch {
        continue;
      }
    }

    return cues;
  } catch {
    return [];
  }
}

export function parseASS(content: string): SubtitleCue[] {
  try {
    const cleaned = stripBOM(content);
    const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    let inEvents = false;
    let formatFields: string[] = [];
    const cues: SubtitleCue[] = [];

    for (const line of lines) {
      try {
        const trimmed = line.trim();

        if (trimmed.startsWith('[')) {
          inEvents = trimmed.toLowerCase() === '[events]';
          formatFields = [];
          continue;
        }

        if (inEvents && trimmed.toLowerCase().startsWith('format:')) {
          formatFields = trimmed.slice('format:'.length).split(',').map((f) => f.trim().toLowerCase());
          continue;
        }

        if (inEvents && trimmed.toLowerCase().startsWith('dialogue:')) {
          const dialogueContent = trimmed.slice('dialogue:'.length);
          const allFields = dialogueContent.split(',');

          if (formatFields.length === 0) continue;
          if (allFields.length < formatFields.length) continue;

          const fieldMap = new Map<string, string>();
          for (let i = 0; i < formatFields.length - 1; i++) {
            fieldMap.set(formatFields[i], allFields[i].trim());
          }
          const textIdx = formatFields.length - 1;
          fieldMap.set(formatFields[textIdx], allFields.slice(textIdx).join(',').trim());

          const startStr = fieldMap.get('start') ?? '';
          const endStr = fieldMap.get('end') ?? '';
          const startTime = parseASSTime(startStr);
          const endTime = parseASSTime(endStr);

          if (startTime < 0 || endTime < 0 || startTime >= endTime) continue;

          const rawText = fieldMap.get('text') ?? '';
          const originalText = stripASSFormatting(rawText);
          const text = stripHtmlTags(originalText).replace(/\n/g, ' ');

          if (!text) continue;

          const id = fieldMap.get('layer') ?? String(cues.length + 1);

          cues.push({ id, startTime, endTime, text, originalText });
        }
      } catch {
        continue;
      }
    }

    return cues;
  } catch {
    return [];
  }
}

export function detectSubtitleFormat(content: string | null | undefined): SubtitleFormat | null {
  if (!content || typeof content !== 'string') return null;

  const cleaned = stripBOM(content).trim();

  if (cleaned.startsWith('[Script Info]') || cleaned.includes('[V4+ Styles]') || cleaned.includes('[V4 Styles]')) {
    return 'ass';
  }

  if (/^\d+\s*\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/m.test(cleaned)) {
    return 'srt';
  }

  if (cleaned.includes('-->') && /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(cleaned)) {
    return 'srt';
  }

  return null;
}

export function parseSubtitle(content: string | null | undefined, format: SubtitleFormat): SubtitleCue[] {
  if (!content) return [];
  if (typeof content !== 'string') return [];
  if (content.trim() === '') return [];

  try {
    if (format === 'srt') return parseSRT(content);
    if (format === 'ass') return parseASS(content);
    return [];
  } catch {
    return [];
  }
}