/**
 * Speech Sanitizer & Web Speech Synthesis Pipeline
 * Converts raw Markdown and legal notation into natural conversational speech
 */

// Helper to convert numbers to Indian spoken words
function numberToWords(num: number): string {
  if (num === 0) return "zero";

  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function convertBelowThousand(n: number): string {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    } else if (n > 0) {
      str += ones[n];
    }
    return str.trim();
  }

  let words = "";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore > 0) words += convertBelowThousand(crore) + " crore ";

  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh > 0) words += convertBelowThousand(lakh) + " lakh ";

  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand > 0) words += convertBelowThousand(thousand) + " thousand ";

  const remainder = convertBelowThousand(num);
  if (remainder) words += remainder;

  return words.trim();
}

/**
 * Pre-TTS Speech Sanitization Pipeline
 * 1. Strips Markdown formatting (**, ###, _, backticks, tables)
 * 2. Formats citations: [Cl. 12 (p. 5)] -> "according to Clause 12 on page 5"
 * 3. Normalizes Currency: ₹25,000 -> "twenty-five thousand rupees"
 * 4. Expands legal abbreviations: i.e. -> "that is", w.r.t. -> "with respect to"
 */
export function sanitizeSpeechText(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Citation Phonetics
  // [Clause 12 (Page 5)] or [Cl. 12 (p. 5)]
  cleaned = cleaned.replace(
    /\[(?:Cl\.|Clause)\s*(\d+)\s*(?:\((?:p\.|page)\s*(\d+)\))?\]/gi,
    (_match, clause, page) => {
      if (page) return `according to Clause ${clause} on page ${page}`;
      return `according to Clause ${clause}`;
    }
  );

  // [CLAUSE 12 · P. 5]
  cleaned = cleaned.replace(
    /\[CLAUSE\s*(\d+)(?:\s*·\s*P\.\s*(\d+))?\]/gi,
    (_match, clause, page) => {
      if (page) return `according to Clause ${clause} on page ${page}`;
      return `according to Clause ${clause}`;
    }
  );

  // 2. Currency Normalizer: ₹25,000 -> "twenty-five thousand rupees"
  cleaned = cleaned.replace(/₹\s*([\d,]+(?:\.\d+)?)/g, (_match, amountStr) => {
    const rawNum = parseInt(amountStr.replace(/,/g, ""), 10);
    if (!isNaN(rawNum)) {
      return `${numberToWords(rawNum)} rupees`;
    }
    return `${amountStr} rupees`;
  });

  // 3. Legal & Latin Abbreviations
  cleaned = cleaned.replace(/\bi\.e\./gi, "that is");
  cleaned = cleaned.replace(/\be\.g\./gi, "for example");
  cleaned = cleaned.replace(/\bw\.r\.t\./gi, "with respect to");
  cleaned = cleaned.replace(/\bvs\./gi, "versus");
  cleaned = cleaned.replace(/\betc\./gi, "and so forth");

  // 4. Regex Markdown Stripper
  cleaned = cleaned.replace(/#{1,6}\s+/g, ""); // Headings
  cleaned = cleaned.replace(/\*{1,3}(.*?)\*{1,3}/g, "$1"); // Bold / Italic
  cleaned = cleaned.replace(/_{1,3}(.*?)_{1,3}/g, "$1"); // Underscore emphasis
  cleaned = cleaned.replace(/`{1,3}(.*?)(?:`{1,3}|$)/g, "$1"); // Code
  cleaned = cleaned.replace(/~~(.*?)~~/g, "$1"); // Strikethrough
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, ""); // Bullet points
  cleaned = cleaned.replace(/\|/g, " "); // Table borders
  cleaned = cleaned.replace(/\s+/g, " ").trim(); // Normalise spaces

  return cleaned;
}

export type VoiceStateCallback = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onBoundary?: (charIndex: number, textLength: number) => void;
};

/**
 * Play sanitized text using client-side Web Speech Synthesis API
 */
export function speakSanitizedText(
  rawText: string,
  callbacks?: VoiceStateCallback,
  options?: { rate?: number; pitch?: number; voiceName?: string }
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("Web Speech API is not supported in this browser.");
    return null;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const cleanText = sanitizeSpeechText(rawText);
  const utterance = new SpeechSynthesisUtterance(cleanText);

  utterance.rate = options?.rate ?? 1.0;
  utterance.pitch = options?.pitch ?? 1.0;

  // Pick suitable English voice (preferably en-IN or calm en-US/en-GB)
  const voices = window.speechSynthesis.getVoices();
  const indianVoice = voices.find(
    (v) => v.lang.includes("en-IN") || v.name.includes("India")
  );
  const defaultVoice = voices.find((v) => v.lang.startsWith("en"));
  utterance.voice = indianVoice || defaultVoice || null;

  if (callbacks?.onStart) {
    utterance.onstart = callbacks.onStart;
  }

  if (callbacks?.onEnd) {
    utterance.onend = callbacks.onEnd;
  }

  if (callbacks?.onError) {
    utterance.onerror = callbacks.onError;
  }

  if (callbacks?.onBoundary) {
    utterance.onboundary = (event) => {
      callbacks.onBoundary?.(event.charIndex, event.charLength || 0);
    };
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export default {
  sanitizeSpeechText,
  speakSanitizedText,
  stopSpeaking,
};
