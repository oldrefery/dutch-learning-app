# D11 owner feedback on the 24-item diagnostic — 2026-10-04

## Provenance and scope

The project owner reviewed the [assistant's 24-item worksheet](D11-pilot-review-worksheet.md)
after the v3 Gemini pilot and supplied these judgments in the task
conversation. The owner saw the assistant's proposed bands and aggregate
pilot result, but no item-level Gemini outputs were presented in this
review. The owner subsequently clarified that the levels describe
**when they personally learned and used the words**, not a formal
adjudication of each exact assessment input or a population-level CEFR
threshold. This is valuable human feedback, yet it is **post-run and not
blinded to the assistant reference**. It is not an independent CEFR gold
fixture or a prospective held-out score. The original frozen
[reference v1](D11-pilot-provisional-reference.json) and its hashes
remain unchanged.

| Discussed input                                                   | SHA-256                                                            | Owner learning-level report | Current disposition                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------- |
| `pilot-05` — bench `bank`                                         | `af2d5c91421983bdd7616a268749be80ed8bf79fb92cdd93a5dc1a3b4056deb5` | Agrees with A1–A2           | Record owner agreement; no fixture promotion                                |
| `pilot-06` — financial `bank`                                     | `7f6e30318d057dd93b4cbe7403698a7d657d919bbe8e0bd2de2457a6b0828996` | Agrees with A1–A2           | Record owner agreement; no fixture promotion                                |
| `pilot-07` — body-part `arm`                                      | `0bf2c38663c97d751e0dff0259654e14e532daaabc6f44a0d899405672a46461` | Agrees with A1              | Record owner agreement; no fixture promotion                                |
| `pilot-08` — poor `arm`                                           | `1922001d65b598ed75af8ce0b329a656253b9495bbf08de22feb86813dddd93d` | Agrees with A1–A2           | Record owner agreement; no fixture promotion                                |
| `pilot-19` — `mitochondrium`                                      | `f32643f4445d14893b3d7b8808dd77623c300aec5c6097d8789a645bdf6106da` | B2                          | Personal exposure; no general meaning-level CEFR label                      |
| `pilot-20` — `bewijslast`                                         | `457a045756c2710e4f5f9a4c4d87378452eaeef8b1d8e049d8824af2a1715b92` | B2                          | Personal exposure; no general meaning-level CEFR label                      |
| `pilot-21` — `kwispelen`                                          | `b1cce498dd1fcd29ef853c54fae4819dfe5338505ab1982399a3e5f5a2413dc5` | B2                          | Personal exposure differs from assistant A2–B1 guess                        |
| `pilot-22` — `poldergemaal`                                       | `8693f15c3dd36c09636e8af2b36099be4416139470c02299af959673a1fa5a93` | B2                          | Personal exposure; no general meaning-level CEFR label                      |
| `pilot-23` — context-free `licht`                                 | `fbdc9142f07b1687463bf072192dcabe27b6f485c50edbee850b96ee53f9da64` | A1–A2 (revised from A1)     | Personal word exposure; exact unsensed input still requires abstention      |
| `pilot-24` — `lopen` with walking gloss and running-water example | `0fc62251d978837da96dcf44dfe86038431787bf616abb0d2d2c2aefbc296106` | A1                          | Personal word exposure; exact contradictory input still requires abstention |

The owner did not comment on IDs 01–04 or 09–18. Silence is not
agreement. The owner's learning history is recorded as stated, without
claiming a verified CEFR level for the corresponding exact meaning.

## Review boundary

For `pilot-23`, the bare adjective and English gloss “light” can denote
different senses; the exact input has no example. For `pilot-24`, the
English gloss “to walk” and Dutch example about water flowing disagree.
The owner clarified that their levels concern personal word learning
and use; `licht` was revised to A1–A2. This resolves the scope of the
feedback without changing the exact inputs. A **repaired,
sense-specific** version of either word would have a different
canonical SHA-256. The current exact inputs retain preliminary
abstention because of missing sense or contradictory fields. No owner
suggestion is silently discarded.

Any later amended reference requires a new revision and hashes; the
already completed v3 report must not be presented as an independent
test against labels changed after seeing its aggregate result. The
four empty slice/split cells and small denominators remain even if
all owner judgments are adopted. `qualified: false`, worker and
schedule disabled; no provider call or new transmission occurred.
