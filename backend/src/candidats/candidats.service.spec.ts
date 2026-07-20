import { Test, TestingModule } from '@nestjs/testing';
import { CandidatsService } from './candidats.service';

describe('CandidatsService', () => {
  let service: CandidatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CandidatsService],
    }).compile();

    service = module.get<CandidatsService>(CandidatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
