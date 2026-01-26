import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageBlur } from './image-blur';

describe('ImageBlur', () => {
  let component: ImageBlur;
  let fixture: ComponentFixture<ImageBlur>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageBlur]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImageBlur);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
