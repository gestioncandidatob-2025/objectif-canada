import { Test, TestingModule } from '@nestjs/testing';
import { CandidatsController } from './candidats.controller';
import { CandidatsService } from './candidats.service';

describe('CandidatsController', () => {
  let controller: CandidatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CandidatsController],
      providers: [CandidatsService],
    }).compile();

    controller = module.get<CandidatsController>(CandidatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
