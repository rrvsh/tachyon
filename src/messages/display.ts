import type { MessageRecord } from "../data/schema";

export interface DisplayMessage {
  thinkingText: string;
  visibleContent: string;
}

type ReasoningDetail = {
  type?: string;
  text?: string;
  summary?: string;
};

const THINKING_TAGS: Array<{ open: RegExp; close: RegExp }> = [
  { open: /<think(?::[^>\s]+)?>/i, close: /<\/think(?::[^>\s]+)?>/i },
  { open: /<thinking>/i, close: /<\/thinking>/i },
  { open: /<reason>/i, close: /<\/reason>/i },
  { open: /<reasoning>/i, close: /<\/reasoning>/i },
  { open: /<thought>/i, close: /<\/thought>/i },
  { open: /<\|begin_of_thought\|>/i, close: /<\|end_of_thought\|>/i },
];

export function normalizeMessageForDisplay(
  message: MessageRecord,
): DisplayMessage {
  const inline = extractInlineThinking(message.content, !message.finalized);
  const detailText = extractReasoningDetails(message.reasoningDetails).join("");
  const thinkingParts = uniqueThinkingParts(
    [message.reasoning, detailText, ...inline.thinking].filter(
      (part): part is string => !!part?.trim(),
    ),
  );
  return {
    thinkingText: thinkingParts.join("\n\n---\n\n"),
    visibleContent: inline.visibleContent.trimStart(),
  };
}

export function extractReasoningDetails(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((detail) => {
    if (!detail || typeof detail !== "object") return [];
    const typed = detail as ReasoningDetail;
    if (typed.type === "reasoning.encrypted") return [];
    if (typeof typed.text === "string") return [typed.text];
    if (typeof typed.summary === "string") return [typed.summary];
    return [];
  });
}

export function extractInlineThinking(
  content: string,
  allowPartial = false,
): { thinking: string[]; visibleContent: string } {
  const thinking: string[] = [];
  let visibleContent = "";
  let cursor = 0;

  while (cursor < content.length) {
    const next = findNextOpenTag(content, cursor);
    if (!next) {
      visibleContent += content.slice(cursor);
      break;
    }

    visibleContent += content.slice(cursor, next.start);
    const afterOpen = next.end;
    const close = findCloseTag(content, afterOpen, next.tag.close);
    if (!close) {
      if (allowPartial) {
        thinking.push(content.slice(afterOpen));
        cursor = content.length;
      } else {
        visibleContent += content.slice(next.start);
        cursor = content.length;
      }
      break;
    }

    thinking.push(content.slice(afterOpen, close.start));
    cursor = close.end;
  }

  return { thinking, visibleContent };
}

function uniqueThinkingParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.trim().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique;
}

function findNextOpenTag(
  content: string,
  offset: number,
): { start: number; end: number; tag: { open: RegExp; close: RegExp } } | null {
  let best: {
    start: number;
    end: number;
    tag: { open: RegExp; close: RegExp };
  } | null = null;
  for (const tag of THINKING_TAGS) {
    tag.open.lastIndex = 0;
    const match = tag.open.exec(content.slice(offset));
    if (!match?.index && match?.index !== 0) continue;
    const start = offset + match.index;
    const end = start + match[0].length;
    if (!best || start < best.start) best = { start, end, tag };
  }
  return best;
}

function findCloseTag(
  content: string,
  offset: number,
  closeTag: RegExp,
): { start: number; end: number } | null {
  closeTag.lastIndex = 0;
  const match = closeTag.exec(content.slice(offset));
  if (!match) return null;
  const start = offset + match.index;
  return { start, end: start + match[0].length };
}
