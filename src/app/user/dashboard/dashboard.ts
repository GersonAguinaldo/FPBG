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

const LS_SUBMISSION_KEY = 'submission_meta';
const LS_DRAFT_FORM_KEY = 'draft_submission';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

  // ===== Profil (mock) =====
  user = signal({
    fullName: localStorage.getItem('user_fullName') || 'RAPONTCHOMBO MBA\'BU GEORGES CHRISTIAN',
    photoUrl: localStorage.getItem('user_photoUrl') || 'assets/avatar-placeholder.png',
  });
  imgError = signal(false);
  initials = computed(() =>
    this.user().fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || 'U'
  );

  // ===== Projet unique =====
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

  // ===== Sidebar =====
  asideOpen = signal(false);
  toggleAside() { this.asideOpen.update(v => !v); }

  // Bouton d’action principal (contextuel)
  ctaLabel = computed(() => !this.hasProject() ? 'Créer votre projet'
    : this.isDraft() ? 'Continuer le brouillon'
      : 'Voir mon projet');
  primaryActionClick() {
    if (!this.hasProject()) return this.startProject();
    if (this.isDraft()) return this.resumeDraft();
    return this.viewProject();
  }

  // Chip de statut (classe tailwind)
  statusClass = computed(() => {
    switch (this.status()) {
      case 'BROUILLON': return 'bg-slate-200 text-slate-800';
      case 'SOUMIS':    return 'bg-blue-100 text-blue-800';
      case 'EN_REVUE':  return 'bg-amber-100 text-amber-800';
      case 'ACCEPTE':   return 'bg-emerald-100 text-emerald-800';
      case 'REJETE':    return 'bg-rose-100 text-rose-800';
      default:          return 'bg-slate-200 text-slate-800';
    }
  });

  // ===== Actions projet =====
  startProject() {
    if (this.hasProject()) { this.goForm(); return; }
    const s: Submission = { id: 'PRJ-001', title: '', status: 'BROUILLON', updatedAt: Date.now() };
    this.submission.set(s);
    this.persistSubmission(s);
    this.goForm();
  }
  resumeDraft() { this.goForm(); }
  viewProject() { this.goForm(); }
  submitProjectMock() {
    const s = this.submission(); if (!s) return;
    s.status = 'SOUMIS'; s.updatedAt = Date.now();
    this.submission.set({ ...s }); this.persistSubmission(this.submission()!);
  }
  clearDraftOnly() { localStorage.removeItem(LS_DRAFT_FORM_KEY); }
  goForm() { this.router.navigateByUrl('/form'); }

  // ===== Collaborateurs =====
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
    // localStorage.clear()
  }

  // ===== Divers =====
  logout() { this.auth.logout(); this.router.navigateByUrl('/login'); }
  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
