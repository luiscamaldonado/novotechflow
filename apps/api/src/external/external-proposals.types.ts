import { Prisma } from '@prisma/client';

export const externalProposalInclude = {
  user: { select: { name: true, nomenclature: true } },
  scenarios: {
    orderBy: { sortOrder: 'asc' },
    include: {
      scenarioItems: {
        where: { parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: {
          item: { include: { supplierCompany: true, supplierContact: true } },
          children: {
            orderBy: { sortOrder: 'asc' },
            include: { item: { include: { supplierCompany: true, supplierContact: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.ProposalInclude;

export type ExternalProposalWithRelations = Prisma.ProposalGetPayload<{
  include: typeof externalProposalInclude;
}>;
