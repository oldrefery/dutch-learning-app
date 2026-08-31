# Claude Design Brief: De Woordenaar Web Application

## Instructions for the design system

Create a production-ready, high-fidelity responsive web application design for **De Woordenaar**, an AI-powered Dutch vocabulary learning product. The production domain will be `woordenaar.app`.

The design must cover the complete authenticated product, not only a marketing landing page. It must be usable as the source of truth for frontend implementation in Next.js and must include desktop, tablet, and narrow mobile behavior.

Do not imitate the current mobile application visually. Establish a coherent web-first visual system while preserving the product behavior described below.

Provide both light and dark themes. Prioritize calm focus, linguistic clarity, accessibility, and efficient daily practice over gamification or decorative complexity.

## 1. Product summary

De Woordenaar helps people learn Dutch vocabulary by combining:

- AI-generated linguistic analysis;
- English and Russian translations;
- natural Dutch examples;
- visual associations;
- pronunciation;
- spaced repetition;
- adaptive review difficulty;
- personal collections;
- shareable vocabulary collections;
- offline-capable learning workflows.

The product should feel like a serious but welcoming personal language-learning workspace. It is intended for recurring daily use, quick word capture, focused study sessions, and deeper linguistic exploration.

## 2. Primary users

### Independent Dutch learner

- lives in or plans to move to the Netherlands;
- encounters new words in daily life;
- needs fast capture and reliable review;
- values articles, conjugation, fixed prepositions, register, and real examples;
- may use English or Russian as a support language.

### Structured learner

- maintains themed collections;
- imports starter content or collections from another learner;
- reviews daily using spaced repetition;
- tracks difficult and mastered words.

### Read-only invited user

- can sign in and import approved shared content;
- cannot use all content-creation features;
- needs a clear explanation of restricted actions without feeling blocked by an error after clicking.

## 3. Product principles

1. **Learning first.** The current word and the next meaningful action must dominate every learning screen.
2. **Progressive disclosure.** Show the primary meaning first; reveal grammar, examples, nuance, and metadata in a structured hierarchy.
3. **Fast capture.** Adding a word should require minimal input before AI analysis.
4. **Trustworthy analysis.** AI-generated content must be clearly structured and easy to verify or regenerate.
5. **Low-friction review.** Review controls should be large, predictable, keyboard-accessible, and consistent across modes.
6. **Calm progress.** Use progress feedback without casino-style gamification, aggressive streak pressure, or excessive celebration.
7. **Cross-device continuity.** Connectivity, pending changes, and sync state must be understandable without dominating the interface.
8. **Accessible by default.** Color is never the only indicator, text remains readable, and every interaction has a keyboard equivalent.

## 4. Content and language rules

- The application interface should be designed in English.
- Primary learning content is Dutch.
- Word translations contain English and may contain Russian.
- Dutch text should be visually primary on learning cards.
- English translations should be the primary support text.
- Russian translations should be visibly available without competing with Dutch.
- Never represent `de` and `het` only by color; always display the article as text.
- Preserve Dutch diacritics and punctuation.
- Long compounds and multi-word expressions must wrap gracefully.

## 5. Responsive application shell

Design the application for these target widths:

- narrow mobile web: 360–479 px;
- large mobile/small tablet: 480–767 px;
- tablet: 768–1023 px;
- desktop: 1024–1439 px;
- large desktop: 1440 px and above.

### Desktop

Use a persistent navigation pattern suitable for a learning workspace, preferably a left sidebar or compact rail with labels.

Primary destinations:

- Collections;
- Review, with a due-count badge;
- Add Word, hidden or disabled for read-only users;
- History;
- Settings.

Secondary entry points:

- Insights;
- Batch Capture;
- Starter Pack;
- Audio Review.

The content area should have a comfortable maximum width. Review screens may use a narrower focused canvas, while collection tables/grids can use more horizontal space.

### Tablet

Allow the sidebar to collapse to an icon rail or drawer. Keep the due-count visible.

### Narrow mobile web

Use a compact bottom navigation or accessible menu that does not obscure review controls. Sticky controls must account for browser safe areas and the virtual keyboard.

## 6. Global visual requirements

Create a complete token system for:

- color roles;
- typography;
- spacing;
- radii;
- borders;
- shadows/elevation;
- focus rings;
- motion duration and easing;
- content widths;
- breakpoints;
- chart colors;
- semantic states.

Required semantic states:

- neutral;
- informational;
- success;
- warning;
- destructive;
- offline;
- pending synchronization;
- conflict/error;
- read-only restriction.

Avoid hard-coded one-off colors in individual screens. All colors must map to semantic tokens in both themes.

Typography must distinguish:

- large Dutch prompt text;
- article plus lemma;
- translation hierarchy;
- grammatical labels;
- examples;
- metadata;
- numeric progress;
- helper and error text.

## 7. Core reusable components

Design variants, states, and responsive behavior for:

- application sidebar/navigation;
- mobile navigation;
- page header;
- account menu;
- due-count badge;
- collection card;
- collection list/table row;
- word list row;
- complete word card;
- compact word preview;
- article badge;
- part-of-speech badge;
- register badge;
- SRS status badge;
- progress bar/ring;
- statistic card;
- empty state;
- loading skeleton;
- inline error;
- toast;
- confirmation dialog;
- modal and side panel;
- dropdown/select;
- searchable combobox;
- segmented control;
- tabs;
- accessible tooltip;
- audio button and playback state;
- sync/connectivity indicator;
- AI cache/fresh-result indicator;
- review answer buttons;
- keyboard shortcut hints;
- chart legend and tooltip;
- share-link panel;
- duplicate warning;
- batch queue item;
- restricted-feature notice.

All interactive components need default, hover, active, focus-visible, disabled, loading, success, and error states where relevant.

## 8. Authentication screens

Design:

- Login;
- Sign Up;
- Forgot Password;
- Reset Password;
- Email confirmation notice;
- OAuth callback/loading state;
- expired or invalid recovery link state.

Login and sign-up support:

- email;
- password;
- Google;
- Apple.

Requirements:

- password visibility control;
- inline validation;
- loading and disabled submit states;
- clear privacy/legal links;
- continuation message when authentication was triggered by a shared collection link;
- friendly handling of cancellation and provider errors.

## 9. Collections dashboard

The dashboard is the default authenticated page.

Include:

- greeting or concise page title;
- overall metrics: total words, mastered words, due today, and current streak;
- primary `Start Review` action with due count;
- `Review Insights` action;
- collection search if the list becomes large;
- create collection action for full-access users;
- collection cards or rows.

Each collection displays:

- name;
- total words;
- mastered count;
- percentage mastered;
- due count when non-zero;
- sharing status;
- context actions.

Collection actions:

- open;
- rename;
- share or copy link;
- stop sharing;
- delete.

States:

- first collection with no words;
- multiple collections;
- no due words;
- many collections;
- loading;
- offline with cached data;
- synchronization pending;
- synchronization error;
- read-only account.

## 10. Collection detail

The collection page should support focused browsing and management.

Header:

- collection name;
- word count;
- mastered percentage;
- due count;
- `Review This Collection`;
- `Add Word` for full-access users;
- share controls;
- rename and delete actions.

Content:

- search by Dutch lemma;
- optional filters for part of speech, due state, difficulty, and mastery;
- responsive word list;
- clear article, lemma, primary translation, part of speech, and status;
- pagination or progressive loading for large collections.

Word actions:

- open details;
- play pronunciation;
- move to collection;
- reset progress;
- change image;
- reanalyze;
- delete.

Design empty search, empty collection, loading, failure, and deleted-word feedback.

## 11. Complete word card and word detail

The complete word card is a central product component.

Information hierarchy:

1. Article and Dutch lemma.
2. Primary English translation.
3. Optional Russian translation.
4. Pronunciation action.
5. Image.
6. Part of speech and register.
7. Additional translations.
8. Examples in Dutch with English and optional Russian translations.
9. Grammar and morphology.
10. Synonyms and antonyms.
11. Usage guidance and contrasts.
12. AI analysis notes.
13. SRS progress and next-review metadata.

Conditional grammar sections:

- nouns: article and plural;
- verbs: irregular/reflexive/separable status, prefix, root, fixed preposition, present, simple past singular, simple past plural, and past participle;
- expressions: expression type;
- all words: formality register when known.

Usage guidance includes:

- a concise practical summary;
- up to three commonly confused Dutch terms;
- the distinction for each term;
- an optional comparison example.

Provide compact, expanded, modal, and review-card variants without creating four unrelated visual systems.

## 12. Add Word workflow

Design a clear multi-state workflow.

### Initial state

- prominent Dutch word or expression input;
- optional contextual guidance;
- `Analyze` primary action;
- collection selector;
- links to Batch Capture and Starter Pack;
- recent analyses.

### Analyzing state

- meaningful progress message;
- non-blocking explanation that linguistic analysis may take several seconds;
- cancel behavior only if technically supported;
- preserve entered input.

### Result state

- full editable/reviewable word card;
- cache-result or fresh-result indicator;
- collection selector;
- image selector;
- pronunciation;
- duplicate warning when applicable;
- `Save Word`;
- `Analyze Again` with a warning that it requests fresh AI output;
- start-over action.

### Error states

- invalid Dutch input;
- offline;
- AI timeout;
- quota/access restriction;
- duplicate;
- unavailable image service;
- save conflict.

The user must never lose the entered word after a recoverable error.

## 13. Image selection

Design a modal or side panel with:

- six image options where available;
- selected state;
- load-more action;
- loading skeletons;
- broken-image fallback;
- attribution area if required;
- confirm and cancel actions;
- keyboard navigation.

The image is a learning aid, not the dominant element of every desktop screen.

## 14. Batch Quick Capture

The workflow accepts up to 30 entries, one per line. An optional hint follows a semicolon.

Example:

```text
gezellig; social and comfortable atmosphere
de afspraak
zich voorbereiden op
```

Design these stages:

1. Input and validation.
2. Target collection selection.
3. Processing queue.
4. Manual review of each analyzed entry.
5. Completion summary.

Queue states:

- queued;
- checking duplicate;
- possible duplicate;
- analyzing;
- awaiting review;
- failed;
- completed;
- skipped;
- cancelled.

Controls:

- pause;
- resume;
- retry;
- skip;
- cancel all;
- clear completed;
- return to interrupted queue.

Show overall progress, current item, completed count, failed count, and the action needed from the user. Do not communicate status by color alone.

## 15. Starter Pack

Design a starter-pack page for approximately 60 Dutch A1 words.

Include:

- pack title, level, description, version, and word count;
- select all/deselect all;
- individual word selection;
- duplicate markers;
- hide-duplicates toggle;
- existing or new target collection;
- import summary;
- success state with `Start Review` and `Open Collection`.

The screen should make a large selection manageable on narrow mobile and desktop.

## 16. Shared collection flow

Public route pattern:

```text
https://woordenaar.app/share/{token}
```

Design:

- loading/resolving state;
- invalid or disabled link;
- authentication-required continuation;
- collection preview;
- owner-provided collection name;
- word count;
- word preview list;
- target collection selection;
- duplicate identification;
- select all/deselect all;
- import action;
- completion state.

Current product policy requires authentication before reading the full shared collection. The design should still provide a useful sign-in explanation and return the user to the same link afterward.

## 17. Review setup

Before a session, allow the user to select:

### Mode

- Adaptive;
- Recognition;
- Meaning Recall;
- Dutch Production.

### Scope

- all due words;
- due words in a selected collection;
- difficult due words.

Explain each mode in one short sentence. Show the number of available words before starting. Disable impossible combinations with an explanation.

## 18. Review session

Create a distraction-resistant review canvas.

Persistent information:

- progress through the current session;
- current mode;
- collection/scope when relevant;
- exit control;
- audio control;
- connection/pending state only when relevant.

### Recognition

- large Dutch prompt;
- optional image;
- several translation choices;
- clear correct/incorrect feedback;
- continue action;
- keyboard shortcuts for each choice.

### Meaning Recall

- Dutch prompt;
- reveal-answer interaction;
- translation and full supporting card after reveal;
- Again, Hard, Good, and Easy actions.

### Dutch Production

- English translation as prompt;
- optional Russian support;
- reveal Dutch word;
- assessment controls.

### Adaptive

- visually uses the active mode above;
- provides a subtle explanation when the mode is promoted or demoted;
- avoids interrupting the session with a modal.

### Answer controls

Design distinct but accessible actions for:

- Again;
- Hard;
- Good;
- Easy.

Do not rely on red/orange/green alone. Include labels and optional next-interval hints.

### Additional actions

- previous and next word where allowed;
- play pronunciation;
- show complete details;
- replace image;
- reanalyze;
- delete word with confirmation;
- keyboard shortcut help.

### Completion

Show:

- number reviewed;
- session duration;
- assessment distribution if available;
- words needing more attention;
- restart same session;
- choose another mode;
- return to collections;
- open insights.

## 19. Audio Review

Audio Review uses due words and Meaning Recall behavior.

The first screen must contain a deliberate `Start Audio Review` action because browsers may block autoplay before user interaction.

Session controls:

- pause/resume;
- replay pronunciation;
- reveal answer;
- Again;
- Good;
- exit.

Provide prominent visible text for the word and translation so the feature remains accessible to users who cannot hear the audio. Include keyboard shortcuts and clear playback/loading/error states.

## 20. Insights

Design a useful learning analytics page without overwhelming the user.

Summary metrics:

- total words;
- mastered words;
- due today;
- difficult words;
- streak.

Forecast categories:

- overdue;
- today;
- next seven days;
- later;
- unscheduled.

Interval categories:

- New: 0 days;
- Short: 1–6 days;
- Developing: 7–20 days;
- Established: 21+ days.

Easiness categories:

- Difficult: 2.10 or below;
- Learning: 2.11–2.49;
- Standard: 2.50.

Include:

- accessible charts with text/table alternatives;
- difficult-word list;
- due-state indicator;
- easiness factor;
- next review date;
- `Review Difficult Words` action;
- filters or sorting if the list is long.

## 21. History

History combines browser-local AI analysis activity with the durable review-event
timeline from Supabase. Keep these sources visually distinct so users understand
which history syncs between devices.

Design:

- recent analysis cards or rows;
- timestamp when available;
- collection;
- open details;
- reanalyze;
- empty state.

The review-event section includes:

- word and collection links;
- review mode and assessment;
- reviewed timestamp;
- previous and next interval;
- previous and next easiness factor;
- answer correctness or self-assessed state;
- response time when recorded;
- empty state with a `Start review` action.

## 22. Settings

Organize settings into clear sections.

### Account

- email;
- access level;
- logout;
- user ID as secondary diagnostic information;
- delete-account disclosure separated visually from ordinary settings.

### Learning preferences

- autoplay pronunciation;
- adaptive review preference;
- default/last review mode;
- default/last collection;
- learning guide.

These preferences are scoped to the signed-in user and stored in the current
browser. Do not imply that browser preferences synchronize to the mobile app.

### Appearance

- system, light, or dark theme.

### Data and synchronization

- online/offline status;
- cloud storage destination: Supabase;
- clear statement that web writes are direct while the browser is online;
- clear `Offline queue: Not enabled` state in the initial online-first release;
- no fake last-sync time, pending count, or manual-sync action before the PWA phase implements those capabilities.

### Application

- web version;
- local/preview/production environment;
- framework version;
- Vercel branch, commit identifier, and deployment host when available;
- legal links;
- privacy policy;
- terms and license agreement.

### Delete account

Keep the destructive controls collapsed until the user chooses `Begin account
deletion`. The expanded confirmation must clearly state that collections,
words, progress, and review history will be permanently deleted and require all
three confirmations:

- the current account email;
- the exact phrase `DELETE`;
- an explicit checkbox acknowledging permanent deletion.

Provide a neutral `Cancel` action. Never present deletion as a single-click
action, and never visually group the final destructive button with sign-out.

## 23. Connectivity and synchronization UX

The initial web release is online-first and writes directly to Supabase. Design
an unobtrusive Settings status for:

- browser online;
- browser offline;
- cloud storage destination;
- offline queue not enabled.

Do not imply that cached data can be edited offline in the initial release. If
Phase 7 PWA support is approved, extend the design with:

- online and synchronized;
- offline and working from cached data;
- pending local changes;
- synchronization in progress;
- synchronization failed;
- conflict requiring attention.

The normal synchronized state should not consume permanent prominent space. Offline and error states must be clear before the user starts an operation that requires AI or image search.

## 24. Read-only access UX

For read-only users:

- hide Add Word from primary navigation or show it as unavailable with an explanation;
- prevent collection creation where policy requires;
- keep shared collection import available;
- explain restrictions before an attempted action;
- avoid generic permission-denied errors;
- display an access badge in account/settings areas.

## 25. Required state coverage

For every major page, provide designs for relevant states:

- initial loading;
- background refresh;
- empty;
- populated;
- partial data;
- validation error;
- network error;
- authorization error;
- not found;
- offline;
- pending synchronization;
- destructive confirmation;
- successful completion;
- read-only restriction.

## 26. Accessibility requirements

- Target WCAG 2.2 AA.
- All workflows must work with a keyboard.
- Provide visible focus states.
- Minimum touch target approximately 44×44 CSS pixels.
- Maintain sufficient contrast in both themes.
- Do not use color as the only status indicator.
- Provide text alternatives for charts and images.
- Announce important review feedback and queue changes to assistive technology.
- Respect reduced-motion preferences.
- Avoid automatic focus changes that disorient screen-reader users.
- Keep review controls in a stable location.
- Provide clear labels for icon-only buttons.

## 27. Motion and feedback

Use restrained motion for:

- card reveal;
- navigation transitions;
- review correctness feedback;
- queue state changes;
- completion confirmation;
- expanding detail sections.

Avoid unnecessary parallax, continuous animation, or motion that delays review. Supply reduced-motion behavior.

## 28. Design deliverables

Provide:

1. A complete sitemap and primary user-flow map.
2. A visual direction statement.
3. Light and dark design tokens.
4. Responsive layouts for all screens listed in this brief.
5. Mobile, tablet, desktop, and large-desktop examples for the core shell.
6. A reusable component library with variants and states.
7. Complete word-card variants.
8. All four review modes and session completion.
9. Batch queue and manual-review flow.
10. Shared collection import flow, including authentication continuation.
11. Empty, loading, offline, error, and read-only states.
12. Keyboard and accessibility annotations.
13. Motion and reduced-motion guidance.
14. Developer handoff notes describing responsive behavior and component reuse.

## 29. Design constraints

- Do not require a custom backend beyond the described Supabase capabilities.
- Do not expose administrative or service-role features in the client design.
- Do not assume realtime collaboration.
- Do not assume that every word has an image, Russian translation, synonyms, antonyms, usage contrasts, or complete conjugation.
- Support very long Dutch compounds and expressions.
- Support collections with hundreds or thousands of words.
- Preserve functionality on a 360 px viewport.
- Keep destructive actions out of the primary learning path.
- Do not turn the experience into a child-oriented game.
- Do not use fake social feeds, leaderboards, achievements, or chat features.

## 30. Final design goal

The result should feel like a polished, focused Dutch learning workspace that is fast enough for daily capture, calm enough for sustained review, and detailed enough for serious vocabulary study. A developer should be able to implement the complete web product from the resulting design without inventing missing states, navigation behavior, or responsive rules.
