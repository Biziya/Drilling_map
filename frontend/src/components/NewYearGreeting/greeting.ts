/**
 * The Data Team's New Year greeting: its text, when it is shown, and whether
 * this browser has already closed it this season.
 */

export type GreetingLanguage = 'mn' | 'en';

export interface GreetingText {
  heading: string;
  /** Paragraphs; each line inside one keeps its own line break. */
  paragraphs: readonly string[];
  closeLabel: string;
}

export const GREETING_SIGNATURE = 'Data Team';

export const GREETING_TEXT: Readonly<Record<GreetingLanguage, GreetingText>> = {
  mn: {
    heading: 'Шинэ оны мэнд хүргэе!',
    paragraphs: [
      'Он солигдож, шинэ жил айлчлан ирж байна.\nЭнэ жил хамтдаа ажилласан та бүхэндээ\nчин сэтгэлээсээ баярлалаа.',
      'Ирэх онд од хийморь тань улам бадарч,\nажилд тань амжилт, гэр бүлд тань\nаз жаргал, амар амгалан үргэлж\nоршихыг хүсье.',
    ],
    closeLabel: 'Баярлалаа',
  },
  en: {
    heading: 'Happy New Year!',
    paragraphs: [
      'The year is turning, and a new one is on its way.\nTo everyone we worked alongside this year:\nthank you, from the heart.',
      'In the year ahead, may your fortune keep rising,\nmay your work bring you success,\nand may your family always have happiness and peace.',
    ],
    closeLabel: 'Thank you',
  },
};

/** The season, inclusive, as [month, day] with January = 1. */
const SEASON_START: readonly [number, number] = [11, 12];
const SEASON_END: readonly [number, number] = [12, 31];

const LANGUAGE_KEY = 'newYearGreeting:language';

/** True from Nov 12 to Dec 31, local time, in any year. */
export function isGreetingSeason(date: Date): boolean {
  const today = (date.getMonth() + 1) * 100 + date.getDate();

  return today >= SEASON_START[0] * 100 + SEASON_START[1]
    && today <= SEASON_END[0] * 100 + SEASON_END[1];
}

/** One key per season, so the greeting comes back next year. */
export function seenKey(date: Date): string {
  return `newYearGreeting:${date.getFullYear()}:seen`;
}

// Storage can be missing or throw (private windows, blocked site data). The
// greeting then simply shows again next time, which is harmless.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: see readStorage.
  }
}

export function hasSeenGreeting(date: Date = new Date()): boolean {
  return readStorage(seenKey(date)) === '1';
}

export function markGreetingSeen(date: Date = new Date()): void {
  writeStorage(seenKey(date), '1');
}

/** Show it on load: in season and not yet closed in this browser. */
export function shouldShowGreeting(date: Date = new Date()): boolean {
  return isGreetingSeason(date) && !hasSeenGreeting(date);
}

export function readGreetingLanguage(): GreetingLanguage {
  return readStorage(LANGUAGE_KEY) === 'en' ? 'en' : 'mn';
}

export function saveGreetingLanguage(language: GreetingLanguage): void {
  writeStorage(LANGUAGE_KEY, language);
}
