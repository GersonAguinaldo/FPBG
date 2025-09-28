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
// …dans la classe SubmissionWizard
  adviceHtml = `
  <ul class="list-disc ml-4">
    <li><b>Soyez clair et concis</b> : allez à l’essentiel pour susciter l’intérêt.</li>
    <li><b>Impact</b> : mettez en avant les bénéfices concrets (environnementaux, sociaux, économiques, capacités).</li>
    <li><b>Alignement</b> : vérifiez la cohérence avec les objectifs/priorités FPBG et les appels en cours.</li>
    <li><b>Professionnalisme</b> : relisez, vérifiez chiffres et limites de mots, cohérence globale.</li>
  </ul>
`;

  selectionHtml = `
  <ul class="list-disc ml-4">
    <li>La <i>fiche d’évaluation</i> du processus de sélection est disponible (lien communiqué par FPBG).</li>
    <li>Après analyse, les projets sont <b>classés par ordre de priorité</b> par le Comité Technique.</li>
    <li>Le Comité Technique peut demander <b>des précisions</b> ou des <b>reformulations</b> selon les critères d’évaluation.</li>
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
      <ul class="list-disc ml-4">
        <li><b>Organisation porteuse</b> : nom légal complet.</li>
        <li><b>Type d’organisation</b> : ONG, association communautaire, coopérative, PME/PMI/Startup…</li>
        <li><b>Personne de contact</b> : nom et prénom de l’interlocuteur principal.</li>
        <li><b>Couverture géographique</b> : locale, régionale, nationale, ou zones précises (villes, villages, bassins versants, aires protégées…).</li>
        <li><b>Domaines d’intervention</b> : conservation de la biodiversité, restauration des berges/dégradées, ingénierie écologique (fascines, enrochements végétalisés…), sensibilisation/éducation environnementale, suivi écologique…</li>
        <li><b>Coordonnées</b> : adresse physique (complète), email de contact, numéro de téléphone.</li>
      </ul>
      <p class="mt-2 text-xs text-gray-600">Ces informations servent aux communications officielles. Tenez-les à jour.</p>
    `
    },
    {
      title: 'Proposition de projet',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Titre du projet</b> : clair, concis, accrocheur, résumant l’objectif. <i>Ex.</i> « Restauration de 3&nbsp;km de berges dans la zone de XXXX pour la conservation de la biodiversité et la résilience climatique ».</li>
        <li><b>Lieu d’exécution &amp; groupe cible</b> (≤&nbsp;200&nbsp;mots) : décrire les sites d’intervention (localisation), les communautés/bénéficiaires visés et la conservation communautaire le cas échéant.</li>
        <li><b>Contexte &amp; justification</b> (≤&nbsp;500&nbsp;mots) :
          <ul class="list-disc ml-6">
            <li>Problèmes/pressions : érosion, inondations, pollution, pertes d’habitats, risques climatiques…</li>
            <li>Causes et obstacles : facteurs anthropiques/naturels, gouvernance, capacités, financement…</li>
            <li>Approches/solutions envisagées (techniques et sociales) et pourquoi elles sont adaptées au contexte.</li>
            <li>Acteurs et ressources existants ; risques résiduels éventuels.</li>
            <li>Qui bénéficie (ou pourrait être affecté négativement) ? Qu’est-ce qui est pris en compte ?</li>
          </ul>
        </li>
      </ul>
    `
    },
    {
      title: 'Objectifs & résultats',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Objectifs</b> (≤&nbsp;200&nbsp;mots) : formuler des objectifs <b>SMART</b> (spécifiques, mesurables, atteignables, réalistes, temporellement définis) avec indicateurs de suivi.</li>
        <li><b>Résultats attendus</b> (≤&nbsp;100&nbsp;mots) : changements <b>mesurables</b> directement liés aux activités.
          <div class="mt-1">
            <b>Exemples :</b>
            <ul class="list-disc ml-6">
              <li>Amélioration de la résilience des écosystèmes riverains face aux changements climatiques.</li>
              <li>Amélioration de la qualité de l’eau de la rivière.</li>
              <li>Stabilisation accrue des berges et réduction significative de l’érosion.</li>
              <li>Accroissement de la participation communautaire et de la sensibilisation aux enjeux environnementaux.</li>
            </ul>
          </div>
        </li>
        <li><b>Durée estimée du projet</b> : indiquer la durée totale <i>(ex. 12&nbsp;mois)</i>.</li>
      </ul>
    `
    },
    {
      title: 'Activités & calendrier',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Activités principales</b> (≤&nbsp;200&nbsp;mots) : décrire les grandes lignes permettant d’atteindre les objectifs.</li>
        <li><b>Calendrier d’exécution</b> : répartir chaque activité sur les mois (M1→M12/M18/M24…) en cochant les cases correspondantes.</li>
        <li><b>Exemples d’activités</b> :
          <ul class="list-disc ml-6">
            <li>Cartographie détaillée des zones dégradées et analyse des données.</li>
            <li>Conception et planification des interventions d’ingénierie écologique (fascines, enrochements végétalisés, etc.).</li>
            <li>Plantation massive d’espèces végétales indigènes adaptées.</li>
            <li>Mise en place de zones de suivi écologique (qualité de l’eau, inventaires des espèces).</li>
            <li>Activités de sensibilisation et d’engagement communautaire.</li>
          </ul>
        </li>
      </ul>
      <p class="mt-2 text-xs text-gray-600">Assurez-vous que les activités respectent la <i>liste d’exclusion</i> FPBG (voir site FPBG).</p>
    `
    },
    {
      title: 'Risques',
      html: `
      <ul class="list-disc ml-4">
        <li>Identifier les <b>risques techniques, environnementaux, sociaux ou politiques</b> liés au projet.</li>
        <li>Décrire comment vous comptez <b>les éviter</b> ou <b>les atténuer</b> (mesures concrètes, responsables, timing).</li>
      </ul>
    `
    },
    {
      title: 'Budget estimatif',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Estimation du coût total</b> du projet : détailler les <b>grandes rubriques</b> de coût, sans granularité excessive.</li>
        <li>Indiquer les <b>cofinancements éventuels</b> (donateurs A/B), en nature ou en numéraire.</li>
        <li>Les frais de <b>fonctionnement indirects</b> peuvent être inclus à <b>hauteur maximale de 10&nbsp;%</b> du total (règle FPBG).</li>
        <li><b>Rubriques de budget</b> :
          <ul class="list-disc ml-6">
            <li>Activités de terrain</li>
            <li>Investissements</li>
            <li>Fonctionnement</li>
          </ul>
        </li>
      </ul>
    `
    },
    {
      title: 'État & financement',
      html: `
      <ul class="list-disc ml-4">
        <li><b>État d’avancement</b> du projet : Conception, Démarrage, Avancé, Phase finale.</li>
        <li><b>Financement déjà demandé/obtenu</b> : préciser bailleur(s), montant(s), statut (demandé, accordé), et informations utiles.</li>
      </ul>
    `
    },
    {
      title: 'Durabilité & réplication',
      html: `
      <ul class="list-disc ml-4">
        <li><b>Durabilité</b> : comment les effets positifs du projet seront-ils maintenus après sa fin (gouvernance, maintenance, capacités locales, modèles de gestion) ?</li>
        <li><b>Potentiel de réplication</b> : le projet est-il réplicable ailleurs au Gabon ? Dans quelles conditions (coûts, compétences, partenaires, contexte) ?</li>
      </ul>
    `
    },
    {
      title: 'Annexes',
      html: `
      <p class="mb-2">Téléverser les pièces justificatives requises (formats usuels : PDF/DOC/XLS/JPG/PNG, taille raisonnable).</p>
      <ol class="list-decimal ml-5 space-y-1">
        <li>Formulaire de Note Conceptuelle complété.</li>
        <li>Lettre de motivation du porteur de projet.</li>
        <li>Statuts et règlement intérieur (ONG/Coopératives).</li>
        <li>Fiche circuit (PME/PMI/Startup).</li>
        <li>RIB de l’organisation.</li>
        <li>Copie de l’agrément ou récépissé d’existence, ou tout document prouvant l’existence de l’entité.</li>
        <li>CV du porteur et des responsables techniques.</li>
        <li>Budget détaillé du projet.</li>
        <li>Chronogramme d’exécution.</li>
        <li>Cartographie/localisation du projet (si disponible).</li>
        <li>Lettre de partenariat ou de soutien (facultatif).</li>
      </ol>
    `
    },
    {
      title: 'Récapitulatif',
      html: `
      <ul class="list-disc ml-4">
        <li>Relire l’ensemble du dossier : cohérence <b>objectifs ↔ activités ↔ budget</b>, limites de mots respectées, pièces jointes présentes.</li>
        <li>Comparer aux critères et priorités FPBG, et corriger avant soumission si nécessaire.</li>
      </ul>
    `
    }
  ];
}
