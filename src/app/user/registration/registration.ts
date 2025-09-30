// registration.ts
import { Component, inject } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule /*, Validators*/ } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { OtpService } from '../../auth/otp.service'; // ✅ OTP

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, NgOptimizedImage],
  templateUrl: './registration.html'
})
export class Registration {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private otpService = inject(OtpService); // ✅ OTP

  form = this.fb.group({
    fullName: [''],
    email: [''],
    password: [''],
    confirm: [''],
  });

  submit() {
    // 1) “création” locale (mock)
    const { email, fullName } = this.form.value as { email?: string; fullName?: string };
    const safeEmail = (email || '').trim() || 'demo@fpbg.local';
    const safeName  = (fullName || '').trim() || 'Porteur de projet';
    this.auth.loginApplicant?.(safeEmail, safeName) ?? this.auth.register?.(this.form.value as any);

    // 2) Émettre un OTP (mock) et 3) rediriger vers /otp avec l’email
    this.otpService.issue(safeEmail);
    this.router.navigate(['/otp'], { queryParams: { email: safeEmail } });
  }
}
