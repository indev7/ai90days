# Data Protection, Privacy & GDPR Compliance

Combined content from DPIA documents.

## AIME_DPIA_Q1_Security_Technology_Overview.docx

AIME DPIA – Security Technology OverviewCurrent State, Planned Controls, and Key Risks
Version: 1.0    Date: 2026-01-29

This document responds to DPIA Question 1: “What is the current state of technology being used (e.g., SIEM, Vulnerability Management, PAM, Firewalls, IDS/IPS, Encryption, Endpoint Protection, DLP, web/email security tools)? Are there any concerns over this type of processing or security flaws?” It includes both the current deployment and planned AWS/Cloudflare migration controls.
A. System context (summary)
AIME is an internal workplace web application for 90‑day goal setting (OKRs/OKRTs) and execution visibility.
AIME integrates with Jira (REST API), Snowflake (KPI data), and Microsoft identity (SSO).
AIME includes an AI assistant that drafts OKRs, answers questions, and proposes actions. All write actions are presented as user Accept/Reject controls (no autonomous execution).
Planned infrastructure change: migrate application runtime to AWS (EC2) and database to AWS RDS (PostgreSQL), with Cloudflare as the WAF/perimeter.

B. State of technology controls (current and planned)
1) SIEM (Security Information and Event Management)
Current: AIME has application/runtime logs and will implement application-level audit logs for key events (AI interactions, Jira API access, Snowflake access).
Planned: Retain AIME audit logs for 1 month. Export/forward logs to the organisation’s existing log analytics/SIEM tooling if required for correlation and alerting.

2) Vulnerability Management (dependency / code security)
Current: npm audit, npm audit fix being used to avoid vulnerable libraries and update to latest libraries

Planned: The organisation uses Snyk for vulnerability management. AIME can integrate Snyk into the Next.js codebase and CI pipeline to scan open-source dependencies for known vulnerabilities (CVEs) and support timely patching.

3) PAM (Privileged Access Management)
Current: Production access is restricted to a minimal set of administrators (currently a single named administrator - Lakshitha). No shared privileged accounts are used.
Planned: After migrating to AWS, privileged access to EC2/RDS and related cloud resources will fall under the organisation’s Infrastructure/Security team governance and organisation-wide approved best practices (least privilege, controlled access, auditability, periodic access reviews, and break-glass procedures where required).
4) Firewalls (network access controls)
Current: Vercel hosting provides basic web application firewall
System is currently in a prototyping phase and the URLs are only shared among few known users for testing only.
Planned (AWS + CloudFlare): Use AWS Security Groups and network segmentation (e.g., private subnets for RDS, restricted inbound access, and limiting administrative access paths). CloudFlare will host the DNS records and also act as the Web Application Firewall.
5) IDS/IPS (Intrusion Detection System / Intrusion Prevention System)
Current: Basic protections depend on hosting provider security controls and application-level logging/monitoring.
Planned: Cloudflare WAF provides web-layer prevention controls (blocks malicious requests, bots, and common exploit patterns). Additional detection/prevention can be aligned with organisational cloud security standards (AWS-native or approved third-party controls).
6) Encryption (in transit and at rest)
In transit: TLS/HTTPS is used between client browsers and the application; integrations with Jira/Snowflake/identity/AI providers use TLS.
User, OKRT, Group data in the DB are not encrypted

7) Endpoint Protection (anti-malware / EDR)
Organisation-wide: Endpoint protection is managed at the corporate IT level (e.g., SentinelOne Endpoint Detection and Response).
The web app is also intended to be used on personal mobile devices
8) DLP (Data Loss Prevention)
Current: AIME enforces role-based access control (RBAC) to limit who can view/execute.
OKRs will remain private unless owner explicitly shares them within groups, where they become visible to group membership.
When accessing JIRA via RestAPI, only what is visible to the user in JIRA UI will be available via RestAPI.
Planned: Users need to be notified not to include data that can be classified as special category data in GDPR (such as data related to health) when creating OKRs and commenting.
9) Web/Email Security Tools
Planned: AIME may send automated notification emails (e.g., reminders or alerts). Emails will be designed to minimise data exposure by avoiding sensitive content and including only high-level notifications with secure links back to AIME, where access is controlled by SSO and role-based permissions. Outbound email will use organisation-approved mail infrastructure to reduce spoofing/phishing risk. Email delivery will be rate-limited to prevent flooding, and notification preferences will be available for non-essential messages. AIME will maintain minimal audit logs of notification events (recipient, type, timestamp) without storing unnecessary email body content.
Planned: Cloudflare WAF adds web-layer protection in front of the application.

C. Key concerns and mitigations (summary)
Workplace visibility risk: OKRs + KPIs + Jira activity can resemble monitoring if overscoped. Mitigation: strict RBAC, least privilege, auditable access, and clear non-intended use (not for performance evaluation).
Prompt Injection: AIME reduces prompt-injection risk by strictly separating user input from trusted instructions and data. The AI interaction starts from a baseline system prompt, and any additional context (OKR/KPI/Jira data or tool schemas) is augmented based on detected intent. User messages are always sent as Role: “User” and are not merged into system instructions. When business data is provided to the model, it is inserted as structured JSON within clearly delimited tags (e.g., <OKR_DATA>…</OKR_DATA>), and the model is instructed to treat it as data only (not instructions).
Over-retrieval: Mitigation: AIME’s AI assistant has no direct database access. It can only access data through server-side APIs that enforce authorization based on the currently authenticated user (RBAC and organisational scope). Each retrieval endpoint performs a permission check and returns HTTP 403 (Forbidden) when access is not permitted.
Integration risk (Jira/Snowflake): Mitigation: least-privilege OAuth scopes/read-only access for SnowFlake.

## AIME_Governance_Artifacts_v1.docx

AIME AI Governance Artifacts
Internal workplace goal-setting and execution visibility platform

Version 1.0  |  2026-01-19
Owner: AIME Product / Engineering

1. Executive overview
This document describes the governance artifacts, controls, and operational practices for AIME, an internal web application that provides visibility into organisational progress and helps staff work efficiently through AI-assisted natural language interaction. It is intended to support human decision-making and execution, not replace human judgement.
1.1 System context
Primary purpose: create transparency and a birds-eye view of progress towards Vision, Mission, and strategic priorities by unifying data sources and presenting dashboards.
AI purpose: improve efficiency (natural language query, OKRT drafting, voice-to-text, summarisation of existing records, and a chat interface for Jira operations).
No autonomous actions: all write operations are proposed and require explicit user approval via Accept/Reject buttons.
Not intended for employee performance evaluation, ranking, scoring, or profiling. Manager summaries are factual summaries of available records only.
1.2 High-level architecture and processing locations
AIME interacts with multiple systems. Processing locations include:
Application backend: Vercel serverless functions. Region: London (to be migrated to AWS EC2 in Ireland region)
Primary data store for OKRTs: Neon Postgres, London region(to be migrated to AWS Postgress RDS in Ireland)
LLM inference: Claude Haiku4.5 and Sonnet4.5 via Amazon Bedrock (Ireland).
Enterprise data sources: Jira, Microsoft (work systems), and Snowflake (company-managed tenancy and hosting).
Client-side: the mainTree data structure is assembled/held in the user browser session for responsiveness; only allowlisted subsets are transmitted for specific operations.
2. Intended purpose and non-intended uses
2.1 Intended purpose
Enable staff to define and track OKRTs (Objectives, Key Results, Tasks) aligned to organisational priorities.
Provide dashboards and drill-down views combining OKRT progress with Jira tasks and KPI indicators (via Snowflake) for supervision and tracking progress
Reduce friction in interacting with complex systems (e.g., Jira) through natural language commands that generate safe, reviewable action proposals.
2.2 Non-intended uses
No automated decision-making with legal or similarly significant effects on employees.
No employee performance evaluation, ranking, scoring, or comparison of individuals.
No recommendations for promotion, discipline, termination, compensation changes, or other HR decisions.
No covert monitoring; AIME does not infer sensitive traits (health, union membership, religion, political views) from activity or text.
3. AI-assisted features and operational constraints
3.1 Supported AI-assisted use cases
Natural language query: users can ask for tables and summaries (e.g., group-wise objective count) over data they are authorised to access.
OKRT drafting: generative AI proposes draft Objectives, Key Results, and Tasks for user review before saving.
Jira assistant: users can request creation/updates to Jira issues; AIME generates a proposed change set for user approval.
Voice-to-text dictation: converts spoken input into draft text to speed data entry.
Motivational content: AI-generated inspiration content to help users stay consistent and on track (clearly labelled as AI-generated).
3.2 Hard constraints
AIME never executes write actions automatically. Every write action is presented as one or more explicit proposals with clear labels and requires an affirmative user click to apply.
AIME politely refuses requests outside of being a OKR coach including request to know system internal details like database structure.
AIME tools (API endpoint that provide the data) enforce role-based access controls and field allowlists. The model is not trusted to self-limit access.
4. Human oversight and action control
4.1 Propose - Review - Apply pattern
User issues a request in natural language.
AIME interprets intent and retrieves only allowlisted data needed for that intent.
AIME returns a proposed change plan (action buttons)
User explicitly selects Apply for each action (or skips).
Backend executes the approved actions using authenticated service integrations and records an audit event.

5. Access control and permissions
AIME uses role-based access control (RBAC) to ensure that users can only view or modify data within their authorised scope.
5.1 Roles and typical scopes
Role
Typical read scope
Typical write scope
User
Own OKRTs, own dashboards, shared items explicitly shared with them
Own OKRTs; create proposals for Jira within their Jira permissions
Leader
Team/department OKRTs and dashboards within assigned scope
Team OKRTs within scope; approve/perform actions as permitted
Owner
Broader organisational dashboards (as configured)
Organisational configuration changes as permitted
Admin
System-wide visibility for administration
User/group management, policy settings, integrations (with least privilege)

5.2 Tool-level enforcement
All retrieval tools validate the caller identity and role scope before returning any data.
Tools return only allowlisted fields for the requested intent (e.g., IDs and progress numbers by default, not full emails or raw comment bodies).

6. Transparency and user communication
6.1 User-facing notices
AIME clearly indicates when the user is interacting with an AI assistant.
AI-generated inspirational content are labelled as AI-generated.

6.2 Explainability and traceability for summaries
Planned: Factual summaries include source references (e.g., OKR IDs, Jira filters/JQL, KPI metric and date range).
Planned: If data is missing or ambiguous, AIME states assumptions explicitly rather than fabricating.
7. Data minimisation at the LLM boundary
AIME minimises the personal data transmitted to the LLM. The primary OKRT working model (mainTree) is held in the browser session. The LLM accesses context via tools that return only the minimum allowlisted subset required for a specific intent.
7.1 Default minimisation rules
Use internal IDs instead of names/emails by default; resolve names for display in the UI layer only when needed.
Avoid transmitting raw comment bodies and long Jira descriptions unless the intent explicitly requires them.
Planned: Sanitise untrusted content (e.g., comments) before display and before inclusion in any LLM context.
7.2 Prompt injection and untrusted content handling
Treat Jira text and user comments as untrusted input.
Do not allow untrusted text to change tool parameters or permission scopes.
Apply HTML escaping/sanitisation in UI; store a plain-text representation where appropriate.

8. Planned: Logging, auditability, and retention
8.1 Audit events for AI-assisted actions
User identity and role at time of request.
Prompt (or redacted prompt) and intent classification.
Data sources accessed (OKR IDs, Jira query/JQL, KPI metric and date range).
Proposed diffs and the user decision (Apply/Skip) per action.
Execution outcome (success/failure) and timestamp.
8.2 Retention and access controls for logs
Define retention periods for chat transcripts and audit logs, aligned to internal policy and legal requirements. (Retain logs for 1 month)
Restrict access to logs to authorised admins with a legitimate operational purpose.
Support export and deletion workflows where legally required and operationally feasible.
9. Model and vendor record
LLM inference: Amazon Bedrock with Anthropic Claude Haiku 4.5 & Sonnet 4.5
Primary OKRT database: Neon Postgres (to be migrated to AWS RDS).
Application runtime: Vercel serverless functions (to be migrated to AWS EC2).
Enterprise sources: Jira, Microsoft work systems, and Snowflake (company-managed tenancy).
10. AI literacy and staff training
Provide staff guidance on safe usage: avoiding sensitive personal information in prompts.
Provide manager guidance: use fact summaries only; avoid evaluative language; do not request rankings or comparisons.
Planned: Provide a reporting channel for issues with AI outputs (incorrect data, risky suggestions, access concerns).

11. Incident response and change management (to be defined)
11.1 Incidents
Security incidents: token exposure, unauthorised access, data leakage, prompt injection attempts.
AI incidents: incorrect suggestion leading to an unintended change, or an output that violates policy (e.g., evaluative judgement).
Define escalation contacts, containment steps, and rollback procedures (especially for Jira and OKRT writes).
11.2 Change management
Version and review system prompts, tool schemas, and allowlists.
Review changes that expand data access or add new integrations (Jira/Snowflake/Microsoft).
Maintain a test suite for the no-autonomous-action rule and RBAC boundaries.
12. Testing and evaluation
Regression tests verifying that no write operation can execute without explicit user approval.
Tests for refusal policies: ranking/comparison prompts, HR decision prompts, and sensitive inference prompts.
Access control tests covering each role and scope boundary for data retrieval tools.
Prompt injection tests using untrusted text fields (Jira descriptions, comments) to ensure tool scope cannot be manipulated.
Appendix A: Sample audit log event schema
Example fields (illustrative):
event_id, timestamp, user_id, user_role
intent, prompt_redacted
sources: okr_ids[], jira_query, kpi_metric, date_range
proposals: [{system, action, target_id, before, after, decision}]
execution_results: [{target_id, status, error_code}]

## AIME_Intended_Use_and_System_Overview_v1.docx

AIME – Intended Use & System Overview
Version: 1.0    Date: 2026-01-22

1. Document purpose
This document describes the intended use, scope, core features, and high-level architecture of the AIME web application. It is intended to support internal governance, security, and compliance discussions (e.g., data protection, AI governance), and to provide a shared understanding for stakeholders (Product, Engineering, HR, Legal, Security, and Business Leadership).

2. Intended use statement
AIME is an internal web application intended for workplace goal-setting and execution visibility. It provides a unified view of organisational progress toward the company’s Vision, Mission, and strategic priorities. It supports 90‑day (quarterly) goal-setting and execution tracking by organising Objectives, Key Results, Tasks/Initiatives, and supporting artefacts, and by presenting dashboards and drill‑down views tailored to different roles across the organisation.
AIME increases visibility and transparency across teams, helps align individual and group OKRs with organisation-wide priorities, and helps each member understand how their work contributes to the wider picture. The primary aim is improved focus, coordination, and execution.
AIME includes an AI assistant to make interaction faster and simpler—by drafting OKRs, enabling natural-language queries and navigation, summarising relevant information, and proposing user-approved actions (e.g., creating or updating records in AIME or external systems such as Jira).

3. Non-intended use (explicit exclusions)
AIME is not intended to replace human judgement or to perform automated decision-making about individuals. In particular, AIME is not intended for:
Automated performance appraisal, disciplinary action, promotion decisions, or employee ranking.
Profiling employees or inferring sensitive personal attributes.
Autonomous execution of actions without user confirmation (all write operations are proposed and require user acceptance).
Monitoring beyond what is required for goal-setting, collaboration, and operational visibility.

4. Users and roles
AIME is used by internal staff. Access is role-based and aligned to the organisation’s structure and reporting lines. Permissions are granted on a least-privilege basis and may be scoped to self, team/department, or organisation-wide views depending on the role. Core roles include:
User: Default role for general staff. Provides the minimum permissions required to use AIME, including managing personal OKRs/OKRTs and viewing shared OKRs and dashboards that the user has been granted access to.
Leader: Assigned to staff with supervisory responsibilities (e.g., Team Leaders, Heads of Department, Directors, C-suite members). Provides additional visibility for managing and supporting team/department OKRs, including access to team-level dashboards and summaries within the leader’s authorised scope.
Owner: Provides access to organisation-wide dashboards and aggregated views to support strategic alignment and oversight. Access is intended for designated stakeholders who require a broader, cross-team perspective (subject to policy and permission scope).
Admin: Provides administrative capabilities required to operate and configure AIME.
List all users (fetch full user directory)
Update a user’s profile and role
Create an Organisation‑type group
Update an Organisation‑type group
Change a group’s type to “Organisation”
Delete any group (no group‑admin requirement)
In Addition to the above following rule is also enforced in Groups
The user that creates a Group becomes the Group’s Admin.  A group’s admin can perform the following:
Add/Remove members from group
Choose a subset of Strategic Objectives from objectives that are shared within that group

5. Core product modules
My OKRs: Create and manage personal OKRs/OKRTs, tasks, progress updates, and notes.
Scheduling: Enable planing, organising and time blocking of tasks. Shows calendar events
Shared / Group OKRs: View and collaborate on team/department OKRs and shared objectives. See what other members have shared
Strategy House View: Connect OKRs to strategic priorities and provide a top‑down view of alignment.
Organisation chart: Provide organisational context for teams and collaboration scope.
Chat (AIME AI Assistant): Natural language interface for drafting, querying, navigation, and proposing actions.

6. AI use cases in AIME
Drafting and refining OKRs
Expand ideas into an achievable Objective with measurable Key Results and actionable Tasks/Initiatives.
Example: “Can you suggest an Objective and Key Results to achieve financial freedom?”
Natural language navigation and system operations
Navigate AIME modules and retrieve relevant views using conversational commands.
Propose CRUD actions (create/update/delete) with clear Accept/Reject confirmation before execution.
Example: “Navigate to Shared OKRs and show objectives of the HR department.”
Cross-source search and structured queries
Query across OKRs, initiatives, and KPI datasets to generate summaries and tables.
Example: “Tabulate shared Objective titles, owner name, and percentage completion, ordered by owner.”

Work-system assistant for Jira and enterprise tools
Retrieve and summarise Jira items; draft proposed updates; propose ticket creation and assignment with user approval.
Example: “List my pending Jira tickets.”
Voice-to-text
Convert dictation into queries, updates, and draft OKRs to reduce typing time.
Motivational and educational content
Generate and present inspirational content to encourage consistency and follow-through in the 90‑day cycle.
AI-generated content is labelled (“Includes AI Generated Content”).215900302259Figure 1: “AI Generated Content Included” Lebel
Figure 1: “AI Generated Content Included” Lebel

7. Human oversight and action control
AIME follows a human-in-the-loop pattern for write operations. The AI assistant may propose actions (e.g., create/update records in AIME or create/update Jira items), but actions are not executed automatically. Users are shown clear Accept/Reject controls describing the effect of the action.
Minimum controls include:
All external-system writes (e.g., Jira updates) require explicit user confirmation.
All AIME data writes via AI require explicit user confirmation.361950302259Figure 2: All AIME Generated actions have “Accept” buttons
Figure 2: All AIME Generated actions have “Accept” buttons

Role-based access control (RBAC) is enforced server-side for all data retrieval and proposed actions.
Audit logs record proposals and approvals (who requested, what data was accessed, what was approved).

8. High-level architecture overview
AIME consists of a web UI, an application backend, an internal database for OKR data, integrations to enterprise systems, and an LLM-based assistant. The diagram below provides a high-level overview.

Figure 3: AIME Web App Overview (high-level architecture)
Figure 3: AIME Web App Overview (high-level architecture)

9. Data sources and integrations
AIME uses the following data sources:
AIME database (Neon Postgres): Stores OKRTs, groups, users, time blocks, comments, and related internal metadata. Hosted in the London region.
Jira: Work management system used for tickets and operational execution tracking. Accessed via Jira REST APIs (read and proposed updates).
Microsoft work tools: Calendar and related organisational data used for context (subject to permission scope and availability).
Snowflake: KPI statistics and warehouse data used for performance tracking at group/org level and for dashboards (read-only snapshots as needed).

10. Processing locations (high-level)
AIME processes data across several components. Storage and query execution occur in the database region (Neon Postgres – London). Application logic is executed in Vercel-hosted Next.js API functions (regions: London, optionally Dublin). LLM inference is performed via Anthropic messaging API hosted by Anthropic ( Amazon Bedrock to be considered going forward). Users access AIME from browsers in various locations; client-side rendering and interaction occur on user devices.

11. Data categories and minimisation approach
AIME processes typical employee work data and identifiers (e.g., names, work email, role/team membership), OKR content, and work activity references (e.g., Jira ticket identifiers and statuses). The system is designed to follow data minimisation principles, including:
Retrieving only the minimum data required for a user’s request.
Using internal IDs where possible and limiting exposure of direct identifiers to the AI assistant unless necessary.
Applying role-based scoping so users only access permitted data (self/team/org scope).
Labeling AI-generated content and presenting drafts for review.

12. Items Under Consideration  /  To-Do
Hosting and infrastructure: Evaluate migrating the application runtime and database from Vercel/Neon to AWS(including networking, security controls, and operational ownership).
LLM platform: Integrate the AI assistant via Amazon Bedrock (model selection, region configuration, and data handling controls).
KPI integration: Implement read-only integration with Snowflake to retrieve agreed KPI datasets for dashboards and progress tracking.
AI interaction logging: Design and implement a logging/audit mechanism for AI interactions (requests, data accessed, proposals, user approvals/rejections, and retention).
Feedback, complaints, and defect tracking: Establish a formal mechanism for user feedback and complaints, plus a defect tracking workflow (e.g., Jira project/queue, triage process, and SLAs/ownership).

Appendix A: Glossary
OKR / OKRT: Objectives and Key Results (and Tasks, where used).
KPI: Key Performance Indicator.
RBAC: Role-Based Access Control; permission rules based on role and scope.
LLM: Large Language Model used to assist with drafting, querying, and proposed actions.
Human-in-the-loop: Design where users approve proposed actions before execution.

## AIME_Privacy_Policy.docx

AIME Privacy Policy
Last updated: 2026-01-29  (Draft)

This Privacy Policy explains how AIME web application collects, uses, shares, and protects personal data when you use AIME, our internal workplace goal-setting and execution-visibility application.
1. Who this policy applies to
AIME is intended for internal use by Intervest staff (and, where applicable, affiliated group companies). This policy applies to authorised users who access AIME.
2. Controller and contact details
Intervest is the controller for personal data processed in AIME.
Intervest (Pvt) Ltd
Data Protection Officer, Risk & Compliance Department
Level 23, 324 Havelock Road, Colombo 006, Sri Lanka
Email: info@intervest.lk
Phone: +94 112 081 880
If your local entity is a joint controller for certain processing, we will provide a supplemental notice where required.
3. What data AIME processes
AIME may process the following categories of personal data:
Account and identity data: name, work email   / login identifier, employee identifier (if used), authentication/session identifiers.
Organisation data: department/team, role (User/Leader/Owner/Admin), reporting line and organisational structure attributes needed for role-based access control (RBAC).
Goal and collaboration data: objectives, key results, tasks/initiatives, time blocks, progress updates, comments, and related timestamps and ownership.
Usage and technical data: IP address, device/browser information, login events, and diagnostic logs (to secure and operate the service).
Integration references (where enabled): identifiers and metadata from Jira and KPI systems (e.g., issue keys, assignee identifiers, KPI identifiers), scoped by permissions.
4. Special category data and sensitive information
AIME is not designed for recording special category data (e.g., health information, biometrics, religious or political beliefs, trade union membership, sexual orientation). Users should not enter such information into AIME free‑text fields (e.g., comments) or into Jira tickets via AIME. If such data is incidentally included, we will minimise processing, restrict access, and handle it in line with applicable law.
5. How we collect data
Directly from you when you create or update goals, tasks, comments, and time blocks.
From enterprise systems you already use, when you connect AIME (e.g., Microsoft SSO for identity; Jira for ticket information; Snowflake or KPI sources for reporting), scoped by permissions.
Automatically through system operation (security logs and technical telemetry).
6. Purposes of processing
We process personal data in AIME to:
Provide AIME’s functionality for 90‑day goal planning, tracking, dashboards, and collaboration.
Enforce security and access control (authentication, RBAC, fraud/abuse prevention).
Integrate with workplace systems (e.g., Jira for work items and Snowflake/KPI sources for reporting), where enabled.
Provide an AI-assisted interface to draft OKRs, answer questions, and propose actions to save time (with user Accept/Reject controls).
Operate, troubleshoot, and improve AIME (including defect handling and service reliability).
7. Lawful bases (EU/UK)
Where EU/UK data protection laws apply (e.g., GDPR / UK GDPR), we rely on one or more lawful bases, depending on the processing context:
Performance of a contract / workplace administration (Art. 6(1)(b)): operating internal tools that staff use as part of their work.
Legitimate interests (Art. 6(1)(f)): operating, securing, and improving AIME, and providing execution visibility and coordination across teams, balanced against user rights and expectations.
Legal obligation (Art. 6(1)(c)) where applicable: responding to data subject rights requests or compliance obligations that apply to Intervest.
If we ever need to rely on consent, we will request it explicitly and you may withdraw it at any time.
8. AI features and human oversight
AIME includes an AI assistant to help users draft OKRs, summarise information, and interact with AIME and connected systems using natural language.
Human-in-the-loop: The AI assistant may propose changes (e.g., create/update OKRs or Jira tickets), but actions are only executed after explicit user approval (Accept/Reject).
Data minimisation for AI: The assistant is designed to retrieve and send only the data required to answer a user’s request, and it does not have direct database access.
No autonomous decision-making: AIME is not intended to make automated decisions about individuals (e.g., hiring, disciplinary action, or performance evaluation).
AI-generated content: Where AIME displays AI-generated inspiration or text, it will be labelled (e.g., “Includes AI Generated Content”).
9. Sharing and processors
We may share personal data with authorised service providers (processors) to operate AIME, subject to contractual safeguards and access controls. Depending on configuration, this may include:
Hosting and infrastructure providers (e.g., Vercel today; AWS planned).
Database providers (e.g., Neon Postgres today; AWS RDS planned).
AI inference provider (e.g., Amazon Bedrock and underlying model provider, if enabled).
Enterprise systems and integrations (e.g., Atlassian Jira; Microsoft identity/SSO; Snowflake for KPI data), limited to what is required and authorised.
Security, monitoring, and vulnerability management tools (e.g., Snyk), where adopted.
We do not sell personal data and we do not use AIME for advertising or cross-site tracking.
10. International transfers
If personal data is accessed or processed outside the country/region where it originated (for example, EU/EEA users’ data processed in the UK or elsewhere), we will implement appropriate safeguards as required by applicable law. This may include contractual clauses, transfer impact assessments, and vendor controls.
11. Retention
We retain personal data only as long as necessary for the purposes described in this policy, including security, contractual, and legal requirements. Typical retention periods (subject to organisational policy) may include:
Goals/OKRs and related metadata: retained for operational history and planning purposes, then archived or deleted in line with retention schedules (retained up to one year)
Audit/security logs: retained for a limited period to support security monitoring and incident investigation (one month).
Integration references (Jira/KPI): we avoid duplicating source-system data unnecessarily and may occasionally cache them temporarily to improve application speed.
Specific retention values will be documented in AIME’s retention schedule and Record of Processing Activities (RoPA).
12. Security
We implement administrative, technical, and organisational measures to protect personal data, including:
Authentication via Microsoft SSO and role-based access control (RBAC) aligned to organisational structure.
Encryption in transit (TLS) and encryption at rest through managed service controls.
Access logging/audit trails for key actions (including AI proposals and approvals, where configured).
Least privilege access to integrations (scoped tokens) and secure secrets management.
Vulnerability management (e.g., dependency scanning) and patching practices.
13. Your rights
Where applicable data protection laws grant you rights, including access, rectification, erasure, restriction, objection, and data portability. To exercise these rights, contact the Data Protection Officer using the details above. We will respond within legally required timeframes.
14. Cookies and similar technologies
AIME uses essential cookies for authentication/session security and, where applicable, Microsoft SSO. AIME does not use cookies for advertising or cross-site tracking. Please refer to the AIME Cookie Use Policy for details.
15. Updates to this policy
We may update this policy from time to time to reflect legal, operational, or technological changes. The updated version will be made available within AIME (or via the relevant internal policy repository) with a revised “Last updated” date.
16. Questions and complaints
If you have questions or concerns about this policy, or wish to exercise your data protection rights, please contact:
Data Protection Officer, Risk & Compliance Department
Intervest (Pvt) Ltd, Level 23, 324 Havelock Road, Colombo 006, Sri Lanka
Email: info@intervest.lk
Phone: +94 112 081 880

## Annex_RoPA_AIME_Updated_v1_1.docx

Annex: Record of Processing Activities (RoPA) — AIME (Updated Draft)
Version: 1.1    Date: 2026-01-30
This annex provides a draft Record of Processing Activities (RoPA) for AIME, intended to support GDPR Article 30 documentation. Items marked [TBD] should be completed/confirmed by the organisation (Legal/Privacy/Security/IT).
A. Controller details (applies to all activities)
Controller
Intervest (Pvt) Ltd
Contact (privacy)
Data Protection Officer, Risk & Compliance Department
Address
Level 23, 324 Havelock Road, Colombo 006, Sri Lanka
Email
info@intervest.lk
Phone
+94 112 081 880
DPO (if applicable)
[TBD / Not applicable depending on legal requirement]
Main countries of use
UK, Spain (EU), Gibraltar, Sri Lanka [confirm]
Joint controllers (if any)
None (internal tool) [confirm]
B. Data flow and locations (summary)
The table below captures key locations for storage and processing. Confirm regions and tenancy for each connected system.
Component
Data stored where
Data processed where
Access (who/what)
Notes / transfers
AIME Web/App runtime
N/A
Current: Vercel (regions [TBD]); Planned: AWS EC2 (region [TBD])
Users via SSO; admins; backend services
If EU users’ data is processed outside EU/EEA, apply safeguards.
AIME Database
Current: Neon Postgres (London); Planned: AWS RDS PostgreSQL (region [TBD])
Backend reads/writes via authorised APIs
Backend service accounts; admins per policy
Treat DB region as storage location; processing also occurs in app runtime and AI service.
AI Inference
Vendor-dependent
Planned: Amazon Bedrock (region [TBD]) and underlying model provider
AIME backend invokes model; users initiate requests
Select region(s) to minimise cross-border transfer; SCC/TRA if required.
Atlassian Jira
Atlassian tenant region [TBD]
Jira REST API operations via OAuth
On behalf of logged-in user; scoped permissions
Avoid duplicating Jira content; field allowlists for AI.
Snowflake (KPI)
Snowflake account region [TBD]
Read-only queries via authorised integration
AIME backend; authorised users via RBAC
Prefer aggregates; document if individual-linked KPIs are used.
Microsoft Identity (SSO)
Microsoft tenant region [TBD]
Authentication/claims issuance
Users; identity admins
Sign-in/audit logs available in Entra ID; confirm retention/export.
C. Processor / vendor register (summary)
Maintain a processor register for vendors involved in operating AIME. Confirm contracts/DPAs and sub-processor lists.
Vendor
Role
Service
Region(s)
DPA status
Notes
Vercel
Processor
Hosting/runtime (current)
[TBD]
[TBD]
Planned migration to AWS.
Neon
Processor
Database (current)
London (UK)
[TBD]
Postgres storage for OKR data.
AWS
Processor
Hosting/DB/Logs (planned)
[TBD: e.g., eu-west-1]
[TBD]
EC2 + RDS + CloudWatch/CloudTrail.
Cloudflare
Processor
WAF/edge security (planned)
[TBD]
[TBD]
WAF/rate limiting/bot protection; logs if enabled.
Amazon Bedrock / model provider
Processor/Sub-processor
AI inference (planned)
[TBD]
[TBD]
Confirm model training/retention settings.
Atlassian Jira
Processor
Work management integration
[TBD]
[TBD]
OAuth scopes; auditability varies by plan.
Snowflake
Processor
Data warehouse integration
[TBD]
[TBD]
Read-only; prefer aggregates.
Microsoft
Processor
SSO/identity
[TBD]
[TBD]
Entra ID sign-in and audit logs available.
Snyk
Processor
Vulnerability management (optional)
[TBD]
[TBD]
Dependency scanning in CI/CD.
D.1 Processing activity: Account access, authentication, and user profile management
Purpose(s) of processing
Authenticate users (Microsoft SSO where enabled), manage sessions, and maintain user profiles, roles, and organisation hierarchy data required to operate AIME and enforce access controls.
Lawful basis (GDPR Art. 6)
Primary: Art. 6(1)(b) (workplace administration) and/or Art. 6(1)(f) legitimate interests (secure operations). Where relying on 6(1)(f), complete/maintain a Legitimate Interests Assessment (LIA).
Data subjects
Employees/internal staff users; administrators.
Categories of personal data
Work identifiers (name, work email/UPN), role, team/department, permissions, authentication/session metadata, timestamps.
Special category data (GDPR Art. 9)
Not intended. If included incidentally, minimise processing and restrict access and retention.
Data sources
Microsoft Entra ID (identity claims), admin input for roles/hierarchy.
Recipients (internal) / processors (external)
Internal: authorised admins for user/role management; leaders within scope (role-based). External: hosting/runtime provider; database provider; Microsoft (SSO).
International transfers & safeguards
Confirm regions for hosting/runtime and support access. If EU/EEA users’ personal data is processed outside EU/EEA, use appropriate transfer safeguards (e.g., SCCs) and conduct a Transfer Risk Assessment (TRA) where required. Document any cross-border admin/support access.
Retention / deletion
Account retained while employed; deactivate on exit; delete/anon after [TBD] per HR/IT policy. Proposed: retain security/audit logs for 30–90 days depending on organisational policy [confirm].
Security measures (high level)
SSO + MFA (per org policy), RBAC, least privilege, encryption in transit/at rest, secure secrets management, admin audit logs.
Notes / open items
Confirm runtime regions; confirm Entra log export/retention and admin access process.
Evidence / artefacts (where documented)
Access control matrix; SSO configuration; admin/user management SOP; audit logging spec.
D.2 Processing activity: OKR/OKRT creation, updates, collaboration and dashboards (AIME core)
Purpose(s) of processing
Enable staff to create and manage Objectives, Key Results, Tasks/Initiatives, time blocks, progress updates, and comments; provide dashboards and role-scoped visibility to support alignment and execution.
Lawful basis (GDPR Art. 6)
Primary: Art. 6(1)(b) and/or Art. 6(1)(f). Where using 6(1)(f), maintain an LIA balancing workplace context risks.
Data subjects
Employees/internal staff; leaders/owners/admins (within permitted scope).
Categories of personal data
Work identifiers, role/team membership, OKR content, progress updates, comments, timestamps, ownership/assignments.
Special category data (GDPR Art. 9)
Not intended. Control: user notice not to include special category data in OKRs/comments; consider UI warnings and AI prompt minimisation/redaction.
Data sources
Direct user input; organisation structure; derived metrics (completion/percentages).
Recipients (internal) / processors (external)
Internal: self/team/org dashboards based on RBAC; authorised admins. External: hosting/runtime provider; database provider.
International transfers & safeguards
Document data flow mapping across regions for EU users and any cross-border support access; apply safeguards where required.
Retention / deletion
Proposed: retain OKR/OKRT records for 2–3 years for planning/history, then archive (read-only) or delete per policy [confirm].
Security measures (high level)
RBAC (self/team/org), encryption, access reviews, secure backups; audit logs for admin actions and data exports where applicable.
Notes / open items
Define final retention schedule and archiving process; implement DSAR export for user data.
Evidence / artefacts (where documented)
Data model documentation; RBAC rules; retention schedule; DSAR procedure.
D.3 Processing activity: AI assistant: drafting, summarisation, Q&A, and natural language navigation
Purpose(s) of processing
Provide productivity assistance: draft OKRs, generate structured summaries, answer queries, and navigate AIME features. AI proposes actions but does not execute them without user approval.
Lawful basis (GDPR Art. 6)
Primary: Art. 6(1)(b) and/or Art. 6(1)(f). Where using 6(1)(f), maintain an LIA; confirm no automated decision-making with legal or similarly significant effects (Art. 22).
Data subjects
Employees/internal staff users; leaders/owners/admins (within permitted scope).
Categories of personal data
User prompts and selected context; role/team scope; OKR/KPI/Jira references necessary to fulfil the request. Minimise identifiers shared to the model where possible.
Special category data (GDPR Art. 9)
Not intended. Controls: user notice; avoid sending unnecessary free-text fields to AI; allowlists/redaction; exclude known sensitive fields (e.g., leave reasons/notes) from AI context.
Data sources
User prompts; tool-based retrieval from AIME DB and connected systems (scoped).
Recipients (internal) / processors (external)
Internal: authorised users and admins via AIME UI; External: AI service provider (Amazon Bedrock and underlying model provider); hosting/runtime; database provider.
International transfers & safeguards
Select AI inference region(s) appropriate for EU/EEA users where feasible. If EU/EEA personal data is processed outside EU/EEA, apply SCCs and complete a TRA where required. Document vendor terms regarding data retention and model training; configure accordingly.
Retention / deletion
Proposed: retain AI interaction logs/traces for 30 days (minimum necessary) [confirm]. Store minimal audit metadata where possible; avoid retaining full prompts/ticket bodies unless needed for support/security.
Security measures (high level)
Tool allowlists; server-side permission checks (403 on unauthorised access); no direct DB access; human-in-the-loop Accept/Reject for writes; audit logs for tool calls and approvals.
Notes / open items
Confirm Bedrock region and retention/training settings; implement guardrails for profiling/performance evaluation.
Evidence / artefacts (where documented)
System prompt policy; tool schemas; audit log spec; AI usage policy; UI labels for AI-generated content.
D.4 Processing activity: Jira integration (read and proposed updates via user approval)
Purpose(s) of processing
Retrieve tickets/status, draft proposed updates, and propose ticket creation/assignment via natural language. All write operations require user Accept/Reject approval.
Lawful basis (GDPR Art. 6)
Primary: Art. 6(1)(b) and/or Art. 6(1)(f).
Data subjects
Employees/internal staff; Jira users referenced in tickets (within permission scope).
Categories of personal data
Jira account identifiers, ticket metadata (assignee/reporter), and work activity content contained in tickets.
Special category data (GDPR Art. 9)
Not intended. Controls: user notice; field allowlists; avoid sending sensitive ticket fields to AI (e.g., leave reasons/notes).
Data sources
Jira REST APIs under authorised access; user prompts.
Recipients (internal) / processors (external)
Internal: authorised AIME users; admins/support. External: Atlassian (Jira); AI provider only where ticket data is sent under minimised scope.
International transfers & safeguards
Depends on Jira tenant region and AIME/AI regions; document in data flow mapping; apply safeguards where required.
Retention / deletion
Prefer not to store Jira content beyond what is necessary; caching/retention [TBD]; audit logs of actions/approvals retained per audit schedule.
Security measures (high level)
OAuth/secure tokens, least-privilege scopes, RBAC, action approvals, audit logging of proposed/approved changes.
Notes / open items
Confirm Jira tenancy/plan and available audit logs; implement strict allowlist for Jira fields provided to AI.
Evidence / artefacts (where documented)
Integration design doc; OAuth scope list; audit logging for Jira operations.
D.5 Processing activity: KPI integration (Snowflake) and analytics dashboards
Purpose(s) of processing
Retrieve KPI datasets to support execution visibility and enable users to query metrics relevant to goals and initiatives.
Lawful basis (GDPR Art. 6)
Primary: Art. 6(1)(f) and/or Art. 6(1)(b).
Data subjects
Employees/internal staff (where KPIs relate to individuals) and teams/units.
Categories of personal data
KPI values linked to individuals or teams; identifiers where required; aggregates where possible.
Special category data (GDPR Art. 9)
Not intended.
Data sources
Snowflake datasets (read-only) via authorised access; AIME DB links between KPIs and groups/users (if implemented).
Recipients (internal) / processors (external)
Internal: authorised users per RBAC; admins/support. External: Snowflake; AI provider only if necessary and minimised.
International transfers & safeguards
Depends on Snowflake region and hosting/AI regions; document and apply safeguards where EU data leaves EU/EEA.
Retention / deletion
Prefer not to store raw KPI extracts; store minimal snapshots/aggregates where necessary; retention per policy [TBD].
Security measures (high level)
Read-only integration, RBAC scoping, aggregation where possible, audit logs for access to individual-linked KPIs.
Notes / open items
Clarify KPIs are not used for automated performance evaluation; maintain manager guidance for summaries.
Evidence / artefacts (where documented)
KPI integration doc; RBAC rules; audit log spec for KPI queries.
D.6 Processing activity: Audit logging, security monitoring, and support/defect handling
Purpose(s) of processing
Maintain security and accountability: log key actions (including AI proposals and approvals), support troubleshooting, and manage incidents/defects.
Lawful basis (GDPR Art. 6)
Primary: Art. 6(1)(f) legitimate interests (security and accountability).
Data subjects
All users; administrators; support personnel.
Categories of personal data
User IDs, timestamps, access events, action approvals, limited request metadata; avoid storing unnecessary content.
Special category data (GDPR Art. 9)
Not intended; avoid logging sensitive free text.
Data sources
Application logs, audit events, WAF/security logs (if enabled), support tickets [TBD].
Recipients (internal) / processors (external)
Internal: authorised admins/support. External: hosting/runtime; monitoring/log tooling [TBD].
International transfers & safeguards
Depends on log storage locations and support access locations; apply safeguards if EU logs are accessed outside EU/EEA.
Retention / deletion
Proposed: retain security/audit logs for 30–90 days depending on organisational policy [confirm].
Security measures (high level)
Restricted access to logs, encryption, monitoring, incident response process, periodic review.
Notes / open items
Define logging fields and redaction; set final retention; implement complaints/defect workflow and incident playbook.
Evidence / artefacts (where documented)
Logging policy; incident response runbook; complaint handling SOP.
D.7 Processing activity: Data subject rights (DSAR) handling and exports
Purpose(s) of processing
Respond to GDPR/UK GDPR data subject rights requests and provide relevant exports within scope.
Lawful basis (GDPR Art. 6)
Art. 6(1)(c) (legal obligation where applicable) and/or Art. 6(1)(f) accountability.
Data subjects
Users exercising GDPR/UK GDPR rights.
Categories of personal data
User account/profile data, OKR/OKRT content, relevant logs within scope, and metadata required to fulfil the request.
Special category data (GDPR Art. 9)
Not intended; handle cautiously if present incidentally.
Data sources
AIME DB; audit logs; integration references; admin records.
Recipients (internal) / processors (external)
Internal: authorised privacy/admin staff only.
International transfers & safeguards
Keep DSAR processing within EU/EEA/UK where feasible; document any cross-border support access.
Retention / deletion
Proposed: retain DSAR case records for [TBD] years per compliance policy.
Security measures (high level)
Access controls, secure storage of exports, identity verification, tracking timelines and responses.
Notes / open items
Implement DSAR workflow and assign responsibilities; confirm response timelines and escalation.
Evidence / artefacts (where documented)
DSAR procedure; request intake form; export format spec.
E. Client-side caching (mainTree)
AIME uses a client-side cached data structure (“mainTree”) in the user’s web browser. This cached data is treated as personal data where it contains identifiers or user-specific workplace context. Controls include authentication, session security, and RBAC-scoped API responses so that the browser only receives data the user is authorised to access. The AI assistant does not have direct access to the client cache; data is supplied to the model only via backend tool-based retrieval under server-side permission checks.

## Cookie_Use_Policy.docx

AIME Cookie Use Policy

Last updated: 2026-01-19

We use cookies  to keep you signed in, protect your account, and support single sign‑on (SSO). We do not use cookies for advertising or cross‑site tracking.
What cookies we use
Essential cookies (required)
sid – Authentication session cookie used to keep you signed in and identify your account.
Purpose: login/session security
Type: first‑party, httpOnly
Retention: up to 7 days (or until you log out)

SSO cookies (if you sign in with Microsoft)
next-auth.session-token – Maintains the Microsoft SSO session.
next-auth.csrf-token – Protects the SSO login flow from cross‑site request forgery.
Purpose: SSO authentication/security
Type: first‑party, httpOnly
Retention: session or short‑lived (as set by NextAuth)

How we use cookies
Authenticate users and keep sessions secure.
Enable Microsoft SSO when used.
We do not use cookies for analytics, marketing, or profiling.
Your choices
You can clear cookies in your browser settings. If you do, you may be logged out and need to sign in again.
Contact
If you have questions about our cookie use, contact us at [CONTACT EMAIL].

## EU_AI_Act_Regulation_2024_1689_AIME_Compliance_Approach.docx

EU AI Act — Regulation (EU) 2024/1689AIME Compliance Approach (Draft)
Version: 1.0    Date: 2026-01-23

This document describes how AIME addresses key obligations and expectations relevant to the EU AI Act (Regulation (EU) 2024/1689). It is written for internal governance and should be reviewed and updated as AIME’s feature set, deployment footprint, and user base evolve.

System summary (for AI Act context)
AIME is an internal workplace system for 90-day goal-setting (OKRs/OKRTs) and execution visibility.
AIME integrates with enterprise systems (e.g., Jira, Microsoft work tools, and KPI sources such as Snowflake).
The AIME AI assistant supports drafting, querying, navigation, and proposing actions.
Human-in-the-loop control: AI proposes actions; users approve via Accept/Reject before execution.
AIME labels AI-generated inspirational content (“Includes AI Generated Content”) and can extend similar labels to drafts/summaries.

1) Scope / Does it apply to AIME?
AIME is considered in-scope for the EU AI Act where it is put into service or used in the EU, including when staff located in the EU (e.g., Spain) use AIME as an internal workplace tool. If AIME is not used in the EU, this section is maintained as a best-practice alignment reference.
AIME approach
Maintain an internal record of the countries where AIME is used (e.g., UK, Spain/EU, Gibraltar, Sri Lanka).
Maintain a description of intended purpose and non-intended use to support scoping and risk assessment. (This is included in Attached document “AIME_Intended_Use_and_System_Overview_v1”)
Review scope when enabling new features (e.g., automated recommendations, scoring, or expanded analytics).
Status
Current: Spain/EU usage is possible; treat AIME as potentially in-scope and align controls accordingly.
Planned: Formalise the EU usage register and update when new user groups are onboarded.

2) Role (Provider vs Deployer)
For the AIME AI system as delivered to internal staff under the AIME name, the organisation acts as both a Provider (putting AIME into service under its name) and a Deployer (using it internally under its authority). For underlying third-party AI services (e.g., Amazon Bedrock and the selected model), AIME is a Deployer of those services.
AIME approach
Define ownership for AI governance: product/engineering owns design controls; HR/IT/security owns acceptable use, access governance, and oversight.
Maintain vendor records for third-party AI services (model family/version, region, data handling commitments, and configurations).
Status
Current: AIME team controls prompts, tool schemas, RBAC enforcement, and the Accept/Reject action pattern.
Planned: Publish a RACI table mapping responsibilities for provider vs deployer obligations.

3) Risk classification (Limited-risk vs High-risk triggers)
AIME is designed to be a productivity and visibility tool. The primary goal is alignment and execution support, not automated decision-making about individuals. Workplace AI can become high-risk if used for employment decisions or worker management decisions that materially affect individuals (e.g., ranking, promotion/discipline recommendations). AIME therefore aims to remain in a limited-risk posture by design and by policy.
High-risk triggers AIME avoids
Employee ranking, scoring, or automated assessment of performance.
Automated recommendations for disciplinary action, promotion, termination, or compensation decisions.
Profiling employees or inferring sensitive personal attributes.
AIME approach
Intended use and non-intended use statements explicitly exclude performance appraisal and ranking.
Fact-only summaries: AIME reports available data and avoids judgemental language.
Refusal rules: AIME refuses prompts that request ranking/comparison of employees or evaluative conclusions.
Human-in-the-loop approvals prevent autonomous execution of actions.
Status
Current: Non-intended use is documented; AI does not execute actions without user approval.
Planned: Add explicit refusal patterns and tests for ranking/comparison prompts; add manager-specific guidance.

4) Transparency duties (AI interaction disclosure, labeling)
AIME ensures users understand when they are interacting with AI and when content is AI-generated. Where AI outputs may influence user action (e.g., proposed CRUD operations), AIME provides clear presentation and confirmation controls.
AIME approach
AI interaction disclosure: Chat and AI-assisted features indicate that an AI assistant is being used.
AI-generated content labeling: AIME labels AI-generated inspirational content; extend labels to OKR drafts, summaries, and proposed actions.
User guidance: Prominent reminder that AI outputs may be incorrect and should be verified before acceptance.
Status
Current: Daily Inspiration includes “Includes AI Generated Content” label.
Planned: Apply consistent labels to OKR drafting, summaries, and action proposals; add UI text for verification and accountability.

5) Prohibited practices (what AIME must not do)
AIME is designed to avoid prohibited or unacceptable uses in a workplace context, including manipulative behaviour, exploitation of vulnerabilities, or social scoring/ranking patterns. The assistant should not attempt to infer or use sensitive traits.
AIME approach
Prohibit ranking/scoring of individuals or requests framed as ‘underperformers’ or punitive judgments.
Prohibit inference of sensitive attributes (health, religion, political opinions, etc.).
Avoid manipulative or coercive content; motivational content is optional and clearly labeled as AI-generated where applicable.
Implement prompt and tool-call safeguards to prevent broad data exposure.
Status
Current: Product intent excludes performance evaluation; actions require user approval.
Planned: Codify prohibited prompts in system policy and add a ‘report concern’ channel in the UI.

6) Human oversight pattern (Accept/Reject controls)
AIME applies human oversight through an explicit proposal-and-approval workflow. The AI assistant can propose changes, but execution requires an informed user decision.
AIME approach
All write operations are presented as a proposed action with Accept/Reject.
Action cards describe: the target system (AIME/Jira), the fields to be changed, and the expected effect.
High-impact actions (bulk updates, admin changes) require additional confirmation.
Status
Current: Accept/Reject pattern is part of the design for CRUD operations via AI.
Planned: Add ‘Details’ of action view to see all parameters being sent if Accept button is pressed

7) Logging & auditability expectations
AIME supports accountability by logging AI interactions and the resulting proposals and approvals. Logging is designed to enable investigation of incidents, misuse, and correctness issues while following data minimisation principles.
AIME approach
Record the requester identity and role, request metadata, tools invoked, and data object identifiers accessed (minimised).
Record the proposed action payload and the user’s Accept/Reject decision.
Record execution result (success/failure) when an action is accepted.
Apply access controls to logs and define retention periods consistent with internal policy.
Status
Current: Logging mechanism is under consideration.
Planned: Implement an AI audit log schema, retention policy, and monitoring alerts for unusual access patterns.

8) Governance artifacts (policies, training, documentation)
AIME maintains governance artefacts to demonstrate safe and appropriate use of AI in the workplace.
Artefacts maintained / to be maintained
AIME – Intended Use & System Overview (attached AIME_Intended_Use_and_System_Overview_v1).
AIME – AI Governance Artefacts (policies for transparency, oversight, logging, change control - to be drafted).
RBAC matrix and role assignment policy (least privilege, periodic review).
AI transparency notice text and labeling screenshots (chat, drafts, inspiration content).
Risk register (misuse cases, mitigations, and release checks).
AI literacy training material for staff and managers.
Incident response and change management procedures for AI-related issues.
Status
Current: Intended Use & System Overview and Governance Artefacts documents exist; AI-generated inspirational content is labeled.
Planned: Expand documentation to include RBAC matrix, AI audit logging spec, refusal policy, training pack, and incident runbooks.

Appendix: Open items / configuration to confirm
Confirm EU usage (e.g., Spain) and maintain a user-location register for scope tracking.
Select and document the Bedrock region/boundary for inference (EU/UK/global) and configure accordingly.
Confirm integrations’ data residency and access controls (Jira, Microsoft, Snowflake).
Define retention and access policies for chat logs, audit logs, and debugging traces.
Implement user feedback, complaints, and defect tracking workflow.

## GDPR_Regulation_EU_2016_679_AIME_Compliance_Approach.docx

GDPR — Regulation (EU) 2016/679AIME Compliance Approach (Draft)
Version: 1.0    Date: 2026-01-23
This document describes how AIME addresses data protection and privacy requirements under the EU General Data Protection Regulation (GDPR) for EU/Spain users. It is intended for internal governance and should be reviewed with the organisation’s legal/privacy and security stakeholders.
A. Processing context (summary)
AIME is an internal workplace web application for 90‑day goal setting (OKRs/OKRTs) and execution visibility.
AIME processes employee identifiers and work context (e.g., name, work email, role/team membership) and work artefacts (OKRs, progress updates, comments).
AIME integrates with enterprise systems (e.g., Jira, Microsoft work tools, Snowflake KPI datasets) subject to permissions.
AIME includes an AI assistant that drafts OKRs, answers questions, summarises information, and proposes actions that require user Accept/Reject approval.
1) Lawful basis for processing (employee data)
AIME processes employee data for internal business operations (goal setting, coordination, and execution visibility). In an employment context, consent is generally not relied upon due to imbalance of power; lawful bases are selected based on the specific processing purpose.
AIME approach
Primary lawful bases (typical):
• Article 6(1)(b) Contract (employment relationship) — where processing is necessary to administer agreed workplace processes (e.g., maintaining goal records, collaboration).
• Article 6(1)(f) Legitimate interests — where processing supports organisational planning, alignment, and execution visibility, balanced against employee rights.
• Article 6(1)(c) Legal obligation — only where specific records are required by law (if applicable).
Special category data (Article 9): AIME does not intend to process special category data. If any appears in free‑text (e.g., comments), policies and controls should limit use and apply safeguards.
Status
Current: AIME is positioned as an internal productivity and visibility tool; not intended for performance appraisal or profiling.
Planned: Document specific lawful basis per data category in a Record of Processing Activities (RoPA).
2) Transparency / privacy notice content
AIME provides clear information to users about what data is processed, why, and how it is used, including AI-related processing.
AIME approach
Publish an internal Privacy Notice (and make it accessible from the app) that includes:
• Controller identity and contact (and DPO/contact if applicable).
• Purposes of processing (OKR management, collaboration, dashboards, integrations, AI assistance).
• Categories of personal data processed (identifiers, org role/team, OKR content, activity references).
• Lawful bases (per purpose).
• Recipients and processors (hosting, AI services, Atlassian/Jira, Microsoft, Snowflake, monitoring).
• International transfers and safeguards (SCCs/TRA where required).
• Retention periods.
• Data subject rights and how to exercise them.
• Automated decision‑making statement: AI provides drafts/summaries and proposed actions; no automated decisions with legal/similar effects; user approval required for changes.
• Security measures summary.
Provide AI transparency notices in‑product (e.g., label AI-generated drafts/summaries; “Includes AI Generated Content” for inspiration).
Status
Current: AI-generated inspiration is labelled; Accept/Reject pattern prevents autonomous writes.
Planned: Publish a full internal Privacy Notice covering AI features and integrations; include cookie policy where relevant.
3) Data minimisation & purpose limitation
AIME limits personal data to what is necessary for defined purposes and avoids re‑use for incompatible purposes (e.g., employee scoring).
AIME approach
Minimise identifiers shared with the AI assistant (prefer internal IDs and aggregates where possible).
Tool-based retrieval: retrieve only the sections of data needed for a specific user intent (avoid sending full trees).
Role-based scoping (self/team/org) enforced server-side for all retrieval and proposed actions.
Purpose limitation: prohibit use of AIME data for ranking or automated performance evaluation; provide manager guidance for fact-only summaries.
Status
Current: Design includes tool-based retrieval and human approval for actions; non-intended use excludes performance appraisal.
Planned: Implement explicit field allowlists/redaction rules for model inputs; add automated tests for minimisation.
4) Data subject rights (access, rectification, objection, etc.)
AIME supports GDPR rights processes for EU users, recognising workplace constraints and the need for identity verification.
AIME approach
Access: provide an export of the user’s OKRs/OKRTs, comments, time blocks, and relevant activity logs within scope.
Rectification: allow users (or admins) to correct inaccurate personal data (e.g., name/email/team) and OKR records.
Erasure: apply where appropriate (note: some workplace records may be retained for legitimate interests or legal obligations).
Restriction/Objection: provide a channel to object to specific processing based on legitimate interests and assess on a case-by-case basis.
Portability: provide structured exports for the user’s own OKR content where applicable.
Process: define an internal request workflow, timelines, and escalation to privacy/legal.
Status
Current: Core CRUD supports correction of OKR data; admin can manage users/groups.
Planned: Add a formal DSAR workflow and export tooling; document response timelines and responsibilities.
5) DPIA requirement rationale (workplace monitoring-like processing)
A Data Protection Impact Assessment (DPIA) is recommended where processing is likely to result in a high risk to individuals—particularly in workplace contexts, where systems can resemble monitoring or evaluation, and where new technologies (AI) are used at scale.
AIME DPIA rationale
Workplace context and power imbalance increases privacy risk.
Cross-source visibility (OKRs + KPIs + Jira activity) can enable inference about performance, even if not intended.
Use of AI to summarise employee activity and propose actions introduces risk of error, bias, or misuse.
Therefore, conducting a DPIA is prudent to document safeguards and demonstrate accountability.
Status
Current: DPIA not yet completed (recommended).
Planned: Perform DPIA covering AI features, dashboards, integrations, access controls, and international transfers; implement mitigations and track residual risk.
6) Data retention & deletion
AIME defines retention periods aligned to the 90‑day cycles and business needs, and supports deletion/archival workflows.
AIME approach
Define retention by data type: OKR history, comments, time blocks, audit logs, chat logs, and integration metadata.
Prefer archiving for historical OKR records (business continuity) with access controls rather than indefinite retention.
Define deletion rules for: revoked users, obsolete drafts, transient AI inputs, and debug traces.
Document retention in the Privacy Notice and RoPA.
Status
Current: Retention policy under consideration.
Planned: Adopt retention schedule (e.g., OKR history retained X years; audit logs retained Y months; chat logs retained Z months) and implement automated deletion/archival.
7) Security measures (technical & organisational)
AIME applies security controls appropriate to workplace personal data and integrated systems.
Technical measures
Authentication via Microsoft SSO (where enabled) and secure session management.
Role-based access control (RBAC) enforced server-side; least privilege by default.
Encryption in transit (TLS) and at rest (database/managed services).
Secure secrets management for API keys and OAuth credentials (Jira, Microsoft, Snowflake).
Input sanitisation and protections against XSS/prompt injection (especially for free-text comments and imported Jira content).
Audit logging of admin actions and AI-proposed actions (Accept/Reject).
Organisational measures
Access governance: role assignment approval, periodic access reviews, and joiner/mover/leaver process.
Security incident response procedures and escalation paths.
Developer change control for prompts/tools/models (review, versioning, rollback).
User training on safe use of AI features (AI literacy).
Status
Current: Accept/Reject pattern reduces execution risk; role-based roles are defined.
Planned: Implement comprehensive AI audit logging, monitoring alerts, and formal access review cadence.
8) Processors & DPAs (OpenAI/Anthropic, Atlassian, Snowflake, hosting)
AIME relies on multiple service providers that may act as processors/sub‑processors. Appropriate contracts (DPAs) and security reviews are required.
AIME approach
Maintain a vendor/sub‑processor register for: hosting/runtime (Vercel or AWS), database (Neon or AWS), AI inference (Amazon Bedrock / model provider), Atlassian (Jira), Microsoft, Snowflake, monitoring/analytics (if any).
Put in place Data Processing Agreements (DPAs) or equivalent contractual terms with relevant vendors.
Confirm data handling terms for AI services (e.g., whether prompts are used for model training, retention policies, and region controls).
Ensure processor instructions: AI is used to draft/summarise/propose; no profiling or performance evaluation.
Status
Current: Hosting uses Vercel and Neon (London); AI provider selection may move to Amazon Bedrock; Jira/Snowflake/Microsoft are enterprise systems.
Planned: Complete DPA review and vendor register; document responsibilities and security controls for each processor.
9) International transfers (if EU data accessed outside EU)
If personal data of EU users is accessed or processed outside the EU/EEA (including in the UK, Sri Lanka, or other regions used by hosting/AI services), AIME documents the transfer mechanism and safeguards.
AIME approach
Map data flows and processing locations: database region, application runtime regions, AI inference region(s), and integration endpoints.
Where transfers occur, use appropriate safeguards (e.g., SCCs) and conduct a Transfer Risk Assessment (TRA).
Prefer configuring services to process within EU/EEA where feasible for EU users (e.g., EU regions for inference/hosting).
Limit the personal data sent to AI services (minimisation) to reduce transfer impact.
Status
Current: Neon database is hosted in London; Vercel region selection to be confirmed; Bedrock region/boundary to be selected.
Planned: Complete transfer mapping and TRA; implement SCCs where required; configure EU/UK boundaries as appropriate.

