# Segurança
- JWT assinado com segredo configurável e expiração.
- Senhas armazenadas com hash Argon2 via pwdlib.
- Rotas exigem autenticação; operações administrativas exigem perfil admin.
- SQLAlchemy utiliza parâmetros vinculados nas consultas.
- CORS restrito por configuração.
- Segredos não devem ser versionados.

Antes de produção: HTTPS obrigatório, gestão de segredos, rotação de chaves, rate limiting, auditoria, política de backup testada, SAST/dependency/secret scans e revisão de autorização por endpoint. O usuário inicial é somente para desenvolvimento.
