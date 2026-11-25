def token(client):
    response = client.post("/auth/login", json={"email": "admin@test.local", "password": "Password123!"})
    assert response.status_code == 200
    return response.json()["access_token"]

def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}

def test_login_invalid(client):
    assert client.post("/auth/login", json={"email": "admin@test.local", "password": "wrong"}).status_code == 401

def test_machine_crud_basics(client):
    headers = {"Authorization": f"Bearer {token(client)}"}
    payload = {"name": "Compressor A", "equipment_type": "Compressor",
               "location": "Planta 1", "operating_hours": 120.0}
    created = client.post("/maquinas", json=payload, headers=headers)
    assert created.status_code == 200
    machine_id = created.json()["id"]
    assert client.get(f"/maquinas/{machine_id}", headers=headers).status_code == 200
    assert len(client.get("/maquinas", headers=headers).json()) == 1

def test_protected_endpoint(client):
    assert client.get("/maquinas").status_code == 401
