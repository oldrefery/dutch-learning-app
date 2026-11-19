# Dutch word analysis quality and model selection

The single-word and batch workflows share the Gemini analysis service. Cached cards can outlive a prompt revision, so the release check covers both fresh responses and cached reads.

## 1. Correct the baseline

Pass the learner input to the prompt once. Preserve the meaning of an explicitly entered construction. For a bare verb, show optional constructions in usage guidance. Check regularity against the conjugation and keep every example attached to the analyzed lemma. Verify the known faulty cache record for the bare verb `werken` independently.

## 2. Compare the models

Compare `gemini-3.5-flash` and `gemini-3.8-flash` with identical prompt text, low thinking, the same output limit, and one response per input per model. Generate directly so the production cache cannot hide differences. Record the returned model version, input and output tokens (including thinking), wall time, and failed or unusable responses. Compare estimated cost per usable card using the prices in effect on the test date.

| Input      | Check                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| werken     | Bare headword, regular weak verb, no fixed preposition, work and function senses |
| werken aan | Full construction appears once, work-on sense, examples take an object with aan  |
| samen      | Adverb, bilingual translations for together, no verb grammar                     |
| de meneer  | Noun, article de, natural gentleman or sir equivalents in both languages         |
| spelen     | Regular verb, no fixed preposition, examples distinguish games and instruments   |
| zwemmen    | Strong verb, zwom, zwommen, gezwommen                                            |
| rekenen op | Count-on or rely-on construction with a natural Dutch complement                 |
| aanlopen   | Separable strong verb, liep aan, aangelopen, examples match the selected senses  |

Score headword and sense, grammatical fields, English and Russian translations, and whether the Dutch examples actually illustrate the senses. Record errors per dimension. The last four inputs are outside the new worked examples in the prompt. An initial eight-word comparison is a screening run. Repeat disputed cases and expand to unseen inflections, ambiguous lemmas, nouns and idioms before a default-model switch. If quality is comparable, use latency and estimated cost to choose.

## 3. Strengthen the response contract

Trial a provider JSON schema on the same cases. Check the generated result in the application before caching, including bilingual content and the consistency of grammatical flags. Keep support for valid legacy cache data. Distinguish missing translations from grammatical errors in telemetry without sending learner text.

## 4. Release and verify

Publish the evaluated prompt and model via the existing Edge Function. Check single and batch analysis under a test account and repeat a previously uncached word to confirm the cache hit. Review old shared records for the specific defects that were demonstrated. Treat a learner's saved copies separately from the analysis cache.

## November 19 screening results

The 74 live requests used eight unique inputs. Each model received 37 requests across the original comparison, a schema probe, a candidate prompt, and the final prompt. Google reported `gemini-3.6-flash` for every request addressed to `gemini-3.5-flash`. The final comparison used eight requests per model with CEFR and eight without. All requests used low thinking and an 8,192-token output limit.

| Requested model | Passed field checks, CEFR off | Passed field checks, CEFR on | Median response | Input / output tokens across the final 16 |
| --------------- | ----------------------------: | ---------------------------: | --------------: | ----------------------------------------: |
| 3.5 Flash       |                           7/8 |                          6/8 |          10.4 s |                           76,376 / 11,772 |
| 3.8 Flash       |                           8/8 |                          8/8 |          12.8 s |                           76,376 / 13,171 |

The checks covered each input's expected lemma and part of speech, preposition, irregularity and separability, the inflected forms, bilingual examples, and the application's Cyrillic check. The older route returned transliterated Russian for both final `de meneer` requests and marked `spelen` irregular once. Earlier candidates from both models sometimes attached the construction's preposition to the past participle. The final instructions cover this explicitly.

Use 3.8 Flash for fresh interactive analysis. The combined model-call cost for its final 16 responses is approximately USD 0.107 at the November standard rate, or USD 0.0067 per returned card. Wall time includes the test network path. The sample covers the reported bugs. Manual inspection found that 3.8 also attributed rising debts to `aanlopen` in one example, where a learner should use `oplopen`. Passing the field checks does not establish lexical accuracy for every example or sense. Broader vocabulary coverage remains a follow-up.

[Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Model alias documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)
