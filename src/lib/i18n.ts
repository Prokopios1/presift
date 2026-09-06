import en from '../locales/en.json';
import gr from '../locales/gr.json';

export type Language = 'en' | 'gr';

type Translations = Record<string, string>;

export const dictionaries: Record<Language, Translations> = {
  en,
  gr
};

export function getTranslation(lang: Language, key: string, fallback?: string): string {
  const dictionary = dictionaries[lang] || dictionaries['gr'];
  // We cast key to any or keyof typeof dictionary since TS cannot infer all strings are valid keys.
  return (dictionary as any)[key] || fallback || key;
}
