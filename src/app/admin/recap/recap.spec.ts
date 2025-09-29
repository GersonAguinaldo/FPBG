import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recap } from './recap';

describe('Recap', () => {
  let component: Recap;
  let fixture: ComponentFixture<Recap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
