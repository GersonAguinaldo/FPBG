import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChildren,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OtpService } from './otp.service';

@Component({
  selector: 'app-otp',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './otp.html',
})
export class OtpComponent implements OnInit, OnDestroy {
  constructor(
    private otp: OtpService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  @ViewChildren('d') digitsEls!: QueryList<ElementRef<HTMLInputElement>>;

  email = signal<string>('');
  error = signal<string | null>(null);
  success = signal<boolean>(false);
  busy = signal<boolean>(false);

  // 6 cases (toujours 1 caractère max par case)
  digits = signal<string[]>(['', '', '', '', '', '']);

  // Le bouton s'active uniquement si 6 chiffres valides (1 par case)
  isComplete = computed(() => this.digits().every((d) => /^\d$/.test(d)));

  // Timer re-envoi
  left = signal<number>(0);
  canResend = computed(() => this.left() === 0);

  // interval id
  private _intervalId: any = null;

  ngOnInit(): void {
    const fromRegisterEmail =
      this.route.snapshot.queryParamMap.get('email') || '';
    const storedEmail = this.otp.getEmail() || '';
    const email = fromRegisterEmail || storedEmail || 'demo@fpbg.local';

    this.email.set(email);

    // Émettre un OTP si aucun payload actif
    if (!storedEmail) {
      this.otp.issue(email);
    }

    // Démarrer le timer
    this.tick();
    this._intervalId = setInterval(() => this.tick(), 1000);

    // Focus initial
    setTimeout(() => this.focus(0), 0);
  }

  ngOnDestroy(): void {
    if (this._intervalId) clearInterval(this._intervalId);
  }

  private tick() {
    this.left.set(this.otp.timeLeft());
  }

  // Gestion de la saisie: normalise à 1 chiffre, et décale le focus au tick suivant
  onInput(i: number, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const firstDigit = (input.value.match(/\d/)?.[0] ?? '').slice(0, 1);

    const arr = [...this.digits()];
    arr[i] = firstDigit;
    this.digits.set(arr);

    // Réécrit la valeur nettoyée (évite les doublons visuels)
    input.value = firstDigit;

    // Avance si on a un chiffre, au "prochain tick" pour éviter la double frappe
    if (firstDigit && i < 5) {
      setTimeout(() => this.focus(i + 1), 0);
    }

    // Auto-submit quand le 6e chiffre arrive et que tout est complet
    if (i === 5 && firstDigit && this.isComplete()) {
      setTimeout(() => this.submit(), 0);
    }

    this.error.set(null);
  }

  onKeydown(i: number, ev: KeyboardEvent) {
    const input = ev.target as HTMLInputElement;

    // Backspace sur champ vide -> recule d'une case
    if (ev.key === 'Backspace' && !input.value && i > 0) {
      const arr = [...this.digits()];
      arr[i - 1] = '';
      this.digits.set(arr);
      setTimeout(() => this.focus(i - 1), 0);
    }

    if (ev.key === 'ArrowLeft' && i > 0) {
      ev.preventDefault();
      this.focus(i - 1);
    }
    if (ev.key === 'ArrowRight' && i < 5) {
      ev.preventDefault();
      this.focus(i + 1);
    }
  }

  // Coller "123456" remplit les 6 cases
  onPaste(ev: ClipboardEvent) {
    const text = ev.clipboardData?.getData('text') ?? '';
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(cleaned)) return;
    ev.preventDefault();
    this.digits.set(cleaned.split('').slice(0, 6));
    setTimeout(() => this.focus(5), 0);
  }

  focus(i: number) {
    const el = this.digitsEls.get(i)?.nativeElement;
    el?.focus();
    el?.select();
  }

  submit() {
    if (!this.isComplete()) return;
    this.busy.set(true);
    this.error.set(null);

    const code = this.digits().join('');
    const { ok, reason } = this.otp.verify(code);

    this.busy.set(false);
    if (!ok) {
      this.error.set(reason ?? 'Code invalide');
      return;
    }
    this.success.set(true);

    // Petite pause visuelle puis redirection
    setTimeout(() => this.router.navigateByUrl('/dashboard'), 600);
  }

  resend() {
    if (!this.canResend()) return;
    this.otp.resend(); // nouveau code mock + nouveau TTL
    this.left.set(this.otp.timeLeft());
    this.error.set(null);
    this.digits.set(['', '', '', '', '', '']);
    this.focus(0);
  }
  devCode = computed(() => this.otp.peek());

}
