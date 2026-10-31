const TOKEN_KEY = 'payroll_access_token';
const USER_KEY = 'payroll_current_user';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  employeeId?: string | null;
  employeeName?: string | null;
  accessToken: string;
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

  const response = await fetch(path, {
    ...options,
    headers,
  });

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

  return response.json() as Promise<T>;
}
