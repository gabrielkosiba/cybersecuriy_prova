# API
Documentação interativa: `/docs`.

| Método | Endpoint | Finalidade |
|---|---|---|
| POST | `/auth/login` | Autenticação JWT |
| GET | `/auth/me` | Usuário autenticado |
| GET/POST | `/maquinas` | Listar/cadastrar máquinas |
| GET/PUT/DELETE | `/maquinas/{id}` | Consultar/atualizar/remover |
| POST | `/maquinas/{id}/leituras` | Registrar leitura |
| GET | `/leituras_etl` | Consultar leituras (`maquina_id`) |
| GET | `/leituras_etl/{id}` | Consultar leitura |
| POST/GET | `/etl/executar`, `/etl/status` | ETL |
| POST | `/modelo/treinar` | Treinamento (admin) |
| GET | `/modelo/status`, `/modelo/metricas` | Estado e métricas |
| POST | `/maquinas/{id}/previsoes` | Inferência |
| GET | `/previsoes` | Histórico de previsões |
| GET | `/previsoes/{id}` | Previsão específica |
