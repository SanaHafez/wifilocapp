import { TestBed } from '@angular/core/testing';

import { WifilocService } from './wifiloc.service';

describe('WifilocService', () => {
  let service: WifilocService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WifilocService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
