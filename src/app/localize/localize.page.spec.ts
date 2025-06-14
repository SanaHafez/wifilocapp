import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocalizePage } from './localize.page';

describe('LocalizePage', () => {
  let component: LocalizePage;
  let fixture: ComponentFixture<LocalizePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(LocalizePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
