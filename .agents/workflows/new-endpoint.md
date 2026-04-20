---
description: endpoint nuevo
---

Al crear un endpoint nuevo, sigue esta checklist obligatoria:
1. @UseGuards(JwtAuthGuard) + @ApiBearerAuth()
2. @ApiTags con el nombre del módulo
3. ParseUUIDPipe en params de ID
4. DTO tipado con class-validator
5. Ownership check con verifyProposalOwnership o similar
6. Muéstrame el código completo del endpoint.