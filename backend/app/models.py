from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def now_utc():
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="tecnico")


class Machine(Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    equipment_type: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(160))
    operating_hours: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    readings = relationship("Reading", back_populates="machine", cascade="all, delete-orphan")


class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    operating_hours: Mapped[float] = mapped_column(Float)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    vibration_mm_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    noise_db: Mapped[float | None] = mapped_column(Float, nullable=True)
    failure_within_horizon: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="api")
    machine = relationship("Machine", back_populates="readings")


class Maintenance(Base):
    __tablename__ = "maintenances"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    maintenance_type: Mapped[str] = mapped_column(String(80))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Horímetro da máquina no momento em que a manutenção foi realizada.
    # Nullable para manter compatibilidade com registros antigos.
    operating_hours_at_service: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    probability: Mapped[float] = mapped_column(Float)
    risk: Mapped[str] = mapped_column(String(20))
    horizon: Mapped[str] = mapped_column(String(80))
    model_version: Mapped[str] = mapped_column(String(80))


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(80), unique=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    artifact_path: Mapped[str] = mapped_column(String(500))
