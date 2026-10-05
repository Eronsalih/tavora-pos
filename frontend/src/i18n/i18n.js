import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import sq from "./locales/sq.json";
import en from "./locales/en.json";
import de from "./locales/de.json";

const savedLanguage = localStorage.getItem("tavora_language");

const supportedLanguages = ["sq", "en", "de"];

// First visit: use the browser language if we support it (sq, en, de),
// otherwise English. After that, the user's own choice is remembered.
const browserLanguage = (navigator.language || "en").slice(0, 2).toLowerCase();

const initialLanguage = supportedLanguages.includes(savedLanguage)
  ? savedLanguage
  : supportedLanguages.includes(browserLanguage)
    ? browserLanguage
    : "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      sq: {
        translation: sq,
      },
      en: {
        translation: en,
      },
      de: {
        translation: de,
      },
    },

    lng: initialLanguage,

    fallbackLng: "en",

    supportedLngs: supportedLanguages,

    load: "languageOnly",

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;