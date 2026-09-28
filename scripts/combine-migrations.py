#!/usr/bin/env python3
"""Write a single SQL export from the ordered Supabase migration files."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
OUTPUT = ROOT / "supabase" / "migrations.combined.sql"


def main() -> None:
    files = sorted(MIGRATIONS.glob("*.sql"))
    combined = "\n\n".join(
        f"-- Source migration: {path.name}\n{path.read_text().rstrip()}"
        for path in files
    )
    OUTPUT.write_text(combined + "\n")


if __name__ == "__main__":
    main()
