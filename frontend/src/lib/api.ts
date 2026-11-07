const TOKEN_KEY = 'payroll_access_token';
const USER_KEY = 'payroll_current_user';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  employeeId?: string | null;
  employeeName?: string | null;
  features?: string[];
  accessToken: string;
  refreshToken?: string;
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, user.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(path, {
    ...options,
    headers,
  });

  // Automatic Refresh Token rotation if access token expired
  if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
    const storedUser = getStoredUser();
    if (storedUser?.refreshToken) {
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedUser.refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshedUser = (await refreshRes.json()) as AuthUser;
        setStoredUser(refreshedUser);
        headers['Authorization'] = `Bearer ${refreshedUser.accessToken}`;
        response = await fetch(path, {
          ...options,
          headers,
        });
      }
    }
  }

  if (!response.ok) {
    let errMessage = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.message) errMessage = errBody.message;
      else if (errBody?.detail) errMessage = errBody.detail;
      else if (errBody?.errors) {
        errMessage = Object.values(errBody.errors).flat().join(' ');
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
