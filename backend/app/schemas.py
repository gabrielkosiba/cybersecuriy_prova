from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MachineIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    equipment_type: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=160)
    operating_hours: float = Field(ge=0)


class MachineOut(MachineIn):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReadingIn(BaseModel):
    timestamp: datetime
    operating_hours: float = Field(ge=0)
    temperature_c: float | None = None
    vibration_mm_s: float | None = Field(default=None, ge=0)
    noise_db: float | None = Field(default=None, ge=0)
    failure_within_horizon: int | None = Field(default=None, ge=0, le=1)


class ReadingOut(ReadingIn):
    id: int
    machine_id: int
    source: str
    model_config = ConfigDict(from_attributes=True)


class MaintenanceIn(BaseModel):
    machine_id: int = Field(gt=0)
    maintenance_type: str = Field(min_length=2, max_length=80)
    performed_at: datetime
    operating_hours_at_service: float = Field(ge=0)
    description: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=5000)


class MaintenanceOut(MaintenanceIn):
    id: int
    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    model_config = ConfigDict(from_attributes=True)
