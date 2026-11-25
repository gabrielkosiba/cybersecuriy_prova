from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    if not db.query(User).filter_by(email="admin@automhub.local").first():
        db.add(
            User(
                name="Administrador",
                email="admin@automhub.local",
                password_hash=hash_password("ChangeMe123!"),
                role="admin",
            )
        )
        db.commit()
        print("Usuário de desenvolvimento criado.")
    else:
        print("Usuário já existe.")
finally:
    db.close()
