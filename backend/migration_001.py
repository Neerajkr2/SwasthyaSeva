#!/usr/bin/env python3
"""
migration_001.py  — Run ONCE to fix the database schema.

Fixes:
  1. Widens users.photo_url from VARCHAR(512) to TEXT
     (root cause of the 500 error on profile photo upload)
  2. Adds users.role TEXT DEFAULT 'user'
     (enables admin vs user access control)
  3. Adds medical_reports.file_data TEXT
     (stores base64-encoded file so users can download their reports)
  4. Creates an index on users.role for fast admin queries

Usage:
  cd backend
  venv\\Scripts\\activate        (Windows)
  source venv/bin/activate     (macOS / Linux)
  python migration_001.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://swasthya:password123@localhost:5432/swasthyaseva",
)

STEPS = [
    (
        "1. Widen photo_url to TEXT (fixes profile photo 500 error)",
        """
        DO $body$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE  table_name  = 'users'
                AND    column_name = 'photo_url'
                AND    character_maximum_length IS NOT NULL
            ) THEN
                ALTER TABLE users ALTER COLUMN photo_url TYPE TEXT;
                RAISE NOTICE 'photo_url widened to TEXT';
            ELSE
                RAISE NOTICE 'photo_url is already TEXT - skipping';
            END IF;
        END
        $body$;
        """,
    ),
    (
        "2. Add users.role column",
        """
        DO $body$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE  table_name  = 'users'
                AND    column_name = 'role'
            ) THEN
                ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
                RAISE NOTICE 'role column added';
            ELSE
                RAISE NOTICE 'role column already exists - skipping';
            END IF;
        END
        $body$;
        """,
    ),
    (
        "3. Add medical_reports.file_data column",
        """
        DO $body$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE  table_name  = 'medical_reports'
                AND    column_name = 'file_data'
            ) THEN
                ALTER TABLE medical_reports ADD COLUMN file_data TEXT;
                RAISE NOTICE 'file_data column added';
            ELSE
                RAISE NOTICE 'file_data column already exists - skipping';
            END IF;
        END
        $body$;
        """,
    ),
    (
        "4. Create index on users.role",
        "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);",
    ),
]


async def run() -> None:
    print(f"\nConnecting to: {DATABASE_URL.split('@')[-1]}")
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        for label, sql in STEPS:
            print(f"\n  {label}")
            await conn.execute(text(sql))
            print("     OK")

    await engine.dispose()
    print("\n  All migrations applied successfully!")
    print("\n  Next steps:")
    print("  1. Restart: uvicorn main:app --reload --port 8000")
    print("  2. Promote yourself to admin (see instructions below)")
    print("\n  To make yourself admin, run in psql:")
    print("    UPDATE users SET role = 'superadmin' WHERE email = 'your@email.com';")


if __name__ == "__main__":
    asyncio.run(run())
