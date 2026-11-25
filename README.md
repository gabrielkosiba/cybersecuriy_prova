# Autom Hub — Plataforma de Manutenção Preditiva

Projeto inicial funcional baseado na especificação fornecida. Inclui API FastAPI, SQLite, autenticação JWT, CRUD de máquinas, leituras, ETL, treinamento/inferência de um classificador baseline, frontend React e workflow CI.

> **Importante:** este pacote é uma base de desenvolvimento, não uma certificação de que todos os critérios da especificação foram atingidos. O modelo é um baseline técnico e precisa de dados históricos rotulados e validação industrial antes de ser usado em decisões operacionais. Não há métricas pré-fabricadas.

## Requisitos
- Python 3.11+
- Node.js 20+
- npm

## Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.seed
uvicorn app.main:app --reload
```
API: http://localhost:8000  
Swagger: http://localhost:8000/docs

Usuário inicial de desenvolvimento: `admin@automhub.local`  
Senha inicial: `ChangeMe123!`  
Altere a senha e `SECRET_KEY` antes de qualquer uso fora do ambiente local.

## Frontend
Em outro terminal:
```bash
cd frontend
npm install
npm run dev
```
Abra http://localhost:5173. A URL da API pode ser configurada em `VITE_API_URL`.

## ETL e Machine Learning
- `POST /etl/executar` executa a preparação de leituras armazenadas.
- `POST /modelo/treinar` treina um classificador se houver dados com rótulo `failure_within_horizon` (0/1) na tabela de leituras.
- As leituras podem receber esse rótulo opcional apenas para conjunto histórico validado. Não invente rótulos para dados reais.
- `POST /maquinas/{id}/previsoes` gera previsão quando existe modelo treinado e leituras suficientes.

## Testes e qualidade
```bash
cd backend
pytest --cov=app --cov-report=term-missing
ruff check .
black --check .
mypy app
```
A cobertura de 80% e os Quality Gates precisam ser medidos no ambiente real; este starter não declara que já os atingiu.

## Docker
Na raiz:
```bash
docker compose up --build
```
O frontend é disponibilizado pelo Vite em desenvolvimento. Para produção, configure build estático e servidor web apropriado.

## Estrutura
- `backend/app`: API, persistência, segurança, ETL e ML.
- `frontend`: aplicação React.
- `data`: diretórios de dados raw/processed.
- `models`: artefatos treinados.
- `.github/workflows`: CI.
- `docs`: arquitetura, API e segurança.

## Limitações conhecidas
- Banco SQLite adequado à primeira versão/local; avaliar PostgreSQL para concorrência e escala.
- O treinamento depende de dados históricos rotulados e representativos.
- O baseline usa divisão temporal simples e variáveis numéricas agregadas; precisa de validação, calibração e comparação operacional aprofundadas.
- SonarQube/SAST/secret scanning exigem configuração de tokens/serviços no GitHub.
- Kubernetes é preparado em `deploy/k8s`, mas não há implantação executada.
