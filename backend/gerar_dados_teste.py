
import requests
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"
MACHINE_ID = 1

EMAIL = "admin@automhub.local"
PASSWORD = "ChangeMe123!"

# Autenticação
login = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": EMAIL, "password": PASSWORD},
    timeout=15
)
login.raise_for_status()

token = login.json()["access_token"]

headers = {
    "Authorization": f"Bearer {token}"
}

# Consultar a última leitura
response = requests.get(
    f"{BASE_URL}/leituras_etl",
    params={"maquina_id": MACHINE_ID},
    headers=headers,
    timeout=15
)
response.raise_for_status()

readings = response.json()

if not readings:
    raise RuntimeError("Nenhuma leitura encontrada para a máquina.")

latest = max(readings, key=lambda r: r["operating_hours"])

base_hours = latest["operating_hours"]
base_time = datetime.fromisoformat(latest["timestamp"])

# Dados sintéticos: 12 exemplos de cada classe
samples = [
    # Classe 0: sem falha
    (30, 45, 2.0, 65, 0),
    (35, 47, 2.2, 67, 0),
    (40, 49, 2.1, 66, 0),
    (45, 46, 1.9, 64, 0),
    (50, 48, 2.3, 68, 0),
    (55, 50, 2.4, 69, 0),
    (60, 47, 2.0, 66, 0),
    (65, 49, 2.2, 67, 0),
    (70, 51, 2.5, 70, 0),
    (75, 48, 2.1, 65, 0),
    (80, 50, 2.3, 68, 0),
    (85, 46, 1.8, 63, 0),

    # Classe 1: com falha
    (90, 78, 5.5, 88, 1),
    (95, 82, 6.0, 91, 1),
    (100, 85, 6.5, 94, 1),
    (105, 88, 7.0, 96, 1),
    (110, 80, 5.8, 89, 1),
    (115, 86, 6.8, 95, 1),
    (120, 90, 7.2, 98, 1),
    (125, 83, 6.2, 92, 1),
    (130, 87, 6.7, 97, 1),
    (135, 92, 7.5, 99, 1),
    (140, 84, 6.1, 90, 1),
    (145, 89, 7.0, 96, 1),
]

created = 0

for index, (hours, temp, vibration, noise, label) in enumerate(samples, start=1):

    payload = {
        "timestamp": (
            base_time + timedelta(minutes=index)
        ).isoformat(),
        "operating_hours": base_hours + hours,
        "temperature_c": temp,
        "vibration_mm_s": vibration,
        "noise_db": noise,
        "failure_within_horizon": label
    }

    result = requests.post(
        f"{BASE_URL}/maquinas/{MACHINE_ID}/leituras",
        json=payload,
        headers=headers,
        timeout=15
    )

    if result.status_code != 200:
        print(f"Erro no registro {index}: {result.status_code}")
        print(result.text)
        break

    created += 1
    print(f"Registro {index}/24 cadastrado - classe {label}")

print(f"\nTotal cadastrado: {created} de 24")
print("Dados identificados como sintéticos para teste.")
