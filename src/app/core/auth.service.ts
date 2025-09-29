import { Injectable, signal } from '@angular/core';

export type Role = 'ADMIN' | 'APPLICANT';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _token = signal<string | null>(localStorage.getItem('token'));
  private _role  = signal<Role | null>(localStorage.getItem('role') as Role | null);

  isLoggedIn() { return !!this._token(); }
  role() { return this._role(); }

  // ===== Connexions mock côté front =====
  loginApplicant(email: string, password: string) {
    localStorage.setItem('token', 'demo-token');
    localStorage.setItem('role', 'APPLICANT');
    this._token.set('demo-token');
    this._role.set('APPLICANT');
  }

  loginAdmin(email: string, password: string) {
    localStorage.setItem('token', 'demo-token');
    localStorage.setItem('role', 'ADMIN');
    this._token.set('demo-token');
    this._role.set('ADMIN');
  }

  register(payload: { fullName: string; email: string; password: string }) {
    return true; // à remplacer par l’appel API réel
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    this._token.set(null);
    this._role.set(null);
  }
}
