import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

type SubmissionStatus = 'BROUILLON' | 'SOUMIS' | 'EN_REVUE' | 'ACCEPTE' | 'REJETE';

type Submission = {
  id: string;
  title: string;
  status: SubmissionStatus;
  updatedAt: number; // epoch ms
};

const LS_SUBMISSION_KEY = 'submission_meta';       // état du projet unique
const LS_DRAFT_FORM_KEY = 'draft_submission';      // autosave du wizard (étapes)

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl:  './dashboard.html',
})
export class Dashboard {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  // ====== Profil mock (à brancher plus tard) ======
  user = signal({
    fullName: localStorage.getItem('user_fullName') || 'RAPONTCHOMBO MBA\'BU GEORGES CHRISTIAN',
    photoUrl: localStorage.getItem('user_photoUrl') || 'assets/avatar-placeholder.png',
  });
  imgError = signal(false);
  initials = computed(() =>
    this.user().fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase())
      .join('') || 'U'
  );

  // ====== Un seul projet par utilisateur ======
  submission = signal<Submission | null>(this.loadSubmission());

  hasProject = computed(() => !!this.submission());
  isDraft = computed(() => this.submission()?.status === 'BROUILLON');
  status = computed<SubmissionStatus | null>(() => this.submission()?.status ?? null);

  private loadSubmission(): Submission | null {
    const raw = localStorage.getItem(LS_SUBMISSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as Submission; } catch { return null; }
  }
  private persistSubmission(s: Submission | null) {
    if (!s) localStorage.removeItem(LS_SUBMISSION_KEY);
    else localStorage.setItem(LS_SUBMISSION_KEY, JSON.stringify(s));
  }

  // ====== Sidebar UI ======
  asideOpen = signal(false); // mobile drawer

  toggleAside() { this.asideOpen.update(v => !v); }

  // ====== Actions ======
  startProject() {
    // crée le projet unique si inexistant
    if (this.hasProject()) { this.goForm(); return; }
    const s: Submission = {
      id: 'PRJ-001', // l’id API remplacera plus tard
      title: '',
      status: 'BROUILLON',
      updatedAt: Date.now(),
    };
    this.submission.set(s);
    this.persistSubmission(s);
    // on démarre le wizard ; il restaurera depuis LS_DRAFT_FORM_KEY
    this.goForm();
  }

  resumeDraft() { this.goForm(); }

  viewProject() {
    // pour l’instant, on renvoie vers le récap du wizard (même route)
    this.goForm();
  }

  submitProjectMock() {
    // EXEMPLE (bouton masqué par défaut) : passer en "SOUMIS"
    const s = this.submission();
    if (!s) return;
    s.status = 'SOUMIS';
    s.updatedAt = Date.now();
    this.submission.set({ ...s });
    this.persistSubmission(this.submission()!);
  }

  clearDraftOnly() { localStorage.removeItem(LS_DRAFT_FORM_KEY); }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  goForm() { this.router.navigateByUrl('/form'); }

  // ====== Collaborateurs (affichés seulement si projet existe) ======
  showAddCollaborator = signal(false);
  collabForm = this.fb.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: ['Éditeur', [Validators.required]],
  });
  collaborators = signal<{fullName: string; email: string; role: string}[]>([]);
  addCollaborator() {
    if (this.collabForm.invalid) { this.collabForm.markAllAsTouched(); return; }
    this.collaborators.update(list => [...list, this.collabForm.value as any]);
    this.collabForm.reset({ role: 'Éditeur' });
    this.showAddCollaborator.set(false);
  }
}
