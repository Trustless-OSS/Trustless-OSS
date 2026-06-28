# Documentation

Project-wide documentation and configuration guides.

## Table of Contents

- **[Branch Protection Setup](./branch-protection-setup.md)** — GitHub branch protection rules for CI/CD
- **[Project Plan](./plan.md)** — Hackathon plan, design, and flow diagrams

## App-Specific Documentation

- **[Backend](../apps/backend/README.md)** — Server setup, API routes, webhook handling
- **[Migrations](../apps/backend/migrations/README.md)** — Database schema and versions
- **[Frontend](../apps/frontend/README.md)** — Dashboard, pages, user flows
- **[Backend Implementation Guide](../apps/backend/docs/IMPLEMENTATION.md)** — Full code walkthrough

## Quick Links

- **Environment Variables** — See `/.env.example`
- **Development** — See main `README.md`
- **Contributing** — See `CONTRIBUTING.md`

## Directory Structure

```
docs/
├── README.md                          ← You are here
├── plan.md                            Product plan & architecture
└── branch-protection-setup.md         GitHub CI/CD protection rules

apps/
├── backend/
│   ├── README.md                      Backend setup & scripts
│   ├── migrations/
│   │   ├── README.md                  Migration guide
│   │   ├── 001_initial_schema.sql     Initial database schema
│   │   └── ...                        Future migrations
│   └── docs/
│       └── IMPLEMENTATION.md          Full code guide
└── frontend/
    └── README.md                      Frontend setup & pages
```
