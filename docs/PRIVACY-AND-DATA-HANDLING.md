# Audora data handling and privacy

**Status:** Current implementation note for this open-source starter. This document describes the code in this repository; it is not a legal privacy notice, a promise about third-party retention, or a substitute for an operator-specific notice and legal review.

Audora can be self-hosted or operated with external model/search providers. The operator must publish its own contact details, lawful basis, purposes, retention schedule, user-rights process, subprocessors, and jurisdiction-specific disclosures before inviting public users.

## What the current starter stores

- Conversation history and profile fields are stored in the user's browser using local storage. The profile includes display name, optional email, and optional memory text.
- These browser records do not automatically sync between devices. The starter does not currently implement accounts, password recovery, a hosted conversation database, or a central user profile.
- The browser app has controls to delete individual conversations, export chats to JSON, and import a previous JSON backup. Browser site-data clearing can also remove local history and profile data.
- The optional profile email is stored in that browser profile. The current chat request sends profile memory, not the profile name or email.

## What leaves the browser

When a user sends a prompt, Audora sends the conversation context selected by the browser, plus any attached text, to the configured inference endpoint. The provider may be a hosted API such as DeepSeek or an operator-controlled OpenAI-compatible endpoint / local Ollama server. The provider's own terms, privacy notice, and retention controls apply to data it receives.

- Text and code attachments are read in the browser and included as prompt text.
- PDF and DOCX files are parsed in the browser. Extracted text (not the original file as a separate upload) is included in the chat request. The parser libraries are downloaded from the pinned jsDelivr and esm.sh CDN URLs; the document bytes are not sent to those CDNs by this parser.
- Image attachments are sent to the configured vision-capable model as image data.
- When web search is enabled, the search query goes to the operator-configured SearXNG endpoint. Result titles, URLs, and snippets can then be forwarded to the configured model as context.
- Agent mode can send arithmetic results, the current UTC time, and optional search results back to the model as tool-result messages. Agent mode cannot run shell commands, arbitrary code, or perform external write actions.

## Server-side handling

The current starter does not write conversation history or profile records to a server-side database. The server processes chat requests to relay them to the configured provider and keeps an in-memory, per-process rate-limit map. That rate limit is not durable and is not shared between multiple server instances.

The application does not intentionally log full prompts or attachments. It logs limited operational error metadata in some failure paths. Hosting providers, reverse proxies, model providers, search providers, and other infrastructure may keep their own logs under their own policies; operators must review and disclose those policies rather than assume they retain nothing.

## Retention and deletion

- Users can delete chats in the browser UI, export conversations, and clear the site's browser data. These actions affect the local browser copy.
- There is currently no account-wide deletion endpoint, central cloud history, or deletion workflow for third-party model/search provider copies.
- If data has already been sent to a hosted model or search provider, deletion requests must be handled under that provider's current terms and controls. Audora cannot promise deletion from infrastructure it does not control.
- Operators should set and publish retention periods for application logs, backups, provider records, and search infrastructure before public launch.

## Operator launch checklist

Before public deployment, the operator should:
1. Replace this implementation note with an accurate, named privacy notice and a support/contact route.
2. Identify all inference, search, hosting, CDN, monitoring, and backup providers and review their current terms and data locations.
3. Define purpose limitation, lawful basis/consent where required, data minimization, retention periods, deletion/rights handling, incident response, and backup expiry.
4. Add authentication and server-side user isolation before storing any user data centrally.
5. Ensure secrets remain server-side, restrict access to logs, and avoid adding prompt/attachment contents to telemetry.
6. Obtain appropriate legal and security review for the jurisdictions and age groups served.

**Do not describe Audora as end-to-end encrypted, zero-retention, fully private, or centrally deletable unless the deployed architecture and every provider arrangement actually support those claims.**
