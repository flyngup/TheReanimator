#!/usr/bin/env python3
"""
DeepL Auto-Translation Script for TheReanimator-i18n

Translates new keys from German (de.json) to other languages (en, ru, etc.)
"""
import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌ Error: requests module not found")
    print("   Run: pip install requests")
    sys.exit(1)

# Configuration
DEEPL_API_KEY = os.environ.get("DEEPL_API_KEY")
if not DEEPL_API_KEY:
    print("❌ Error: DEEPL_API_KEY environment variable not set")
    print("   Set it in GitHub Secrets: DEEPL_API_KEY")
    sys.exit(1)

DEEPL_URL = "https://api-free.deepl.com/v2/translate"
SRC_LANG = "DE"  # German - source language
TARGET_LANGS = {
    "EN": "en",
    "RU": "ru",
    # Add more languages here: ES (Spanish), FR (French), etc.
}
LOCALES_DIR = Path("src/messages")

def get_all_namespaces():
    """Get all JSON files - using flat structure (de.json, en.json, ru.json)"""
    if not (LOCALES_DIR / "de.json").exists():
        print(f"❌ Error: File {LOCALES_DIR / 'de.json'} not found")
        return []

    # Flat structure - single file per language
    return ["messages"]

def translate_text(text: str, target_lang: str) -> str:
    """Translate text using DeepL API"""
    if not text.strip():
        return text

    # Skip if already contains HTML/React placeholders
    if text.startswith("__") and text.endswith("__"):
        return text

    try:
        response = requests.post(
            DEEPL_URL,
            headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
            data={
                "text": text,
                "source_lang": SRC_LANG,
                "target_lang": target_lang,
                "tag_handling": "xml",
                "preserve_formatting": True
            },
            timeout=10
        )
        response.raise_for_status()
        return response.json()["translations"][0]["text"]
    except Exception as e:
        print(f"      ❌ Translation error: {e}")
        return text  # Return original on error

def main():
    print("🌍 Starting DeepL Auto-Translation...")
    print(f"   Source: German (de.json)")
    print(f"   Targets: {', '.join(TARGET_LANGS.values())}")
    print()

    namespaces = get_all_namespaces()
    if not namespaces:
        print("❌ No namespaces found")
        return

    total_translations = 0

    for ns in namespaces:
        src_file = LOCALES_DIR / "de.json"

        if not src_file.exists():
            print(f"⚠️  Skipping {ns} - source file not found")
            continue

        with open(src_file, encoding="utf-8") as f:
            src_data = json.load(f)

        print(f"📦 Processing: {src_file}")
        print(f"   Total namespaces: {len(src_data)}")

        for dl_lang, lang_code in TARGET_LANGS.items():
            target_file = LOCALES_DIR / f"{lang_code}.json"

            # Load existing translations
            try:
                with open(target_file, encoding="utf-8") as f:
                    target_data = json.load(f)
            except:
                target_data = {}

            # Find missing keys recursively in nested structure
            def find_missing_keys(src_obj, tgt_obj, path=""):
                missing = []
                if isinstance(src_obj, dict):
                    for key, value in src_obj.items():
                        current_path = f"{path}.{key}" if path else key
                        if isinstance(value, (str, int, float, bool)):
                            if key not in tgt_obj or not tgt_obj[key]:
                                missing.append((current_path, key, value, path, tgt_obj))
                        elif isinstance(value, dict):
                            tgt_child = tgt_obj.get(key, {}) if isinstance(tgt_obj, dict) else {}
                            missing.extend(find_missing_keys(value, tgt_child, current_path))
                return missing

            missing_items = find_missing_keys(src_data, target_data)

            if not missing_items:
                print(f"   {lang_code}: ✅ All keys present")
                continue

            print(f"   {lang_code}: Translating {len(missing_items)} missing keys")

            # Translate and insert missing keys
            for full_path, key, value, parent_path, parent_obj in missing_items:
                translated = translate_text(str(value), dl_lang)

                # Build nested structure and set value
                if parent_path:
                    parts = parent_path.split('.')
                    current = target_data
                    for part in parts:
                        if part not in current:
                            current[part] = {}
                        if not isinstance(current[part], dict):
                            current[part] = {}
                        current = current[part]
                    current[key] = translated
                else:
                    target_data[key] = translated

                print(f"      ✓ {full_path}")
                total_translations += 1

            # Save updated translations
            with open(target_file, "w", encoding="utf-8") as f:
                json.dump(target_data, f, ensure_ascii=False, indent=2)

            print(f"   {lang_code}: ✅ Saved translations")

        print()

    print(f"✅ Translation complete!")
    print(f"   Total translations: {total_translations}")
    print(f"   DeepL quota used: ~{total_translations} requests")

if __name__ == "__main__":
    main()
