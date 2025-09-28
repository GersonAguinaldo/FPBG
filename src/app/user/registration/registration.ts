import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule /*, Validators*/ } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registration.html'
})
export class Registration {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  // -- Version SANS validators exigés (front-only)
  form = this.fb.group({
    fullName: ['' /*, [Validators.required, Validators.minLength(2)]*/],
    email: [''    /*, [Validators.required, Validators.email]*/],
    password: ['' /*, [Validators.required, Validators.minLength(6)]*/],
    confirm: [''  /*, [Validators.required]*/],
  }/*, { validators: mustMatch('password', 'confirm') }*/);

  submit() {
    // NOTE: pas de .invalid ici -> on laisse toujours soumettre (front-only)
    this.auth.register(this.form.value as any);   // mock
    this.router.navigateByUrl('/login');
  }
}
