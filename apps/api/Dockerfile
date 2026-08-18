# Stage 1: Build
FROM node:24-alpine AS builder
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
WORKDIR /app
RUN npm install -g pnpm@10.33.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter api...
RUN pnpm --filter @repo/item-display build
RUN pnpm --filter @repo/pricing-engine build
COPY apps/api/ apps/api/
# prisma.config.ts exige DATABASE_URL al cargarse; generate no toca la base: placeholder solo para este RUN
RUN cd apps/api && DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm exec prisma generate
RUN cd apps/api && pnpm build

# Stage 2: Deploy (arbol prod autocontenido del api; reemplaza el node_modules hoisted del workspace)
FROM builder AS deploy
# Sin --legacy (habilitado por injectWorkspacePackages en el workspace): el arbol sale del lockfile
# en vez de re-resolverse desde el registry. hoisted = directorios reales, mismo layout que consumia
# el runner, y hace efectivos los rm -rf de abajo (isolated solo borraria symlinks)
RUN pnpm --filter api deploy --prod --config.node-linker=hoisted /deployed
# El deploy debe traer los @repo/* resueltos con su dist, el bin de prisma, y dejar fuera las deps del web
# (react-dom no se chequea aqui: entra legitimamente como dep de @prisma/studio-core y cae con su poda)
RUN test -f /deployed/node_modules/@repo/item-display/dist/index.js \
 && test -f /deployed/node_modules/@repo/pricing-engine/dist/index.js \
 && test -e /deployed/node_modules/.bin/prisma \
 && test ! -e /deployed/node_modules/lucide-react \
 && test ! -e /deployed/node_modules/jspdf
# Poda determinista: query compilers de motores ajenos. El datasource es postgresql y el cliente
# generado solo carga query_compiler_fast_bg.postgresql.* (src/generated/prisma/internal/class.ts).
# Las podas corren en este stage y no en el runner: un rm posterior al COPY solo crea whiteouts
# y la imagen final no adelgaza.
RUN cd /deployed/node_modules/@prisma/client/runtime && rm -f \
    query_compiler_fast_bg.cockroachdb.js query_compiler_fast_bg.cockroachdb.mjs \
    query_compiler_fast_bg.cockroachdb.wasm-base64.js query_compiler_fast_bg.cockroachdb.wasm-base64.mjs \
    query_compiler_small_bg.cockroachdb.js query_compiler_small_bg.cockroachdb.mjs \
    query_compiler_small_bg.cockroachdb.wasm-base64.js query_compiler_small_bg.cockroachdb.wasm-base64.mjs \
    query_compiler_fast_bg.mysql.js query_compiler_fast_bg.mysql.mjs \
    query_compiler_fast_bg.mysql.wasm-base64.js query_compiler_fast_bg.mysql.wasm-base64.mjs \
    query_compiler_small_bg.mysql.js query_compiler_small_bg.mysql.mjs \
    query_compiler_small_bg.mysql.wasm-base64.js query_compiler_small_bg.mysql.wasm-base64.mjs \
    query_compiler_fast_bg.sqlite.js query_compiler_fast_bg.sqlite.mjs \
    query_compiler_fast_bg.sqlite.wasm-base64.js query_compiler_fast_bg.sqlite.wasm-base64.mjs \
    query_compiler_small_bg.sqlite.js query_compiler_small_bg.sqlite.mjs \
    query_compiler_small_bg.sqlite.wasm-base64.js query_compiler_small_bg.sqlite.wasm-base64.mjs \
    query_compiler_fast_bg.sqlserver.js query_compiler_fast_bg.sqlserver.mjs \
    query_compiler_fast_bg.sqlserver.wasm-base64.js query_compiler_fast_bg.sqlserver.wasm-base64.mjs \
    query_compiler_small_bg.sqlserver.js query_compiler_small_bg.sqlserver.mjs \
    query_compiler_small_bg.sqlserver.wasm-base64.js query_compiler_small_bg.sqlserver.wasm-base64.mjs \
 && test -f query_compiler_fast_bg.postgresql.wasm-base64.js
# Podas empiricas (Etapa 2): un RUN por item para restaurarlos individualmente si el smoke falla
# @prisma/studio-core NO se poda: prisma/build/cli.js hace require('@prisma/studio-core/data/bff')
# al arrancar, tambien para migrate deploy. Su cierre UI si se poda: dist/data/bff/index.cjs es
# autocontenido (cero requires externos) y react/radix/d3 son exclusivos de studio-core (pnpm why)
RUN rm -rf \
    /deployed/node_modules/@radix-ui \
    /deployed/node_modules/react-dom /deployed/node_modules/react /deployed/node_modules/scheduler \
    /deployed/node_modules/d3-array /deployed/node_modules/d3-shape /deployed/node_modules/d3-path \
    /deployed/node_modules/internmap
# De studio-core el runtime solo usa dist/data/bff; su UI react (dist/ui) sobra en la imagen
RUN rm -rf /deployed/node_modules/@prisma/studio-core/dist/ui \
 && test -f /deployed/node_modules/@prisma/studio-core/dist/data/bff/index.cjs
# @prisma/dev NO se poda: cli.js hace require('@prisma/dev/internal/state') al arrancar
# (state.cjs solo usa utils pequenas: pathe/remeda/valibot/..., ni pglite ni typescript)
RUN rm -rf /deployed/node_modules/@electric-sql
# happy-dom no se lista: no entra al arbol prod (el propio deploy lo deja fuera)
RUN rm -rf /deployed/node_modules/elkjs /deployed/node_modules/@visx
RUN rm -rf /deployed/node_modules/typescript
# effect NO se poda: es dep de require-time de @prisma/config (el CLI muere en migrate deploy sin ella)

# Stage 3: Production
FROM node:24-alpine AS runner
ENV LANG=C.UTF-8
RUN apk add --no-cache openssl
# La base trae yarn y el runtime no lo usa; nota: al vivir en una capa base, este rm crea whiteouts
# (el du dentro del contenedor baja, el tamano de pull no)
RUN rm -rf /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=deploy /deployed/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/tsconfig.json ./
RUN mkdir -p uploads/signatures uploads/templates
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
