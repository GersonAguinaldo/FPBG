import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {Router, RouterLink, RouterLinkActive} from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-user-login',
  standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive],
  templateUrl: './login.html'
})
export class Login {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  loading = false;

  // ...
  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    try {
      const { email, password } = this.form.value as any;
      this.auth.loginAdmin(email, password);   // ⬅️ rôle ADMIN
      this.router.navigateByUrl('/admin');
    } finally { this.loading = false; }
  }

}
