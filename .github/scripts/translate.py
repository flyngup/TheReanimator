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
    """Get all JSON files from de directory (source of truth)"""
    de_dir = LOCALES_DIR / "de"
    if not de_dir.exists():
        print(f"❌ Error: Directory {de_dir} not found")
        return []

    return [f.stem for f in de_dir.glob("*.json") if f.is_file()]

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
                "preserve_formating": True
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
        src_file = LOCALES_DIR / "de" / f"{ns}.json"

        if not src_file.exists():
            print(f"⚠️  Skipping {ns} - source file not found")
            continue

        with open(src_file, encoding="utf-8") as f:
            src_data = json.load(f)

        print(f"📦 Processing namespace: {ns}")
        print(f"   Keys: {len(src_data)}")

        for dl_lang, lang_code in TARGET_LANGS.items():
            target_file = LOCALES_DIR / lang_code / f"{ns}.json"

            # Load existing translations
            try:
                with open(target_file, encoding="utf-8") as f:
                    target_data = json.load(f)
            except:
                target_data = {}

            # Find missing keys
            missing_keys = [
                (key, text)
                for key, text in src_data.items()
                if key not in target_data or not target_data[key]
            ]

            if not missing_keys:
                print(f"   {lang_code}: ✅ All keys present")
                continue

            print(f"   {lang_code}: Translating {len(missing_keys)} missing keys")

            # Translate missing keys
            for key, text in missing_keys:
                translated = translate_text(text, dl_lang)
                target_data[key] = translated
                print(f"      ✓ {key}: {text[:30]}...")
                total_translations += 1

            # Save updated translations
            target_file.parent.mkdir(parents=True, exist_ok=True)
            with open(target_file, "w", encoding="utf-8") as f:
                json.dump(target_data, f, ensure_ascii=False, indent=2)

            print(f"   {lang_code}: ✅ Saved {len(target_data)} keys")

        print()

    print(f"✅ Translation complete!")
    print(f"   Total translations: {total_translations}")
    print(f"   DeepL quota used: ~{total_translations} requests")

if __name__ == "__main__":
    main()
