// registration.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule /*, Validators*/ } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router'; // ⬅️ + RouterLinkActive
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive], // ⬅️ ici aussi
  templateUrl: './registration.html'
})
export class Registration {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  form = this.fb.group({
    fullName: [''],
    email: [''],
    password: [''],
    confirm: [''],
  });

  submit() {
    this.auth.register(this.form.value as any);   // mock
    this.router.navigateByUrl('/login');
  }
}
