const fs = require("fs");
const path = require("path");

const pagesDir = path.join(__dirname, "src", "Pages");
const localesDir = path.join(__dirname, "src", "i18n", "locales");

const localeFiles = ["sq.json", "en.json", "de.json"];

function walk(dir) {
  let files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files = files.concat(walk(fullPath));
    } else if (entry.isFile() && fullPath.endsWith(".jsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function flattenKeys(obj, prefix = "") {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

const jsxFiles = walk(pagesDir);

const usedKeys = new Set();

const translationRegex = /\bt\(\s*["'`]([^"'`$]+)["'`]\s*(?:,|\))/g;

for (const file of jsxFiles) {
  const content = fs.readFileSync(file, "utf8");

  let match;

  while ((match = translationRegex.exec(content)) !== null) {
    usedKeys.add(match[1]);
  }
}

console.log(`\nTranslation keys used in JSX: ${usedKeys.size}\n`);

for (const localeFile of localeFiles) {
  const localePath = path.join(localesDir, localeFile);

  if (!fs.existsSync(localePath)) {
    console.log(`❌ Missing file: ${localeFile}`);
    continue;
  }

  const translations = JSON.parse(fs.readFileSync(localePath, "utf8"));
  const availableKeys = new Set(flattenKeys(translations));

  const missingKeys = [...usedKeys].filter((key) => !availableKeys.has(key));

  console.log(`=== ${localeFile} ===`);

  if (missingKeys.length === 0) {
    console.log("✅ No missing translation keys.\n");
  } else {
    console.log(`❌ Missing ${missingKeys.length} keys:`);

    for (const key of missingKeys) {
      console.log(`  - ${key}`);
    }

    console.log();
  }
}
