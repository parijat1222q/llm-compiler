# LLM Compiler – Semantic Code Generator

Overview
--------

LLM Compiler is a modular code generation system that transforms natural language descriptions into scaffolded projects. It uses an AI backend (OpenAI) to interpret intent, a template-based generator (Handlebars) to render files, and a packager to bundle generated projects.

Features
--------

- Natural language input parsing (intent, entities, features)
- Template-based code generation (Express.js generator included)
- AI integration via OpenAI API
- Project packaging into zip archives
- Modular architecture for adding new generators (FastAPI, React/Next.js)

Tech Stack
----------

- Node.js + Express
- OpenAI (via HTTP)
- Handlebars templates
- Archiver for zipping
- Joi for request validation
 - Joi for request validation

Note: This initial version only generates MongoDB (Mongoose) based projects. SQLite support is planned for a future release.

Architecture
------------

Five core modules:

- input_parser — extracts structured intent from natural language
- ai_interface — talks to OpenAI
- code_generator — selects and renders templates
- project_packager — zips generated projects
- api_server — exposes REST endpoints

Setup
-----

1. Install dependencies:

   npm install

2. Copy configuration:

   cp .env.example .env
   Fill in OPENAI_API_KEY and any other variables

3. Run the server in development:

   npm run dev

API Endpoints
-------------

This project includes a generation endpoint at POST /api/generate which accepts a JSON body with at least a `description` field. See `src/routes/generation.routes.js` for details.

Response validation
-------------------

In development a response validation middleware is enabled which validates the shape of the generation API response (files array and zip object). This helps catch contract regressions during development. It's implemented in `src/middleware/responseValidation.js` and is disabled in production.

Future Roadmap
--------------

- Add FastAPI/Python generator
- Add React/Next.js frontend generator
- Add authentication, usage quotas, and rate limiting
- Add more robust testing and CI



# project discursion in details


## One-line intent
This repository is an LLM-driven code generator that turns a natural-language project description into a zipped scaffolded project (currently an Express/Mongoose app) and returns a download URL.

## High-level summary
- Purpose: Accept a free-text project description and generate a runnable project scaffold (Express + Mongoose) using an LLM to extract intent, Handlebars templates to render files, and Archiver to produce a zip.
- Main capabilities: intent extraction (AI), template-based code generation, packaging to ZIP, and an API to trigger generation and fetch the zip.
- Current constraints: generator is MongoDB/Mongoose-first (SQLite not fully supported). The generation pipeline cleans up temporary work, returning logical filenames and a download URL for the zip.

## Core modules 
- API server
  - server.js — Express app, middleware, static `/downloads` for zips, ensures `zipsDir` and `workDir` exist at startup.
  - index.js and generation.routes.js — routing and dev-only response validation wiring.
- Input and validation
  - validation.js — Joi request validation for the incoming generation request.
  - responseValidation.js — dev-only wrapper that validates outgoing response shape (non-blocking with warnings).
  - errorHandler.js — centralized error handling; reads `err.statusCode` and `err.details`.
- AI interface
  - index.js — sends prompt to OpenAI with retry/backoff logic, JSON-mode fallback, wraps errors into `HttpError` (502/503).
- Intent parsing
  - index.js — builds AI prompt, extracts JSON from the LLM output (fenced code, balanced braces), validates parsed intent with Joi, throws 422 for parse/validation errors.
- Code generation
  - index.js — dispatcher (chooses generator based on projectType).
  - express.generator.js — renders Handlebars templates to a unique temporary `workDir` folder (unique via timestamp + uuid), caches compiled templates, maps field types (including `objectid`) and supports `ref`.
  - Templates in express produce server, models, controllers, routes, package.json, README, and .env.example.
- Packaging
  - index.js — zips the generated `workDir` into `zipsDir`, supports cleanup (delete workDir) and returns `{ zipName, zipPath, size }`.
- Utilities
  - httpError.js — `HttpError(statusCode, message, details)` used across modules to preserve HTTP semantics.
  - fileSystem.js — helpers (ensureDirectoryExists, writeFileWithDir, deleteDirectory).
  - logger.js — simple structured console logger.

## End-to-end request workflow (step-by-step)
1. Client POST /api/generate (see generation.routes.js), body validated by `validateGenerationRequest`.
2. Controller `generateProject` (generation.controller.js) receives request:
   - (Previously) checked OpenAI key; now relies on `ai_interface` for authoritative checks.
3. `input_parser.parseInput(description)`:
   - Builds intent extraction prompt.
   - Calls `ai_interface.interpretIntent(prompt)`.
   - Extracts JSON from AI output: fenced ```json```, direct JSON, or first balanced {...}.
   - Runs Joi validation of parsed intent.
   - Throws `HttpError(422)` for parse/validation failures.
4. `ai_interface.interpretIntent(prompt)`:
   - Composes `messages` and calls OpenAI via axios.
   - Supports JSON-mode (`response_format`) by config flag; if OpenAI returns 400, retries once without JSON mode.
   - Retries transient errors (no status / 429 / 5xx) with exponential backoff (2^attempt * 200ms) up to maxAttempts. On exhaustion throws `HttpError(502)` with status details.
   - Throws `HttpError(503)` if API key missing.
5. `code_generator.generateCode(parsedIntent)`:
   - Validates supported DB (MongoDB only) and project type. Throws `HttpError(422)` if unsupported.
   - Calls the Express generator which:
     - Resolves `projectName`, creates unique folder under `config.workDir`.
     - Renders templates (Handlebars) into files; `mapFieldType()` maps `objectid` to `ObjectId`, templates map it to `mongoose.Schema.Types.ObjectId`.
6. `project_packager.packageProject(projectPath, projectName, { cleanup: true })`:
   - Creates zip in `config.zipsDir`, optionally deletes `workDir`.
7. Controller returns JSON:
   - `success: true`
   - `downloadUrl: /downloads/<zipName>` (top-level alias)
   - `files: [basename1, basename2, ...]` (logical names if cleanup occurred)
   - `zip: { name, url }`
8. Client fetches the zip at `/downloads/<zipName>` (static files served from `zipsDir`).

## Error handling contract
- Application exceptions intended for HTTP responses use `HttpError` (statusCode + details). The global `errorHandler` uses `err.statusCode` (or maps Joi to 400) and includes `err.details` in payload.
- AI errors map to 502; missing key maps to 503; parse/validation -> 422; bad request -> 400.

## Operational & deployment notes
- Config:
  - Environment variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_FORCE_JSON_MODE`, `ZIPS_DIR`, `WORK_DIR`, `NODE_ENV`, `PORT`.
  - `ZIPS_DIR` and `WORK_DIR` defaults and validation reside in `src/config/index.js`.
- Startup:
  - `src/server.js` ensures `zipsDir` and `workDir` exist (creates them) before mounting routes (currently created in an async IIFE; server listens immediately — consider awaiting creation before `listen()` for strictness).
- Security:
  - Keep `OPENAI_API_KEY` out of VCS; `.env` is in `.gitignore`.
  - Static `/downloads` directory serves zip files; add authentication if needed for private artifacts.
- Scale:
  - Generation calls the LLM synchronously; rate-limiting and queueing recommended for production.
  - Consider background jobs (e.g., worker + job queue) if generation is slow or heavy.

## Current limitations & risks
- Single DB backend (MongoDB) supported by generator templates — adding SQLite/Postgres requires additional templates and generator logic.
- Lack of a mocked AI mode in CI: running end-to-end tests requires network/OpenAI key; consider adding a mock provider for offline tests.
- npm audit reported vulnerabilities (transitive); address before production deployment.
- Response validation middleware is dev-only and non-blocking; contracts are enforced by convention rather than strict runtime failure.

## Good points / strengths
- Clear separation of concerns (parser, AI, generator, packager, API).
- Robust AI handling: JSON fallback, extraction strategies for messy AI outputs, retries/backoff.
- Template caching and unique project folder naming (timestamp + uuid) to avoid collisions.
- Thoughtful error mapping to HTTP semantics with `HttpError`.



## Error handling contract
- Application exceptions intended for HTTP responses use `HttpError` (statusCode + details). The global `errorHandler` uses `err.statusCode` (or maps Joi to 400) and includes `err.details` in payload.
- AI errors map to 502; missing key maps to 503; parse/validation -> 422; bad request -> 400.

## Operational & deployment notes
- Config:
  - Environment variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_FORCE_JSON_MODE`, `ZIPS_DIR`, `WORK_DIR`, `NODE_ENV`, `PORT`.
  - `ZIPS_DIR` and `WORK_DIR` defaults and validation reside in `src/config/index.js`.
- Startup:
  - `src/server.js` ensures `zipsDir` and `workDir` exist (creates them) before mounting routes (currently created in an async IIFE; server listens immediately — consider awaiting creation before `listen()` for strictness).
- Security:
  - Keep `OPENAI_API_KEY` out of VCS; `.env` is in `.gitignore`.
  - Static `/downloads` directory serves zip files; add authentication if needed for private artifacts.
- Scale:
  - Generation calls the LLM synchronously; rate-limiting and queueing recommended for production.
  - Consider background jobs (e.g., worker + job queue) if generation is slow or heavy.

## Current limitations & risks
- Single DB backend (MongoDB) supported by generator templates — adding SQLite/Postgres requires additional templates and generator logic.
- Lack of a mocked AI mode in CI: running end-to-end tests requires network/OpenAI key; consider adding a mock provider for offline tests.
- npm audit reported vulnerabilities (transitive); address before production deployment.
- Response validation middleware is dev-only and non-blocking; contracts are enforced by convention rather than strict runtime failure.


