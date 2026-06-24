# backend/database.py
import logging
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# engine = create_async_engine(
#     settings.database_url,
#     echo=(settings.environment == "development"),
#     pool_size=10,
#     max_overflow=20,
# )

engine = create_async_engine(
    settings.database_url,
    echo=(settings.environment == "development"),
    pool_size=3,
    max_overflow=2,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """
    Lightweight connectivity probe used by the /ready endpoint.
    Returns True if a `SELECT 1` succeeds, False otherwise — never raises.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:  # noqa: BLE001 — probe must never raise
        logger.warning("DB connectivity check failed: %s", exc)
        return False


async def create_tables():
    """
    Create any tables that don't exist yet AND sync columns for tables
    that already exist (lightweight idempotent column-level migration).

    Note: For production deployments with rich schema changes,
    switch to Alembic migrations (alembic.ini already exists).
    """
    # Import models so SQLAlchemy registers them on the metadata used here.
    # We use the User model's Base (declarative_base instance) so all model
    # tables — User, UserVitals, ChatSession, ChatMessage, MedicalReport —
    # are reflected on it.
    from models.user import Base as ModelsBase  # noqa: F401  (registers tables)

    async with engine.begin() as conn:
        # 1. Create any missing tables (no-op if already there)
        await conn.run_sync(ModelsBase.metadata.create_all)
        # 2. Sync columns on already-existing tables
        await conn.run_sync(_sync_missing_columns, ModelsBase)


def _sync_missing_columns(sync_conn, models_base) -> None:
    """
    For every table declared in the SQLAlchemy metadata that already exists
    in the database, add any column that is missing.  Idempotent.
    """
    insp = inspect(sync_conn)
    existing_tables = set(insp.get_table_names())

    for table in models_base.metadata.sorted_tables:
        if table.name not in existing_tables:
            # create_all will have just created it, so columns are in sync
            continue

        existing_cols = {c["name"] for c in insp.get_columns(table.name)}

        for col in table.columns:
            if col.name in existing_cols:
                continue

            # Build ALTER TABLE … ADD COLUMN statement
            col_type = col.type.compile(dialect=sync_conn.dialect)
            parts = [f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}']

            # Default (Python-side scalar OR server_default)
            default_sql = None
            if col.server_default is not None and getattr(col.server_default, "arg", None) is not None:
                # server_default could be a TextClause or string
                arg = col.server_default.arg
                default_sql = arg.text if hasattr(arg, "text") else str(arg)
            elif col.default is not None and getattr(col.default, "is_scalar", False):
                v = col.default.arg
                if isinstance(v, bool):
                    default_sql = "TRUE" if v else "FALSE"
                elif isinstance(v, (int, float)):
                    default_sql = str(v)
                elif isinstance(v, str):
                    default_sql = "'" + v.replace("'", "''") + "'"

            if default_sql is not None:
                parts.append(f"DEFAULT {default_sql}")

            if not col.nullable:
                # If we don't have a default and the column is NOT NULL,
                # Postgres would reject the ALTER on a non-empty table.
                # Add column nullable first, then enforce NOT NULL.
                if default_sql is None:
                    sql = " ".join(parts)  # nullable add
                    logger.warning(
                        f"[schema-sync] adding {table.name}.{col.name} as NULLABLE "
                        f"(no default available — tighten manually if needed)"
                    )
                    sync_conn.execute(text(sql))
                    continue
                parts.append("NOT NULL")

            sql = " ".join(parts)
            logger.info(f"[schema-sync] {sql}")
            sync_conn.execute(text(sql))

            # Add index if the column was declared with index=True
            if col.index:
                idx_name = f"ix_{table.name}_{col.name}"
                logger.info(f"[schema-sync] CREATE INDEX {idx_name} ON {table.name}({col.name})")
                sync_conn.execute(
                    text(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "{table.name}" ("{col.name}")')
                )
