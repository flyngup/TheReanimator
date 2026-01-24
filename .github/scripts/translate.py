import json
import os
import requests
from pathlib import Path

DEEPL_API_KEY = os.environ.get("DEEPL_API_KEY", "")
DEEPL_URL = "https://api-free.deepl.com/v2/translate"
SRC_LANG = "DE"  # German - base language
TARGET_LANGS = ["EN", "RU"]  # English, Russian
LOCALES_DIR = Path("src/messages")

def translate_text(text, target_lang):
    """Translate text using DeepL API."""
    if not text or not text.strip():
        return text

    headers = {
        "Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"
    }

    data = {
        "text": text,
        "source_lang": SRC_LANG,
        "target_lang": target_lang,
        "tag_handling": "xml"
    }

    try:
        resp = requests.post(DEEPL_URL, headers=headers, data=data, timeout=30)
        resp.raise_for_status()
        return resp.json()["translations"][0]["text"]
    except requests.exceptions.RequestException as e:
        print(f"    ✗ Translation error: {e}")
        return None

def load_json_file(file_path):
    """Load JSON file if it exists."""
    if file_path.exists():
        with open(file_path, encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_json_file(file_path, data):
    """Save JSON file with proper formatting."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def flatten_keys(d, parent_key='', sep='.'):
    """Flatten nested dictionary."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_keys(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def unflatten_keys(d, sep='.'):
    """Unflatten dictionary."""
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        d = result
        for part in parts[:-1]:
            if part not in d:
                d[part] = {}
            d = d[part]
        d[parts[-1]] = value
    return result

def main():
    print("🌍 Starting DeepL translation...")

    if not DEEPL_API_KEY:
        print("❌ DEEPL_API_KEY environment variable not set!")
        return

    # Load German (source) translations
    de_file = LOCALES_DIR / "de.json"
    if not de_file.exists():
        print(f"❌ Source file {de_file} not found!")
        return

    with open(de_file, encoding="utf-8") as f:
        de_data = json.load(f)

    print(f"📦 Loaded German translations: {len(flatten_keys(de_data))} keys")

    # Process each target language
    for dl_lang in TARGET_LANGS:
        lang_code = dl_lang.lower()
        target_file = LOCALES_DIR / f"{lang_code}.json"

        print(f"\n🌐 Processing {lang_code.upper()}...")

        # Load existing translations
        target_data = load_json_file(target_file)
        target_flat = flatten_keys(target_data)
        de_flat = flatten_keys(de_data)

        # Find missing or empty keys
        missing_keys = [
            (key, text)
            for key, text in de_flat.items()
            if key not in target_flat or not target_flat[key]
        ]

        if not missing_keys:
            print(f"   ✅ All {len(de_flat)} keys present")
            continue

        print(f"   📝 Translating {len(missing_keys)} missing keys")

        # Translate missing keys
        translated_count = 0
        for key, text in missing_keys:
            translated = translate_text(text, dl_lang)
            if translated:
                target_flat[key] = translated
                translated_count += 1
                print(f"      ✓ {key}")

        # Save updated translations
        target_data = unflatten_keys(target_flat)
        save_json_file(target_file, target_data)
        print(f"   💾 Saved {translated_count} translations to {lang_code}.json")

    print("\n✅ Translation complete!")

if __name__ == "__main__":
    main()
