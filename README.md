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
   # Fill in OPENAI_API_KEY and any other variables

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
