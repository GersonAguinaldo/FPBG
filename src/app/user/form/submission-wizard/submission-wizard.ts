import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl, FormArray, FormBuilder, FormControl, FormGroup,
  ReactiveFormsModule, Validators, ValidationErrors
} from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs/operators';

// Angular Material (champs/boutons)
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const LS_DRAFT_KEY = 'draft_submission';
const LS_STEP_KEY = 'draft_step_index';
const SUBMISSION_META_KEY = 'submission_meta';

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

  months = Array.from({ length: 12 }, (_, i) => i + 1);

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
    });
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

  // Soumission (front-only)
  submit() {
    const meta = { id: 'PRJ-001', status: 'SOUMIS', updatedAt: Date.now() };
    localStorage.setItem(SUBMISSION_META_KEY, JSON.stringify(meta));
    alert('Votre dossier est marqué comme SOUMIS (simulation front).');
    this.router.navigateByUrl('/dashboard');
  }

  // Alerte budget
  get budgetError() { return (this.form.errors?.['overheadTooHigh']) ?? null; }

  // Aide contextuelle (contenu à droite)
  help = [
    {
      title: 'Demandeur / Soumissionnaire',
      html: `
      <ul>
        <li><b>Organisation porteuse</b> et <b>personne de contact principale</b>.</li>
        <li><b>Couverture géographique</b> : locale, régionale, nationale (ou zones précises).</li>
        <li><b>Domaines d’intervention</b> : conservation, restauration des berges, ingénierie écologique, sensibilisation…</li>
        <li><b>Coordonnées</b> : adresse physique, email, téléphone.</li>
      </ul>
      <p class="mt-2 text-xs text-gray-500">Astuce : ces infos serviront aux communications officielles. Gardez-les à jour.</p>
    `
    },
    {
      title: 'Proposition de projet',
      html: `
      <ul>
        <li><b>Titre</b> : clair, concis, accrocheur — il doit résumer l’objectif.</li>
        <li><b>Lieu d’exécution &amp; groupe cible</b> (≤ 200 mots) : zones, communautés, bénéficiaires directs/indirects.</li>
        <li><b>Contexte &amp; justification</b> (≤ 500 mots) :
          <ul class="ml-4 list-disc">
            <li>Problèmes / pressions : érosion, pollution, perte de biodiversité, risques climatiques…</li>
            <li>Causes : anthropiques (défrichement, rejets) / naturelles ; obstacles identifiés.</li>
            <li>Acteurs et ressources existants ; risques résiduels.</li>
          </ul>
        </li>
      </ul>
    `
    },
    {
      title: 'Objectifs & résultats',
      html: `
      <ul>
        <li><b>Objectifs</b> (≤ 200 mots) : formulez des objectifs <b>SMART</b> avec indicateurs (ex. “stabiliser 3&nbsp;km de berges en 12&nbsp;mois”).</li>
        <li><b>Résultats attendus</b> (≤ 100 mots) : changements mesurables causés par les activités.</li>
        <li><b>Durée</b> : en mois (ex. 12&nbsp;mois), réaliste vs. ambition.</li>
      </ul>
    `
    },
    {
      title: 'Activités & calendrier',
      html: `
      <ul>
        <li><b>Résumé des activités</b> (≤ 200 mots) : grandes lignes pour atteindre les objectifs.</li>
        <li><b>Calendrier</b> : cochez les mois M1…M12 par activité.</li>
        <li><b>Exemples d’activités</b> : cartographie, ingénierie écologique (fascines, enrochements végétalisés),
            plantations d’espèces indigènes, dispositifs de suivi (qualité de l’eau, inventaires), sensibilisation…</li>
      </ul>
      <p class="mt-2 text-xs text-gray-500">Vérifiez la <i>liste d’exclusion</i> FPBG avant de soumettre.</p>
    `
    },
    {
      title: 'Risques',
      html: `
      <ul>
        <li>Quels sont les <b>risques techniques, environnementaux, sociaux ou politiques</b> ?</li>
        <li>Comment comptez-vous les <b>éviter</b> ou les <b>atténuer</b> (mesures concrètes) ?</li>
      </ul>
    `
    },
    {
      title: 'Budget estimatif',
      html: `
      <ul>
        <li>Renseignez les lignes par <b>catégorie</b> : Activités de terrain, Investissements, Fonctionnement.</li>
        <li>Indiquez <b>Part FPBG</b> et <b>cofinancements</b> (donateurs A &amp; B, nature/numéraire).</li>
        <li><b>Plafond :</b> Fonctionnement ≤ <b>10&nbsp;%</b> du total (contrôle automatique ici).</li>
      </ul>
    `
    },
    {
      title: 'État & financement',
      html: `
      <ul>
        <li><b>Stade</b> : Conception, Démarrage, Avancé, Phase finale.</li>
        <li><b>Financements déjà demandés/obtenus</b> : bailleur, montant, statut, complémentarité.</li>
      </ul>
    `
    },
    {
      title: 'Durabilité & réplication',
      html: `
      <ul>
        <li><b>Durabilité</b> : comment les effets persistent après le projet (gouvernance, maintenance, capacités) ?</li>
        <li><b>Réplication</b> : le projet est-il reproductible ailleurs au Gabon (conditions, coûts, partenaires) ?</li>
      </ul>
    `
    },
    {
      title: 'Annexes',
      html: `
      <ul>
        <li>Téléversez les pièces 1→11 (PDF/DOC/XLS/JPG/PNG, 10&nbsp;Mo max).</li>
        <li><b>Obligatoires</b> : Lettre de motivation, Statuts &amp; règlement (ONG/Coop), Fiche circuit (PME/PMI/Startup),
            RIB, Agrément/Récépissé, CV, <b>Budget détaillé</b>, <b>Chronogramme</b>.</li>
        <li><b>Optionnelles</b> : Cartographie/Localisation, Lettre de soutien/partenariat.</li>
      </ul>
    `
    },
    {
      title: 'Récapitulatif',
      html: `
      <ul>
        <li>Relisez tout, comparez aux limites de mots et aux exigences.</li>
        <li>Vous pouvez revenir aux étapes précédentes avant de soumettre.</li>
      </ul>
    `
    }
  ];
}
