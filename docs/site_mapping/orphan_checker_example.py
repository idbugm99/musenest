"""
orphan_checker_example.py

Proof-of-concept script that loads the mapping YAML and compares it
against the actual SQLite schema plus admin UI components (optional).

Prerequisites:
    pip install pyyaml
    # sqlite3 available on system

Usage:
    python orphan_checker_example.py /full/path/to/database.sqlite
"""
import sys
import sqlite3
import yaml
from pathlib import Path
import re

TEMPLATE_DIR = Path(__file__).parents[2] / "admin" / "components"
FIELD_PATTERN = re.compile(r"data-(?:field|ct-key)=\"([a-zA-Z0-9_]+)\"")


def load_schema(db_path: str):
    """Return dict {table_name: [column, ...]}"""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cur.fetchall()]
    schema = {}
    for table in tables:
        cur.execute(f"PRAGMA table_info('{table}')")
        schema[table] = [row[1] for row in cur.fetchall()]
    conn.close()
    return schema


def load_mapping(yaml_path: Path):
    return yaml.safe_load(yaml_path.read_text())


def scan_ui_fields(components_dir: Path = TEMPLATE_DIR):
    """Return a set of field/column identifiers referenced in admin templates."""
    ui_fields = set()
    for html_path in components_dir.glob("**/*.html"):
        try:
            text = html_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for match in FIELD_PATTERN.findall(text):
            ui_fields.add(match)
    return ui_fields


def main(db_path: str, mapping_path: Path):
    schema = load_schema(db_path)
    mapping = load_mapping(mapping_path)

    # ---------------- DB Column existence ----------------
    mapping_columns = set()
    missing_columns = []

    for entry in mapping:
        table = entry.get("table")
        column = entry.get("column")
        if table and column:
            mapping_columns.add(column)
            if table not in schema or column not in schema[table]:
                missing_columns.append(f"{table}.{column} referenced by '{entry['field']}'")

    if missing_columns:
        print("\n⚠️  Missing table/columns detected:")
        for item in missing_columns:
            print("  -", item)
    else:
        print("✅ All mapped columns exist in DB.")

    # ---------------- UI ↔ Mapping comparison ----------------
    ui_fields = scan_ui_fields()

    unmapped_ui = sorted(ui_fields - mapping_columns)
    unused_mapping = sorted(mapping_columns - ui_fields)

    if unmapped_ui:
        print("\n⚠️  UI fields with no mapping (add to YAML):")
        for field in unmapped_ui:
            print("  -", field)
    else:
        print("✅ All UI fields are represented in mapping YAML.")

    if unused_mapping:
        print("\nℹ️  Columns in mapping but not found in UI templates (might be backend-only or deprecated):")
        for col in unused_mapping:
            print("  -", col)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python orphan_checker_example.py /full/path/to/database.sqlite")
        sys.exit(1)
    db_file = sys.argv[1]
    yaml_mapping = Path(__file__).with_name("_machine-map.yaml")
    main(db_file, yaml_mapping)
