
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

# ==========================================================
# CONFIGURAÇÕES DE SEGURANÇA
# ==========================================================

password_hash = PasswordHash.recommended()

oauth2_scheme = HTTPBearer()


# ==========================================================
# HASH E VERIFICAÇÃO DE SENHAS
# ==========================================================

def hash_password(password: str) -> str:
    """Gera o hash seguro da senha utilizando Argon2."""
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verifica se a senha corresponde ao hash armazenado."""
    return password_hash.verify(password, hashed)


# ==========================================================
# GERAÇÃO DE TOKEN JWT
# ==========================================================

def create_token(user: User) -> str:
    """Gera um token JWT para o usuário autenticado."""

    expiration = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_minutes
    )

    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": expiration,
    }

    token = jwt.encode(
        payload,
        settings.secret_key,
        algorithm="HS256"
    )

    return token


# ==========================================================
# AUTENTICAÇÃO DO USUÁRIO
# ==========================================================

def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Valida o JWT e retorna o usuário autenticado."""

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=["HS256"]
        )

        user_id = int(payload["sub"])

    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# ==========================================================
# AUTORIZAÇÃO — ADMINISTRADOR
# ==========================================================

def admin_user(
    user: User = Depends(current_user)
) -> User:
    """Permite acesso somente a usuários administradores."""

    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permissão insuficiente"
        )

    return user
