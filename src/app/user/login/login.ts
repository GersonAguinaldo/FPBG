import { Component, inject } from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-user-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgOptimizedImage],
  templateUrl: './login.html',
})
export class Login {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    // on garde un champ password pour l'UI, mais il n'est pas vérifié côté backend en mode dev
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = false;

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    try {
      const { email } = this.form.value as { email: string };
      // Simule une connexion locale (pas de vérification serveur)
      this.auth.loginDev(email, 'Porteur de projet');
      this.router.navigateByUrl('/dashboard');
    } finally {
      this.loading = false;
    }
  }
}
