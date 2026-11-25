
const BASE = 'http://127.0.0.1:8000';

export async function request(path, token, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));

  if (response.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('token');
    window.dispatchEvent(new Event('auth-expired'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!response.ok) {
    throw new Error(body.detail || `Erro HTTP ${response.status}`);
  }

  return body;
}
