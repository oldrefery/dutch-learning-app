import Link from 'next/link'
import styles from './Guide.module.css'

const GRADES = [
  [
    'Again',
    'You did not remember it. The word returns soon and its successful streak resets.',
  ],
  [
    'Hard',
    'You recalled it with real effort. The interval grows only a little.',
  ],
  [
    'Good',
    'You recalled it correctly at a useful level of effort. This is the normal answer.',
  ],
  [
    'Easy',
    'The answer was immediate and obvious. The interval grows more quickly.',
  ],
] as const

const MODES = [
  ['Recognition', 'Choose the correct meaning from a set of options.'],
  ['Meaning recall', 'See Dutch first and recall what it means.'],
  ['Dutch production', 'See a translation and produce the Dutch form.'],
  [
    'Adaptive',
    'Each word moves between the three modes as your recall improves.',
  ],
] as const

export default function LearningGuidePage() {
  return (
    <article className={styles.guide}>
      <p className="dw-label">Learning guide</p>
      <h1 className="dw-page-title mt-2">How the schedule works</h1>
      <p className={styles.lead}>
        De Woordenaar brings a word back just before you are likely to forget
        it. Honest answers are more useful than high scores: they keep the next
        review at the right distance.
      </p>

      <section className={styles.section}>
        <h2>The four grades</h2>
        <p>Choose the grade that describes the recall you just experienced.</p>
        <div className={styles.grid}>
          {GRADES.map(([title, description]) => (
            <div className={styles.card} key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Review modes</h2>
        <div className={styles.grid}>
          {MODES.map(([title, description]) => (
            <div className={styles.card} key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Status labels</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>New</td>
              <td>No successful review yet.</td>
            </tr>
            <tr>
              <td>Due today</td>
              <td>The planned review date has arrived.</td>
            </tr>
            <tr>
              <td>Difficult</td>
              <td>The easiness factor is 2.10 or lower.</td>
            </tr>
            <tr>
              <td>Established</td>
              <td>At least three successful repetitions.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>Practical advice</h2>
        <p>
          Keep sessions short, say the answer aloud, and use Again whenever you
          had to guess. Consistency matters more than clearing every due word.
        </p>
        <Link className="dw-button dw-button--primary mt-4" href="/app/review">
          Start a review
        </Link>
      </section>
    </article>
  )
}
