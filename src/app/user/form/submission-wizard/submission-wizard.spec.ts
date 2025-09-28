import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmissionWizard } from './submission-wizard';

describe('SubmissionWizard', () => {
  let component: SubmissionWizard;
  let fixture: ComponentFixture<SubmissionWizard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubmissionWizard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SubmissionWizard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
