# Pages + Firebase Implementation Plan

> **For agentic workers:** Use executing-plans for inline implementation. Track steps below.

**Goal:** Publish a teacher hub launcher and a Google-authenticated private diary.
**Architecture:** Static Pages frontend; existing GAS teacher tools linked when configured; Firebase Auth and Firestore for diary only.
**Tech Stack:** Native browser modules, Firebase Web SDK, Node test runner, GitHub Pages.
**Spec:** ../../deployment-design.md (user approved 2026-11-07).

## Global Constraints

- Never copy SQLite, personal backups, local credentials or tooling into the deployment.
- Users access only users/{uid}/entries. Fail closed without Firebase configuration.
- Support a repository subdirectory as the Pages root.
- Existing teacher tools remain marked as pending until their real URL is configured.

## Review Focus

Account changes during pending requests must not restore another user's text. Invalid restores must fail before any writes. Failed saves must retain input. Rules must validate updates as strictly as creates. No root-relative asset paths.

## Tasks

- [x] Test diary validation and session isolation with Node, observe failures, implement validation and a guarded request adapter.
- [x] Reuse only the existing public diary assets; replace HTTP API with Firebase adapter, add Google login/logout and account clearing, add static hub launcher and privacy information.
- [x] Add Firestore rules and negative access/schema tests; validate against emulator when tooling is available.
- [x] Build an allowlisted static distribution, scan staged public source for credentials and private data, run tests and preview browser flows. Public assets verified after Pages deployment because in-app browser could not reach host localhost.
- [x] Create Firebase project, enable Google Auth, configure authorized domains and deploy rules using the authenticated user's account.
- [x] Use user's GitHub repository, upload reviewed source, enable Pages and verify public deployment plus live auth, create/update/reload/logout. Test document cleanup verified; delete authorization tested in emulator. Real-account backup restore and second-Google-account checks remain unperformed and are documented.

## Execution notes

Ruling: use this already-empty workspace as the isolated deployment project, leaving both source projects unchanged. This is an initial repository with no commits or other work to isolate.
Ruling: proceed inline under the user's implementation request and approved architecture; use a final independent reviewer only if required by review skill.
Ruling: use Firestore Standard for the simple CRUD diary and verified free tier; no enterprise query features are needed. Seoul location explicitly approved after clarifying Cheonan is unsupported. Default database edition and location verified using CLI after deployment.
