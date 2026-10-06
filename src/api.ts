export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const TOKEN_KEY = 'cal.token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch('/api' + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Pas de connexion internet.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Une erreur est survenue.')
  return data
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue.')
