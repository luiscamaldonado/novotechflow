import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScenariosService } from './scenarios.service';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyMarginDto, UpdateScenarioItemDto } from './dto/proposals.dto';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@novotechno.com',
  role: 'COMMERCIAL',
  nomenclature: 'TST',
};

describe('ScenariosService', () => {
  let service: ScenariosService;
  let prisma: {
    scenario: { findUnique: jest.Mock };
    scenarioItem: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    // verifyScenarioOwnership consulta scenario.findUnique para llegar al
    // proposalId, delega en proposalsService.verifyProposalOwnership y pasa el
    // resultado por assertProposalNotLocked: una propuesta sin bloquear deja
    // seguir la escritura, que es lo unico que estos tests necesitan.
    prisma = {
      scenario: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'sc-1', proposalId: 'prop-1' }),
      },
      scenarioItem: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'si-1', scenarioId: 'sc-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenariosService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ProposalsService,
          useValue: {
            verifyProposalOwnership: jest.fn().mockResolvedValue({
              isLocked: false,
              proposalCode: 'COT-TST00001-1',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ScenariosService>(ScenariosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('applyMarginToEntireScenario', () => {
    it('filtra los items diluidos en el updateMany (ADR-117)', async () => {
      await service.applyMarginToEntireScenario('sc-1', 25, USER);

      expect(prisma.scenarioItem.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.scenarioItem.updateMany).toHaveBeenCalledWith({
        where: { scenarioId: 'sc-1', isDiluted: false },
        data: { marginPctOverride: 25, unitPriceOverride: null },
      });
    });
  });

  describe('updateScenarioItem', () => {
    it('con isDiluted true resetea ambos overrides aunque el payload traiga margen y precio (ADR-117)', async () => {
      await service.updateScenarioItem(
        'si-1',
        { isDiluted: true, marginPct: 30, unitPriceOverride: 999 },
        USER,
      );

      expect(prisma.scenarioItem.update).toHaveBeenCalledTimes(1);
      expect(prisma.scenarioItem.update).toHaveBeenCalledWith({
        where: { id: 'si-1' },
        data: {
          quantity: undefined,
          marginPctOverride: null,
          unitPriceOverride: null,
          isDiluted: true,
        },
      });
    });

    it('con isDiluted false resetea ambos overrides: el reset va en las dos direcciones (ADR-117)', async () => {
      await service.updateScenarioItem(
        'si-1',
        { isDiluted: false, marginPct: 30, unitPriceOverride: 999 },
        USER,
      );

      expect(prisma.scenarioItem.update).toHaveBeenCalledTimes(1);
      expect(prisma.scenarioItem.update).toHaveBeenCalledWith({
        where: { id: 'si-1' },
        data: {
          quantity: undefined,
          marginPctOverride: null,
          unitPriceOverride: null,
          isDiluted: false,
        },
      });
    });

    it('sin isDiluted en el payload deja pasar margen y precio tal cual: la via normal no cambia', async () => {
      await service.updateScenarioItem(
        'si-1',
        { marginPct: 18, unitPriceOverride: 4500 },
        USER,
      );

      expect(prisma.scenarioItem.update).toHaveBeenCalledTimes(1);
      expect(prisma.scenarioItem.update).toHaveBeenCalledWith({
        where: { id: 'si-1' },
        data: {
          quantity: undefined,
          marginPctOverride: 18,
          unitPriceOverride: 4500,
          isDiluted: undefined,
        },
      });
    });
  });
});

describe('DTOs de margen', () => {
  it('ApplyMarginDto rechaza un margen negativo con error de min (ADR-117)', async () => {
    const errors = await validate(
      plainToInstance(ApplyMarginDto, { marginPct: -25 }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('marginPct');
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('ApplyMarginDto acepta un margen de 0: el piso es inclusivo', async () => {
    const errors = await validate(
      plainToInstance(ApplyMarginDto, { marginPct: 0 }),
    );

    expect(errors).toHaveLength(0);
  });

  it('UpdateScenarioItemDto rechaza un margen negativo con error de min (ADR-117)', async () => {
    const errors = await validate(
      plainToInstance(UpdateScenarioItemDto, { marginPct: -5 }),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('marginPct');
    expect(errors[0].constraints).toHaveProperty('min');
  });
});
