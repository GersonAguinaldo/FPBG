import { Injectable, signal } from '@angular/core';

type OtpPayload = {
  email: string;
  code: string;      // 6 digits
  expiresAt: number; // timestamp ms
  attempts: number;
};

const LS_KEY = 'fpbg_otp_payload';

@Injectable({ providedIn: 'root' })
export class OtpService {
  verified = signal<boolean>(false);

  /** Génère un code et “l’envoie” (mock). */
  issue(email: string, ttlSeconds = 180): string {
    const code = this.random6();
    const payload: OtpPayload = {
      email,
      code,
      expiresAt: Date.now() + ttlSeconds * 1000,
      attempts: 0
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));

    // MOCK d’envoi : visible dans la console.
    // En prod : appeler l’API d’envoi (mail/SMS).
    // eslint-disable-next-line no-console
    console.log('[OTP] code envoyé à', email, '→', code);

    this.verified.set(false);
    return code;
  }

  /** Vérifie le code. */
  verify(input: string): { ok: boolean; reason?: string } {
    const payload = this.read();
    if (!payload) return { ok: false, reason: 'OTP introuvable' };
    if (Date.now() > payload.expiresAt) return { ok: false, reason: 'OTP expiré' };

    payload.attempts++;
    this.write(payload);

    if (input === payload.code) {
      this.verified.set(true);
      // Nettoie après succès
      localStorage.removeItem(LS_KEY);
      localStorage.setItem('fpbg_verified', '1');
      return { ok: true };
    }
    return { ok: false, reason: 'Code incorrect' };
  }

  /** Renvoie le temps restant en secondes (0 si expiré ou absent). */
  timeLeft(): number {
    const p = this.read();
    if (!p) return 0;
    return Math.max(0, Math.floor((p.expiresAt - Date.now()) / 1000));
  }

  /** Relance (nouveau code + nouveau TTL). */
  resend(ttlSeconds = 180): string | null {
    const p = this.read();
    if (!p) return null;
    return this.issue(p.email, ttlSeconds);
  }

  getEmail(): string | null {
    return this.read()?.email ?? null;
  }

  private read(): OtpPayload | null {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as OtpPayload; } catch { return null; }
  }
  private write(p: OtpPayload) { localStorage.setItem(LS_KEY, JSON.stringify(p)); }

  private random6(): string {
    // 000000..999999 (toujours 6 digits)
    return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  }
  peek(): string | null {
    // ⚠️ à retirer en prod
    // Renvoie le code en cours (debug)
    const raw = localStorage.getItem('fpbg_otp_payload');
    if (!raw) return null;
    try { return (JSON.parse(raw) as any).code || null; } catch { return null; }
  }

}
