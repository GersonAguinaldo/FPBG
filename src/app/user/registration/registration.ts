import { Component, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule /*, Validators*/ } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { OtpService } from '../../auth/otp.service'; // ← AJOUT

// -- Option futur : validation 'mustMatch' (commentée)
// function mustMatch(a: string, b: string) {
//   return (group: AbstractControl) => {
//     const A = group.get(a), B = group.get(b);
//     if (A && B && A.value !== B.value) { B.setErrors({ mustMatch: true }); }
//     else { if (B?.hasError('mustMatch')) B.updateValueAndValidity({ onlySelf: true }); }
//     return null;
//   };
// }

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './registration.html'
})
export class Registration {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private otpService = inject(OtpService); // ← AJOUT

  // -- Version SANS validators exigés (front-only)
  form = this.fb.group({
    fullName: ['' /*, [Validators.required, Validators.minLength(2)]*/],
    email: [''    /*, [Validators.required, Validators.email]*/],
    password: ['' /*, [Validators.required, Validators.minLength(6)]*/],
    confirm: [''  /*, [Validators.required]*/],
  }/*, { validators: mustMatch('password', 'confirm') }*/);

  submit() {
    // Simule l'inscription + session locale
    const { email, fullName } = this.form.value as { email?: string; fullName?: string };
    const safeEmail = email && email.trim() ? email.trim() : 'demo@fpbg.local';
    const safeName  = fullName && fullName.trim() ? fullName.trim() : 'Porteur de projet';

    this.auth.registerDev(safeEmail, safeName);

    // === OTP : émission + redirection vers la page OTP ===
    this.otpService.issue(safeEmail);                             // génère le code (mock) + TTL
    this.router.navigate(['/otp'], { queryParams: { email: safeEmail } }); // va sur l’écran OTP

    // (Avant: this.router.navigateByUrl('/dashboard');)
  }
}
