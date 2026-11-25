from datetime import datetime, timezone
from pathlib import Path
import json
import re

import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Reading, ModelRegistry


FEATURES = [
    "operating_hours",
    "temperature_c",
    "vibration_mm_s",
    "noise_db",
]

MIN_READINGS_FOR_PREDICTION = 5
MODEL_VERSION_PREFIX = "automhub-rf-1"


def _next_model_version(db: Session) -> str:
    """Gera uma versão nova para preservar cada execução no histórico."""
    versions = db.scalars(select(ModelRegistry.version)).all()
    highest = 0

    for value in versions:
        match = re.fullmatch(r"automhub-rf-(\d+)", value or "")
        if match:
            highest = max(highest, int(match.group(1)))

    return f"automhub-rf-{highest + 1}"


def train_model(db: Session, model_dir: str) -> dict:
    rows = db.scalars(
        select(Reading)
        .where(Reading.failure_within_horizon.is_not(None))
        .order_by(Reading.timestamp)
    ).all()

    df = pd.DataFrame([
        {
            key: getattr(row, key)
            for key in FEATURES + ["failure_within_horizon"]
        }
        for row in rows
    ]).dropna()

    if len(df) < 20 or df["failure_within_horizon"].nunique() < 2:
        raise ValueError(
            "São necessários ao menos 20 registros completos e duas classes rotuladas."
        )

    X = df[FEATURES]
    y = df["failure_within_horizon"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=150,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)

    metrics = {
        "precision": precision_score(y_test, pred, zero_division=0),
        "recall": recall_score(y_test, pred, zero_division=0),
        "f1": f1_score(y_test, pred, zero_division=0),
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
        "test_samples": len(y_test),
        "training_samples": len(y_train),
    }

    # Cada treinamento recebe uma versão própria para compor o histórico.
    version = _next_model_version(db)

    path = Path(model_dir)
    path.mkdir(parents=True, exist_ok=True)
    artifact = path / f"{version}.joblib"

    joblib.dump(
        {
            "model": model,
            "features": FEATURES,
            "version": version,
        },
        artifact,
    )

    registry = ModelRegistry(
        version=version,
        available=True,
        metrics_json=json.dumps(metrics),
        artifact_path=str(artifact),
        trained_at=datetime.now(timezone.utc),
    )
    db.add(registry)

    try:
        db.commit()
        db.refresh(registry)
    except Exception:
        db.rollback()
        raise

    return {
        "version": version,
        "trained_at": registry.trained_at,
        "metrics": metrics,
        "artifact": str(artifact),
    }


def predict(
    db: Session,
    readings: list[Reading],
    model_dir: str,
) -> tuple[float, str]:
    complete_readings = [
        reading
        for reading in readings
        if all(getattr(reading, feature) is not None for feature in FEATURES)
    ]

    if len(complete_readings) < MIN_READINGS_FOR_PREDICTION:
        raise ValueError(
            f"São necessárias pelo menos {MIN_READINGS_FOR_PREDICTION} "
            f"leituras completas para gerar uma previsão. "
            f"Encontradas: {len(complete_readings)}."
        )

    registry = db.scalar(
        select(ModelRegistry)
        .where(ModelRegistry.available.is_(True))
        .order_by(ModelRegistry.id.desc())
    )
    if not registry:
        raise ValueError("Modelo treinado indisponível.")

    latest = max(readings, key=lambda reading: reading.timestamp)
    values = {feature: getattr(latest, feature) for feature in FEATURES}

    if any(value is None for value in values.values()):
        raise ValueError(
            "A leitura mais recente não contém todas as variáveis exigidas."
        )

    bundle = joblib.load(registry.artifact_path)
    probability = float(
        bundle["model"].predict_proba(pd.DataFrame([values]))[0][1]
    )

    risk = (
        "elevado" if probability >= 0.7
        else "moderado" if probability >= 0.4
        else "baixo"
    )

    return probability, risk
