import { Component, signal, inject, effect } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgClass],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);

  // pages qui doivent exploiter toute la largeur
  private wideMatcher = (url: string) => /\/(form|user\/form|submission)/.test(url);

  wide = signal<boolean>(this.wideMatcher(this.router.url));
  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.wide.set(this.wideMatcher(this.router.url)));
  }
}
