# Security policy

## Reporting

Do not open a public issue containing credentials, database URLs, private student data, question-bank contents, attachments, Provider keys, dumps or exploit details. Report security issues privately to the repository owner through the approved internal channel.

## Secrets and student data

- Commit only `.env.example` and `.env.production.example`;
- never commit `.env`, `.local`, database dumps, uploads, logs or private keys;
- use separate secrets for authentication, organization BYOK encryption, Provider access and operational endpoints;
- rotate a credential immediately if it appears in Git history or an external system;
- migration evidence must contain only schema and aggregate counts.

## Supported baseline

The current supported prerelease is `0.1.0-alpha.2` on Node.js 22 and PostgreSQL 16. This is not yet a public production support commitment.
