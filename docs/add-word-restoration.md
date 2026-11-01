# Original Add Word flow

The Add Word tab again uses the original screen: choose a collection, enter a
Dutch word, run analysis, review the result, and add the personal card. The existing
screen and controls are reused without a layout redesign.

Enabling shared dictionary reads no longer replaces this screen or blocks explicit
personal analysis and creation. Personal additions use the existing private-card
command. Following cards keep their linked content and learning progress; their
mutation, import and server permission checks remain in place.

Regression coverage verifies route selection with shared reads enabled or disabled,
analysis and addition to the selected collection, a new private-card command, and
unchanged following content and learning in SQLite and PostgreSQL. The restored
flow was also checked with synthetic data in an iOS simulator in both themes.
These checks do not establish live provider availability or account access.

Publishing or merging this source change does not deploy the website, backend or
a mobile update. See the [release boundary](stability-release.md). Operational
reports, credentials and simulator captures are kept outside the published change.
