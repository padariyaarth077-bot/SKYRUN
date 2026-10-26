# Critical credential exposure — proposed remediation, NOT executed

24 October 2026. Existing Git history contains `.env` with a hosted Supabase service-role JWT for project cudisqrugjupstgdeqac. No value is reproduced here. Network validity and repository visibility were not checked. Treat the credential as compromised until provider-side retirement is verified.

## Already done locally

Preserved local `.env`; removed its tracked/index entry; ignored `.env` variants; added empty `.env.example`. Known private value matched zero remaining tracked/new text files. No history rewrite, remote publication, rotation or configuration change. This alone does **not** revoke the old credential.

## Proposed sequence requiring separate production approval

1. Read-only inventory of hosted key types, Auth/deployment consumers and CI/build dependencies, without printing values. Include Worker server secrets, client publishable/build variables, local ignored config, external jobs/webhooks and deployment scripts. Confirm actual compatibility before changes. Once the tracked `.env` is removed, CI must explicitly receive `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` and required server build/runtime configuration; a local build using the preserved ignored file does not prove fresh CI configuration.
2. Create replacement Supabase secret/publishable keys where appropriate. Keep values in provider/Cloudflare secret storage, never chat/source/logs. Current client wrappers support opaque-key headers, but replacement-key operation still needs verification.
3. Update the backend secret and every necessary public/build consumer; rebuild/deploy the approved source and verify normal authentication/read-only health while both key systems coexist. No operational booking/deposit/email actions by default. Maintain email automation disabled.
4. After every consumer is accounted for, deactivate the compromised legacy key system using the provider-supported process and verify retirement. New API keys alone do not retire old ones. Legacy anon-key consumers may need migration too; do not blindly rotate the JWT signing secret or assume only the server is affected.
5. Separately plan any Git history cleanup/consumer notification; do not force-push, delete artifacts or rewrite shared history without explicit approval. Keep incident evidence free of secrets. Review rollback before changes; re-enabling a compromised credential is not a routine rollback.

This sequence follows [Supabase's leaked-key guidance](https://supabase.com/docs/guides/getting-started/api-keys#leaked-key) and [legacy API-key migration guide](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys). Read-only inventory may reveal additional dependencies; pause before changing the reviewed plan.

## Requested next authorization

Approve a read-only hosted credential/dependency inventory and preparation of the exact replacement/retirement plan. Actual key creation/retirement, Worker configuration/deployment and history changes remain separately gated until the inventory is reviewable. Do not paste passwords, JWTs or API keys into this chat.
