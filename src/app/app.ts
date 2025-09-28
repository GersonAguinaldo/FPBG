import { Component, signal, inject } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/auth.service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgClass, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);

  // Routes qui doivent s'afficher en plein écran (sans conteneur centré)
  private readonly wideRoutes: RegExp[] = [
    /^\/form(\/|$)/,
    /^\/user\/form(\/|$)/,
    /^\/submission(\/|$)/,
    /^\/dashboard(\/|$)/,
    /^\/user\/dashboard(\/|$)/
  ];

  private isWide = (url: string) => this.wideRoutes.some(r => r.test(url));

  wide = signal<boolean>(this.isWide(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.wide.set(this.isWide(this.router.url)));
  }
}
