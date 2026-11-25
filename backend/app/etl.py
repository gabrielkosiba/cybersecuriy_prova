from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Reading


def run_etl(db: Session, output_dir: str = "../../data/processed") -> dict:
    rows = db.scalars(select(Reading).order_by(Reading.timestamp)).all()
    records = [{
        "id": r.id, "machine_id": r.machine_id, "timestamp": r.timestamp,
        "operating_hours": r.operating_hours, "temperature_c": r.temperature_c,
        "vibration_mm_s": r.vibration_mm_s, "noise_db": r.noise_db,
        "failure_within_horizon": r.failure_within_horizon, "source": r.source
    } for r in rows]
    df = pd.DataFrame(records)
    received = len(df)
    if not df.empty:
        before = len(df)
        df = df.drop_duplicates(subset=["machine_id", "timestamp"])
        duplicates = before - len(df)
        # Não imputar variáveis ausentes: preserva ausências para decisão explícita no treino.
        df = df.sort_values(["machine_id", "timestamp"])
    else:
        duplicates = 0
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    target = out / "readings_processed.csv"
    df.to_csv(target, index=False)
    return {"executed_at": datetime.now(UTC).isoformat(), "received": received,
            "processed": len(df), "discarded": duplicates, "corrected": 0,
            "errors": [], "output": str(target)}
