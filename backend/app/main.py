import json
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.etl import run_etl
from app.ml import predict, train_model
from app.models import Machine, Maintenance, ModelRegistry, Prediction, Reading, User
from app.schemas import (
    LoginIn,
    MachineIn,
    MachineOut,
    MaintenanceIn,
    MaintenanceOut,
    ReadingIn,
    ReadingOut,
    TokenOut,
)
from app.security import admin_user, create_token, current_user, verify_password
from app.services import add_reading, create_machine

# Intervalo global inicial para demonstração.
MAINTENANCE_INTERVAL_HOURS = 500.0
MAINTENANCE_WARNING_HOURS = 50.0


Base.metadata.create_all(bind=engine)


def ensure_maintenance_migration():
    """Adiciona a nova coluna sem apagar ou recriar o banco SQLite existente."""
    inspector = inspect(engine)
    if "maintenances" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("maintenances")
    }
    if "operating_hours_at_service" not in existing_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE maintenances "
                    "ADD COLUMN operating_hours_at_service FLOAT"
                )
            )


ensure_maintenance_migration()


app = FastAPI(
    title="Autom Hub API",
    version="0.1.0",
    description="API de manutenção preditiva",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

etl_status = {"status": "nunca executado"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    return {"access_token": create_token(user)}


@app.get("/auth/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}


@app.post("/maquinas", response_model=MachineOut)
def post_machine(data: MachineIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return create_machine(db, data)


@app.get("/maquinas", response_model=list[MachineOut])
def list_machines(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Machine).order_by(Machine.id.desc())).all()


@app.get("/maquinas/{machine_id}", response_model=MachineOut)
def get_machine(machine_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    obj = db.get(Machine, machine_id)
    if not obj:
        raise HTTPException(404, "Máquina não encontrada")
    return obj


@app.put("/maquinas/{machine_id}", response_model=MachineOut)
def update_machine(
    machine_id: int,
    data: MachineIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    obj = db.get(Machine, machine_id)
    if not obj:
        raise HTTPException(404, "Máquina não encontrada")
    for key, value in data.model_dump().items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/maquinas/{machine_id}")
def delete_machine(machine_id: int, db: Session = Depends(get_db), user: User = Depends(admin_user)):
    obj = db.get(Machine, machine_id)
    if not obj:
        raise HTTPException(404, "Máquina não encontrada")
    db.delete(obj)
    db.commit()
    return {"message": "Máquina removida"}


@app.post("/maquinas/{machine_id}/leituras", response_model=ReadingOut)
def post_reading(
    machine_id: int,
    data: ReadingIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return add_reading(db, machine_id, data)


@app.get("/leituras_etl", response_model=list[ReadingOut])
def list_readings(
    maquina_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = select(Reading).order_by(Reading.timestamp.desc())
    if maquina_id is not None:
        stmt = stmt.where(Reading.machine_id == maquina_id)
    return db.scalars(stmt.limit(1000)).all()


@app.get("/leituras_etl/{reading_id}", response_model=ReadingOut)
def get_reading(reading_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    obj = db.get(Reading, reading_id)
    if not obj:
        raise HTTPException(404, "Leitura não encontrada")
    return obj


@app.get("/manutencao/configuracao")
def maintenance_configuration(user: User = Depends(current_user)):
    return {
        "interval_hours": MAINTENANCE_INTERVAL_HOURS,
        "warning_hours": MAINTENANCE_WARNING_HOURS,
        "scope": "global",
        "description": "Intervalo padrão global para manutenção preventiva.",
    }


@app.post("/manutencoes", response_model=MaintenanceOut)
def create_maintenance(
    data: MaintenanceIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    machine = db.get(Machine, data.machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina não encontrada")

    maintenance = Maintenance(**data.model_dump())
    db.add(maintenance)
    db.commit()
    db.refresh(maintenance)
    return maintenance


@app.get("/manutencoes", response_model=list[MaintenanceOut])
def list_maintenances(
    maquina_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = select(Maintenance).order_by(
        Maintenance.performed_at.desc(), Maintenance.id.desc()
    )
    if maquina_id is not None:
        stmt = stmt.where(Maintenance.machine_id == maquina_id)
    return db.scalars(stmt.limit(1000)).all()


@app.get("/manutencao/planejamento")
def maintenance_planning(
    maquina_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Retorna o cálculo preventivo de uma máquina ou de toda a frota."""
    machine_stmt = select(Machine).order_by(Machine.id.asc())
    if maquina_id is not None:
        machine_stmt = machine_stmt.where(Machine.id == maquina_id)

    machines = db.scalars(machine_stmt).all()
    if maquina_id is not None and not machines:
        raise HTTPException(status_code=404, detail="Máquina não encontrada")

    results = []

    for machine in machines:
        latest_reading = db.scalar(
            select(Reading)
            .where(Reading.machine_id == machine.id)
            .order_by(Reading.timestamp.desc(), Reading.id.desc())
            .limit(1)
        )

        current_hours = (
            latest_reading.operating_hours
            if latest_reading is not None
            else machine.operating_hours
        )

        # Integra a estimativa do Random Forest sem impedir o planejamento
        # preventivo quando ainda não há dados/modelo suficientes.
        machine_readings = db.scalars(
            select(Reading).where(Reading.machine_id == machine.id)
        ).all()

        ai_probability = None
        ai_risk = None
        ai_message = "Previsão de IA indisponível."
        try:
            ai_probability, ai_risk = predict(
                db, machine_readings, settings.model_dir
            )
            ai_message = {
                "elevado": "Risco elevado estimado pela IA. Recomenda-se inspeção antecipada.",
                "moderado": "Risco moderado estimado pela IA. Recomenda-se acompanhar os sensores.",
                "baixo": "Risco baixo estimado pela IA. Mantenha o acompanhamento preventivo.",
            }.get(ai_risk, "Acompanhe as condições operacionais.")
        except (ValueError, FileNotFoundError):
            # Falta de leituras ou de modelo treinado não invalida o cálculo
            # baseado no intervalo de manutenção.
            pass

        last_maintenance = db.scalar(
            select(Maintenance)
            .where(Maintenance.machine_id == machine.id)
            .order_by(Maintenance.performed_at.desc(), Maintenance.id.desc())
            .limit(1)
        )

        base = {
            "machine_id": machine.id,
            "machine_name": machine.name,
            "current_operating_hours": current_hours,
            "maintenance_interval_hours": MAINTENANCE_INTERVAL_HOURS,
            "warning_hours": MAINTENANCE_WARNING_HOURS,
            "ai_probability": (
                round(ai_probability, 4) if ai_probability is not None else None
            ),
            "ai_probability_percent": (
                round(ai_probability * 100, 2)
                if ai_probability is not None else None
            ),
            "ai_risk": ai_risk,
            "ai_message": ai_message,
        }

        if last_maintenance is None:
            results.append({
                **base,
                "status": "sem_historico",
                "status_label": "Sem manutenção registrada",
                "message": "Registre a última manutenção e o horímetro correspondente para iniciar o planejamento.",
                "last_maintenance_id": None,
                "last_maintenance_at": None,
                "last_maintenance_operating_hours": None,
                "hours_since_maintenance": None,
                "next_maintenance_at_hours": None,
                "hours_remaining": None,
                "progress_percent": None,
                "recommendation": ai_message,
            })
            continue

        baseline_hours = last_maintenance.operating_hours_at_service

        if baseline_hours is None:
            results.append({
                **base,
                "status": "sem_horimetro_historico",
                "status_label": "Horímetro não informado",
                "message": "A última manutenção não possui horímetro registrado. Registre uma nova manutenção com o horímetro atual para iniciar o cálculo.",
                "last_maintenance_id": last_maintenance.id,
                "last_maintenance_at": last_maintenance.performed_at,
                "last_maintenance_operating_hours": None,
                "hours_since_maintenance": None,
                "next_maintenance_at_hours": None,
                "hours_remaining": None,
                "progress_percent": None,
                "recommendation": ai_message,
            })
            continue

        elapsed_hours = current_hours - baseline_hours

        if elapsed_hours < 0:
            results.append({
                **base,
                "status": "horimetro_inconsistente",
                "status_label": "Verificar horímetro",
                "message": "O horímetro atual é menor que o registrado na última manutenção. Confira os dados antes de usar o planejamento.",
                "last_maintenance_id": last_maintenance.id,
                "last_maintenance_at": last_maintenance.performed_at,
                "last_maintenance_operating_hours": baseline_hours,
                "hours_since_maintenance": elapsed_hours,
                "next_maintenance_at_hours": baseline_hours + MAINTENANCE_INTERVAL_HOURS,
                "hours_remaining": None,
                "progress_percent": None,
                "recommendation": ai_message,
            })
            continue

        hours_remaining = max(MAINTENANCE_INTERVAL_HOURS - elapsed_hours, 0.0)
        progress = min(
            (elapsed_hours / MAINTENANCE_INTERVAL_HOURS) * 100,
            100.0,
        )

        if elapsed_hours >= MAINTENANCE_INTERVAL_HOURS:
            status = "vencida"
            status_label = "Manutenção vencida"
            message = "O intervalo preventivo foi atingido ou ultrapassado."
        elif hours_remaining <= MAINTENANCE_WARNING_HOURS:
            status = "atencao"
            status_label = "Atenção"
            message = "A manutenção preventiva está próxima."
        else:
            status = "em_dia"
            status_label = "Em dia"
            message = "A máquina está dentro do intervalo preventivo."

        results.append({
            **base,
            "status": status,
            "status_label": status_label,
            "message": message,
            "last_maintenance_id": last_maintenance.id,
            "last_maintenance_at": last_maintenance.performed_at,
            "last_maintenance_operating_hours": baseline_hours,
            "hours_since_maintenance": round(elapsed_hours, 2),
            "next_maintenance_at_hours": round(
                baseline_hours + MAINTENANCE_INTERVAL_HOURS, 2
            ),
            "hours_remaining": round(hours_remaining, 2),
            "progress_percent": round(progress, 2),
            "recommendation": (
                "Priorize uma inspeção antecipada devido ao risco elevado estimado pela IA."
                if ai_risk == "elevado"
                else "Acompanhe os sensores e programe a manutenção preventiva."
                if ai_risk == "moderado"
                else "Siga o planejamento preventivo por horas de operação."
            ),
        })

    return {
        "interval_hours": MAINTENANCE_INTERVAL_HOURS,
        "warning_hours": MAINTENANCE_WARNING_HOURS,
        "machines_count": len(results),
        "planning": results,
    }


@app.post("/etl/executar")
def execute_etl(db: Session = Depends(get_db), user: User = Depends(admin_user)):
    global etl_status
    etl_status = run_etl(
        db,
        str(Path(__file__).resolve().parents[2] / "../data/processed"),
    )
    return etl_status


@app.get("/etl/status")
def get_etl_status(user: User = Depends(current_user)):
    return etl_status


@app.post("/modelo/treinar")
def train(db: Session = Depends(get_db), user: User = Depends(admin_user)):
    try:
        return train_model(db, settings.model_dir)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.get("/modelo/status")
def model_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    obj = db.scalar(select(ModelRegistry).order_by(ModelRegistry.id.desc()))
    if not obj:
        return {"available": False, "version": None, "trained_at": None}
    return {
        "available": obj.available,
        "version": obj.version,
        "trained_at": obj.trained_at,
    }


@app.get("/modelo/metricas")
def model_metrics(db: Session = Depends(get_db), user: User = Depends(current_user)):
    obj = db.scalar(select(ModelRegistry).order_by(ModelRegistry.id.desc()))
    if not obj:
        return {"available": False, "metrics": None}
    return {
        "available": True,
        "version": obj.version,
        "trained_at": obj.trained_at,
        "metrics": json.loads(obj.metrics_json),
    }


@app.get("/modelo/historico")
def model_history(db: Session = Depends(get_db), user: User = Depends(current_user)):
    records = db.scalars(
        select(ModelRegistry).order_by(ModelRegistry.trained_at.desc(), ModelRegistry.id.desc())
    ).all()

    return [
        {
            "id": item.id,
            "version": item.version,
            "trained_at": item.trained_at,
            "available": item.available,
            "metrics": json.loads(item.metrics_json or "{}"),
        }
        for item in records
    ]


@app.post("/maquinas/{machine_id}/previsoes")
def make_prediction(
    machine_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    machine = db.get(Machine, machine_id)
    if not machine:
        raise HTTPException(404, "Máquina não encontrada")

    readings = db.scalars(
        select(Reading).where(Reading.machine_id == machine_id)
    ).all()

    try:
        probability, risk = predict(db, readings, settings.model_dir)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(422, str(exc))

    registry = db.scalar(
        select(ModelRegistry)
        .where(ModelRegistry.available.is_(True))
        .order_by(ModelRegistry.id.desc())
    )
    if not registry:
        raise HTTPException(422, "Modelo treinado indisponível.")

    obj = Prediction(
        machine_id=machine_id,
        probability=probability,
        risk=risk,
        horizon="Horizonte definido pelo conjunto rotulado",
        model_version=registry.version,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)

    return {
        "id": obj.id,
        "machine_id": machine_id,
        "probability": probability,
        "risk": risk,
        "horizon": obj.horizon,
        "model_version": obj.model_version,
        "note": "Risco estimado, não confirmação de falha.",
    }


@app.get("/previsoes")
def list_predictions(
    maquina_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    stmt = select(Prediction).order_by(Prediction.created_at.desc())
    if maquina_id is not None:
        stmt = stmt.where(Prediction.machine_id == maquina_id)
    return db.scalars(stmt.limit(500)).all()


@app.get("/previsoes/{prediction_id}")
def get_prediction(
    prediction_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    obj = db.get(Prediction, prediction_id)
    if not obj:
        raise HTTPException(404, "Previsão não encontrada")
    return obj


@app.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {
        "machines": db.scalar(select(func.count(Machine.id))) or 0,
        "readings": db.scalar(select(func.count(Reading.id))) or 0,
        "high_risk": db.scalar(
            select(func.count(Prediction.id)).where(Prediction.risk == "elevado")
        ) or 0,
        "predictions": db.scalar(select(func.count(Prediction.id))) or 0,
    }
