import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl, FormArray, FormBuilder, FormControl, FormGroup,
  ReactiveFormsModule, Validators, ValidationErrors
} from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs/operators';

// (Material importés mais non obligatoires — tu peux les retirer si tu ne les utilises pas)
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const LS_DRAFT_KEY = 'draft_submission';
const LS_STEP_KEY = 'draft_step_index';
const SUBMISSION_META_KEY = 'submission_meta';
const ADMIN_DATA_KEY = 'fpbg_admin_records';

type BudgetCategory = 'ACTIVITES_TERRAIN' | 'INVESTISSEMENTS' | 'FONCTIONNEMENT';
type DocumentType =
  | 'FORMULAIRE' | 'LETTRE_MOTIVATION' | 'STATUTS_REGLEMENT' | 'FICHE_CIRCUIT' | 'RIB'
  | 'AGREMENT' | 'CV' | 'BUDGET_DETAILLE' | 'CHRONOGRAMME' | 'CARTOGRAPHIE' | 'LETTRE_SOUTIEN';

const ALLOWED_MIME = [
  'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'image/jpeg', 'image/png'
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo

// ====== Validators utilitaires ======
function wordLimit(max: number) {
  return (c: AbstractControl): ValidationErrors | null => {
    const t = ('' + (c.value ?? '')).trim();
    const n = t ? t.split(/\s+/).length : 0;
    return n > max ? { wordLimit: { max, actual: n } } : null;
  };
}
function fileConstraints() {
  return (c: AbstractControl): ValidationErrors | null => {
    const f: File | null = c.value;
    if (!f) return null;
    if (f.size > MAX_FILE_BYTES) return { fileTooLarge: true };
    if (!ALLOWED_MIME.includes(f.type)) return { fileType: true };
    return null;
  };
}
function nonEmptyArray(min = 1) {
  return (c: AbstractControl) => {
    const arr = c as FormArray;
    return arr.length < min ? { arrayMin: { min } } : null;
  };
}
function budget10Percent(group: AbstractControl): ValidationErrors | null {
  const lines = (group.get('budgetLines') as FormArray).controls;
  let total = 0, fonctionnement = 0;
  for (const l of lines) {
    const amount = Number(l.get('total')?.value || 0);
    total += amount;
    if (l.get('category')?.value === 'FONCTIONNEMENT') fonctionnement += amount;
  }
  if (total === 0) return null;
  return fonctionnement > total * 0.10 ? { overheadTooHigh: { fonctionnement, total } } : null;
}
// Chaque ligne : Part FPBG + Cofinance == Total (facultatif mais pratique)
function amountsMatch(group: AbstractControl): ValidationErrors | null {
  const total = Number(group.get('total')?.value || 0);
  const a = Number(group.get('partFPBG')?.value || 0);
  const b = Number(group.get('partCofinance')?.value || 0);
  return (a + b) === total ? null : { amountsMismatch: true };
}

@Component({
  selector: 'app-submission-wizard',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './submission-wizard.html',
  styles: [`
    .months { display:grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap:.5rem }
    @media (min-width:768px){ .months{ grid-template-columns: repeat(12, minmax(0, 1fr)); } }
  `]
})
export class SubmissionWizard {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // ====== État du wizard (index) ======
  current = signal<number>(Math.max(0, Math.min(9, Number(localStorage.getItem(LS_STEP_KEY) ?? 0))));
  goTo = (i: number) => { if (i < 0 || i > 9) return; this.current.set(i); localStorage.setItem(LS_STEP_KEY, String(i)); };
  next = () => this.goTo(this.current() + 1);
  prev = () => this.goTo(this.current() - 1);
  progress = computed(() => Math.round(((this.current() + 1) / 10) * 100));

  // Mois (labels façon tableau Jan→Déc du document)
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  monthsLabels = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  // Input accept pour <input type="file">
  allowedAccept = ALLOWED_MIME.join(',');

  // Conseils / textes droite
  adviceHtml = `
    <ul class="list-disc ml-4">
      <li><b>Soyez clair et concis</b> : allez à l’essentiel pour susciter l’intérêt.</li>
      <li><b>Impact</b> : mettez en avant les bénéfices concrets (environnementaux, sociaux, économiques, capacités).</li>
      <li><b>Alignement</b> : cohérence avec les objectifs/priorités FPBG et les appels en cours.</li>
      <li><b>Professionnalisme</b> : respect des limites de mots, chiffres vérifiés, cohérence globale.</li>
    </ul>
  `;
  selectionHtml = `
    <ul class="list-disc ml-4">
      <li>La fiche d’évaluation du processus de sélection est disponible (via FPBG).</li>
      <li>Après analyse, les projets sont classés par ordre de priorité par le Comité Technique.</li>
      <li>Le Comité Technique peut demander des précisions ou reformulations selon ses critères.</li>
    </ul>
  `;

  // ====== Step 1 : Demandeur ======
  step1 = this.fb.group({
    orgName: [''],
    orgType: [''],
    contactPerson: [''],
    geoCoverage: [''],
    domains: [''],
    address: [''],
    contactEmail: [''],
    contactPhone: ['']
  });

  // ====== Step 2 : Proposition ======
  step2 = this.fb.group({
    title: ['', [Validators.maxLength(120)]],
    locationAndTarget: ['', [wordLimit(200)]],
    contextJustification: ['', [wordLimit(500)]],
  });

  // ====== Step 3 : Objectifs ======
  step3 = this.fb.group({
    objectives: ['', [wordLimit(200)]],
    expectedResults: ['', [wordLimit(100)]],
    durationMonths: [12, [Validators.min(1), Validators.max(48)]],
  });

  // ====== Step 4 : Activités ======
  activitiesSummary = new FormControl<string>('', [wordLimit(200)]);
  activities = this.fb.array<FormGroup>([], nonEmptyArray(1));

  // ====== Step 5 : Risques ======
  risks = this.fb.array<FormGroup>([]);

  // ====== Step 6 : Budget ======
  budgetLines = this.fb.array<FormGroup>([], nonEmptyArray(1));

  // ====== Step 7 : État & financement ======
  stateStep = this.fb.group({
    projectStage: this.fb.control<'CONCEPTION' | 'DEMARRAGE' | 'AVANCE' | 'PHASE_FINALE'>('CONCEPTION'),
    hasFunding: this.fb.control<boolean>(false),
    fundingDetails: this.fb.control<string>(''),
  });

  // ====== Step 8 : Durabilité ======
  sustainabilityStep = this.fb.group({
    sustainability: this.fb.control<string>('', [wordLimit(250)]),
    replicability: this.fb.control<string>('', [wordLimit(250)]),
  });

  // ====== Step 9 : Annexes ======
  attachments = this.fb.group({
    FORMULAIRE: new FormControl<File | null>(null, []),
    LETTRE_MOTIVATION: new FormControl<File | null>(null, [fileConstraints()]),
    STATUTS_REGLEMENT: new FormControl<File | null>(null, [fileConstraints()]),
    FICHE_CIRCUIT: new FormControl<File | null>(null, [fileConstraints()]),
    RIB: new FormControl<File | null>(null, [fileConstraints()]),
    AGREMENT: new FormControl<File | null>(null, [fileConstraints()]),
    CV: new FormControl<File | null>(null, [fileConstraints()]),
    BUDGET_DETAILLE: new FormControl<File | null>(null, [fileConstraints()]),
    CHRONOGRAMME: new FormControl<File | null>(null, [fileConstraints()]),
    CARTOGRAPHIE: new FormControl<File | null>(null, [fileConstraints()]),
    LETTRE_SOUTIEN: new FormControl<File | null>(null, [fileConstraints()])
  });

  // ====== Form global ======
  form = this.fb.group({
    step1: this.step1,
    step2: this.step2,
    step3: this.step3,
    activities: this.activities,
    activitiesSummary: this.activitiesSummary,
    risks: this.risks,
    budgetLines: this.budgetLines,
    stateStep: this.stateStep,
    sustainabilityStep: this.sustainabilityStep,
    attachments: this.attachments
  }, { validators: budget10Percent });

  constructor() {
    // Restauration du brouillon
    const saved = localStorage.getItem(LS_DRAFT_KEY);
    if (saved) {
      const v = JSON.parse(saved);
      (v.activities ?? []).forEach((a: any) => this.addActivity(a.label, a.months ?? []));
      (v.risks ?? []).forEach((r: any) => this.addRisk(r.description, r.mitigation));
      (v.budgetLines ?? []).forEach((b: any) => this.addBudgetLine(b.category, b.description, b.total, b.partFPBG, b.partCofinance));
      this.form.patchValue(v, { emitEvent: false });
    } else {
      this.addActivity('Activité 1', []);
      this.addBudgetLine('ACTIVITES_TERRAIN', 'Atelier de lancement', 0, 0, 0);
    }

    // Autosave
    this.form.valueChanges.pipe(debounceTime(400))
      .subscribe(v => localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(v)));
  }

  // ====== Helpers Arrays ======
  createActivity(label = '', months: number[] = []) {
    return this.fb.group({ label: [label], months: [months] });
  }
  addActivity(label = '', months: number[] = []) { this.activities.push(this.createActivity(label, months)); }
  removeActivity(i: number) { this.activities.removeAt(i); }

  createRisk(description = '', mitigation = '') {
    return this.fb.group({ description: [description], mitigation: [mitigation] });
  }
  addRisk(description = '', mitigation = '') { this.risks.push(this.createRisk(description, mitigation)); }
  removeRisk(i: number) { this.risks.removeAt(i); }

  createBudgetLine(category: BudgetCategory = 'ACTIVITES_TERRAIN', description = '', total = 0, partFPBG = 0, partCofinance = 0) {
    return this.fb.group({
      category: [category],
      description: [description],
      total: [total],
      partFPBG: [partFPBG],
      partCofinance: [partCofinance]
    }, { validators: amountsMatch });
  }
  addBudgetLine(category?: BudgetCategory, description?: string, total?: number, partFPBG?: number, partCofinance?: number) {
    this.budgetLines.push(this.createBudgetLine(category, description, total, partFPBG, partCofinance));
  }
  removeBudgetLine(i: number) { this.budgetLines.removeAt(i); }

  // Mois cochables par activité
  isChecked(activity: FormGroup, m: number) {
    const arr = activity.get('months')?.value as number[] || [];
    return arr.includes(m);
  }
  toggleMonth(activity: FormGroup, m: number) {
    const arr = (activity.get('months')?.value as number[] || []).slice();
    const idx = arr.indexOf(m);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(m);
    activity.get('months')?.setValue(arr);
    activity.markAsDirty();
  }

  // Fichiers
  onFileChange(e: Event, key: DocumentType) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.attachments.get(key)?.setValue(file);
  }

  // ===== Envoi vers l'espace Admin =====
  private newProjectId(): string {
    const t = Date.now().toString(36).toUpperCase();
    return `PRJ-${t.slice(-6)}`;
  }
  private computeBudgetTotals() {
    const lines = this.budgetLines.getRawValue() as Array<{
      category: BudgetCategory; total: number; partFPBG: number; partCofinance: number;
    }>;
    const sum = (k: 'total' | 'partFPBG' | 'partCofinance') => lines.reduce((s, l) => s + (Number(l[k]) || 0), 0);
    const total = sum('total');
    const partFPBG = sum('partFPBG');
    const partCofinance = sum('partCofinance');
    const fonctionnement = lines.filter(l => l.category === 'FONCTIONNEMENT')
      .reduce((s, l) => s + (Number(l.total) || 0), 0);
    return { total, partFPBG, partCofinance, fonctionnement };
  }
  private getAttachmentsMeta() {
    const out: Record<string, { name: string; size: number; type: string } | null> = {};
    (Object.keys(this.attachments.controls) as DocumentType[]).forEach(k => {
      const f = this.attachments.get(k)?.value as File | null;
      out[k] = f ? { name: f.name, size: f.size, type: f.type } : null;
    });
    return out;
  }

  submit() {
    const id = this.newProjectId();
    const now = Date.now();

    const applicant = this.step1.getRawValue();
    const p2 = this.step2.getRawValue();
    const p3 = this.step3.getRawValue();
    const activitiesSummary = this.activitiesSummary.value || '';
    const activities = this.activities.getRawValue();
    const risks = this.risks.getRawValue();
    const budgetLines = this.budgetLines.getRawValue();
    const state = this.stateStep.getRawValue();
    const sustain = this.sustainabilityStep.getRawValue();
    const budgetTotals = this.computeBudgetTotals();
    const attachments = this.getAttachmentsMeta();

    const record = {
      id,
      status: 'SOUMIS' as const,
      updatedAt: now,

      applicant, // infos personnelles / organisation

      project: {
        title: p2.title,
        locationAndTarget: p2.locationAndTarget,
        contextJustification: p2.contextJustification,
        objectives: p3.objectives,
        expectedResults: p3.expectedResults,
        durationMonths: p3.durationMonths,

        activitiesSummary,
        activities,          // [{label, months:number[]}]
        risks,               // [{description, mitigation}]
        budgetLines,         // [{category, description, total, partFPBG, partCofinance}]
        budgetTotals,        // { total, fonctionnement, partFPBG, partCofinance }

        stage: state.projectStage,
        hasFunding: state.hasFunding,
        fundingDetails: state.fundingDetails,

        sustainability: sustain.sustainability,
        replicability: sustain.replicability
      },

      attachments          // métadonnées fichiers (name/type/size)
    };

    const raw = localStorage.getItem(ADMIN_DATA_KEY);
    const list = raw ? JSON.parse(raw) as any[] : [];
    list.unshift(record);
    localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(list));

    // Meta pour l'espace utilisateur
    localStorage.setItem(SUBMISSION_META_KEY, JSON.stringify({ id, status: 'SOUMIS', updatedAt: now }));

    alert('Votre dossier est marqué comme SOUMIS (simulation front).');
    this.router.navigateByUrl('/dashboard'); // ajuste si besoin
  }

  // Alerte budget
  get budgetError() { return (this.form.errors?.['overheadTooHigh']) ?? null; }

  // Aide contextuelle (contenu à droite)
  help = [
    {
      title: 'Demandeur / Soumissionnaire',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Organisation porteuse</b> : nom légal complet.</li>
        <li><b>Type d’organisation</b> : ONG, association communautaire, coopérative, PME/PMI/Startup…</li>
        <li><b>Personne de contact</b> : nom et prénom de l’interlocuteur principal.</li>
        <li><b>Couverture géographique</b> : locale, régionale, nationale, ou zones précises.</li>
        <li><b>Domaines d’intervention</b> : conservation, restauration, ingénierie écologique, sensibilisation…</li>
        <li><b>Coordonnées</b> : adresse, email de contact, téléphone.</li>
      </ul>
      <p class="mt-2 text-xs text-gray-600">Ces informations servent aux communications officielles. Tenez-les à jour.</p>
    `
    },
    {
      title: 'Proposition de projet',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Titre du projet</b> : clair, concis, accrocheur.</li>
        <li><b>Lieu & groupe cible</b> (≤200 mots) : sites d’intervention et bénéficiaires.</li>
        <li><b>Contexte & justification</b> (≤500 mots) : problèmes/pressions, causes, acteurs, solutions envisagées.</li>
      </ul>
    `
    },
    {
      title: 'Objectifs & résultats',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Objectifs</b> (≤200 mots) : formuler des objectifs SMART.</li>
        <li><b>Résultats attendus</b> (≤100 mots) : changements <b>mesurables</b>.</li>
        <li><b>Durée</b> : ex. 12 mois.</li>
      </ul>
    `
    },
    {
      title: 'Activités & calendrier',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Activités principales</b> (≤200 mots).</li>
        <li><b>Calendrier d’exécution</b> : cochez les mois pertinents.</li>
        <li><b>Exemples</b> : cartographie, planification d’ingénierie écologique, plantations, suivi, sensibilisation…</li>
      </ul>
    `
    },
    {
      title: 'Risques',
      html: `
      <ul class="list-disc ml-4">
        <li>Risques techniques, environnementaux, sociaux, politiques.</li>
        <li>Mesures d’évitement ou d’atténuation.</li>
      </ul>
    `
    },
    {
      title: 'Budget estimatif',
      html: `
      <ul class="list-disc ml-4">
        <li>Trois rubriques : <b>Activités de terrain</b>, <b>Investissements</b>, <b>Fonctionnement</b>.</li>
        <li>Co-financements éventuels, en numéraire ou en nature.</li>
        <li>Les frais de fonctionnement indirects ≤ <b>10 %</b> du total.</li>
      </ul>
    `
    },
    {
      title: 'État & financement',
      html: `
      <ul class="list-disc ml-4">
        <li>Stade : Conception, Démarrage, Avancé, Phase finale.</li>
        <li>Financement : bailleur(s), montant(s), statut.</li>
      </ul>
    `
    },
    {
      title: 'Durabilité & réplication',
      html: `
      <ul class="list-disc ml-4">
        <li>Comment les effets perdurent après la fin du projet ?</li>
        <li>Réplicabilité ailleurs au Gabon (conditions, partenaires, coûts).</li>
      </ul>
    `
    },
    {
      title: 'Annexes',
      html: `
      <p class="mb-2">Téléverser les pièces justificatives requises (PDF/DOC/XLS/JPG/PNG).</p>
      <ol class="list-decimal ml-5 space-y-1">
        <li>Lettre de motivation</li>
        <li>Statuts & règlement</li>
        <li>Fiche circuit (PME/PMI/Startup)</li>
        <li>RIB</li>
        <li>Agrément / Récépissé</li>
        <li>CV (porteur & responsables)</li>
        <li>Budget détaillé</li>
        <li>Chronogramme</li>
        <li>Cartographie (optionnel)</li>
        <li>Lettre de soutien (optionnel)</li>
      </ol>
    `
    },
    {
      title: 'Récapitulatif',
      html: `
      <ul class="list-disc ml-4">
        <li>Vérifier la cohérence <b>objectifs ↔ activités ↔ budget</b>.</li>
        <li>Relire et corriger avant la soumission.</li>
      </ul>
    `
    }
  ];

  // === Helpers UI ===
  formatMonths(months?: number[] | null): string {
    const arr = months ?? [];
    return arr.length ? arr.map(m => this.monthsLabels[m - 1]).join(', ') : '—';
  }
  trackByIndex = (i: number) => i;

  canGoNext(): boolean {
    // Règle simple : autoriser le passage à l’étape suivante (tu peux raffiner si besoin)
    return true;
  }
}
