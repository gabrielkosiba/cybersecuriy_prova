from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Machine, Reading


def create_machine(db: Session, data):
    obj = Machine(**data.model_dump())
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def add_reading(db: Session, machine_id: int, data):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina não encontrada")
    duplicate = db.scalar(select(Reading).where(
        Reading.machine_id == machine_id, Reading.timestamp == data.timestamp
    ))
    if duplicate:
        raise HTTPException(status_code=409, detail="Leitura duplicada para este instante")
    if data.operating_hours < machine.operating_hours:
        raise HTTPException(status_code=422, detail="Horas de operação não podem regredir")
    obj = Reading(machine_id=machine_id, **data.model_dump())
    machine.operating_hours = data.operating_hours
    db.add(obj); db.commit(); db.refresh(obj)
    return obj
