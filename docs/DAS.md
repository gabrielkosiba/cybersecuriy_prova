# DAS — Documento de Arquitetura de Solução

## Visão geral
Autom Hub é uma aplicação modular composta por frontend React, API REST FastAPI, persistência SQLite, processo ETL e módulo de ML.

## Componentes
- **Frontend:** autenticação e painel administrativo.
- **API:** validação HTTP, autorização e orquestração de casos de uso.
- **Persistência:** entidades de usuários, máquinas, leituras, previsões e modelos.
- **ETL:** extração do SQLite, validação, ordenação e exportação CSV.
- **ML:** treinamento supervisionado e inferência rastreada por versão.

## Fluxo
React → HTTP/JWT → FastAPI → serviços/repositórios → SQLite. ETL e treinamento são funções independentes das rotas de leitura; seus gatilhos administrativos são expostos pela API nesta versão inicial.

## Decisões e limitações
SQLite simplifica a execução local. Para produção multiusuário, avaliar banco servidor. O baseline de ML requer rótulos históricos confiáveis e validação temporal antes do uso operacional.
