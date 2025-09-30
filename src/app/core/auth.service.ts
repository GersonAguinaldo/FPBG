import { Injectable, signal } from '@angular/core';

export type User = {
  id: string;
  fullName: string;
  email: string;
  photoUrl?: string;
};

const LS_KEY = 'fpbg.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private restore(): User | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) as User : null;
    } catch {
      return null;
    }
  }

  private _user = signal<User | null>(this.restore());
  user = this._user.asReadonly();

  isLoggedIn() { return !!this._user(); }

  // DEV: “connexion” locale (aucune vérif côté serveur)
  loginDev(email: string, fullName = 'Utilisateur FPBG') {
    const u: User = { id: 'dev-' + Date.now(), fullName, email };
    this._user.set(u);
    localStorage.setItem(LS_KEY, JSON.stringify(u));
  }

  // DEV: “inscription” locale (même logique)
  registerDev(email: string, fullName: string) {
    this.loginDev(email, fullName);
  }

  logout() {
    localStorage.removeItem(LS_KEY);
    this._user.set(null);
  }

  // ...votre code existant (LS_KEY, _user, user, loginDev, registerDev, logout)

  /** Stocke la photo (DataURL) dans le user + localStorage. Front-only. */
  async updatePhoto(file: File): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith('image/')) throw 'FORMAT';
    if (file.size > 3 * 1024 * 1024) throw 'SIZE'; // 3 Mo max (modifiez si besoin)

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject('READ');
      r.readAsDataURL(file);
    });

    const u = this._user();
    if (!u) throw 'NOAUTH';
    const updated = { ...u, photoUrl: dataUrl };
    this._user.set(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }

  /** Supprime la photo du profil (localStorage + signal). */
  clearPhoto(): void {
    const u = this._user();
    if (!u) return;
    const updated = { ...u };
    delete (updated as any).photoUrl;
    this._user.set(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }
}
