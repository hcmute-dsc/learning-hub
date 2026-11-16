# content-example

A tiny content tree in the `learning-hub-content` format (see learning-hub-docs `CONTENT-SPECIFICATION.md`).
It is used for local development (`CONTENT_SOURCE=local`) and as a parser test fixture.
The real content lives in the separate `learning-hub-content` repository.

Validate: `pnpm --filter @hub/content build && node packages/content/dist/cli.js content-example`
