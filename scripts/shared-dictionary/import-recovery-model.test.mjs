import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ImportRecoveryModel,
  mayAcknowledge,
} from './import-recovery-model.mjs'

const original = { operation: 'original-operation', root: 'original-operation' }
const recovery = (operation, target, version = 0, from = 'original') => ({
  operation,
  root: original.root,
  target,
  version,
  from,
})
const cancellation = { operation: 'cancel-operation', root: original.root }

test('model: lost original/recovery replies never repeat moves or reset learning/content', () => {
  const state = new ImportRecoveryModel()
  state.original(original)
  state.learnAndEdit()
  const a = recovery('recover-a', 'a')
  assert.equal(state.recover(a).outcome, 'applied')
  assert.deepEqual(state.card, {
    target: 'a',
    progress: 1,
    content: 'private-1',
  })
  const b = recovery('recover-b', 'b', 1, 'a')
  state.recover(b)
  const snapshot = state.snapshot()
  assert.equal(state.original(original).idempotent, true)
  assert.equal(state.recover(a).idempotent, true)
  assert.equal(state.recover(b).idempotent, true)
  assert.equal(state.snapshot(), snapshot)
})

test('model: same-base choices require explicit rebase; delayed older choice cannot move the card', () => {
  const state = new ImportRecoveryModel()
  const a = recovery('recover-a', 'a')
  const b = recovery('recover-b', 'b')
  state.recover(a)
  assert.deepEqual(state.recover(b), { outcome: 'state-conflict', version: 1 })
  state.recover(recovery('explicit-retry-b', 'b', 1, 'a'))
  assert.equal(state.recover(a).idempotent, true)
  assert.equal(state.card.target, 'b')
  assert.throws(() => state.original(original), /original-settled/)
})

test('model: placement CAS detects ordinary movement and accepts a deleted target as NULL', () => {
  const state = new ImportRecoveryModel()
  state.original(original)
  state.ordinaryMove('b')
  assert.equal(state.recover(recovery('a', 'a')).outcome, 'placement-conflict')
  state.deleteTarget('b')
  assert.equal(state.card.target, null)
  assert.equal(
    state.recover(recovery('a-null', 'a', 0, null)).outcome,
    'applied'
  )
})

test('model: successful personal ID cannot be recreated after deletion by replay, recovery or a new root', () => {
  const state = new ImportRecoveryModel()
  state.original(original)
  const a = recovery('a', 'a')
  state.recover(a)
  state.deleteCard()
  const snapshot = state.snapshot()
  state.original(original)
  state.recover(a)
  assert.throws(() => state.recover(recovery('b', 'b', 1, 'a')), /unavailable/)
  assert.throws(
    () => state.original({ operation: 'new-root', root: 'new-root' }),
    /personal-id-unavailable/
  )
  assert.equal(state.snapshot(), snapshot)
})

test('model: conflict claims the root and advances recovery; explicit vacant-key retry keeps the personal ID', () => {
  const state = new ImportRecoveryModel()
  state.duplicate = true
  const a = recovery('a', 'a')
  assert.equal(state.recover(a).outcome, 'identity-conflict')
  assert.equal(state.card, null)
  assert.throws(() => state.original(original), /original-settled/)
  state.duplicate = false
  assert.equal(state.recover(a).outcome, 'identity-conflict')
  assert.equal(state.recover(recovery('b', 'b', 1)).outcome, 'applied')
  assert.equal(state.births, 1)
})

test('model: cancellation fences all late fresh operations; normal delete follows its acknowledgement', () => {
  for (const delivered of [false, true]) {
    const state = new ImportRecoveryModel()
    if (delivered) state.original(original)
    state.cancel(cancellation)
    state.deleteCard()
    assert.equal(state.cancel(cancellation).idempotent, true)
    if (delivered) assert.equal(state.original(original).idempotent, true)
    else assert.throws(() => state.original(original), /cancelled/)
    assert.throws(() => state.recover(recovery('late', 'a', 1)), /cancelled/)
    assert.equal(state.card, null)
  }
})

test('model: unavailable target and immutable-operation mismatch leave committed state untouched', () => {
  const state = new ImportRecoveryModel()
  state.deleteTarget('a')
  const snapshot = state.snapshot()
  assert.throws(() => state.recover(recovery('a', 'a')), /target-unavailable/)
  assert.equal(state.snapshot(), snapshot)
  state.recover(recovery('b', 'b'))
  const committed = state.snapshot()
  assert.throws(
    () => state.recover(recovery('b', 'original')),
    /operation-conflict/
  )
  assert.equal(state.snapshot(), committed)
})

test('model: unproven existing personal ID is never adopted by recovery or cancellation', () => {
  const state = new ImportRecoveryModel()
  state.card = { target: 'original', progress: 9, content: 'unrelated' }
  const snapshot = state.snapshot()
  assert.throws(() => state.recover(recovery('a', 'a')), /unavailable/)
  assert.throws(() => state.cancel(cancellation), /unavailable/)
  assert.equal(state.snapshot(), snapshot)
})

test('model: old receipts cannot acknowledge replaced, cancelled, deleted or foreign-owner local work', () => {
  const current = {
    owner: 'owner',
    activeOwner: 'owner',
    active: true,
    cancelling: false,
    payload: 'request-b',
  }
  const response = { owner: 'owner', payload: 'request-b' }
  assert.equal(mayAcknowledge(current, response), true)
  for (const change of [
    { owner: 'other' },
    { activeOwner: 'other' },
    { active: false },
    { cancelling: true },
    { payload: 'newer-request' },
  ]) {
    assert.equal(mayAcknowledge({ ...current, ...change }, response), false)
  }
})

function* permutations(values) {
  if (!values.length) yield []
  for (const [index, value] of values.entries()) {
    for (const rest of permutations(values.filter((_, at) => at !== index))) {
      yield [value, ...rest]
    }
  }
}

function assertTransition(state, event, apply) {
  const before = state.snapshot()
  const card = state.card && { ...state.card }
  try {
    const result = apply(state)
    if (result?.outcome?.endsWith('-conflict')) {
      assert.equal(state.snapshot(), before)
    }
  } catch (error) {
    assert.match(error.message, /unavailable|cancelled|original-settled/)
    assert.equal(state.snapshot(), before)
  }
  assert(state.births <= 1)
  if (state.claim?.cancelled) assert.equal(state.card, null)
  if (card && state.card && ['original', 'a', 'b'].includes(event)) {
    assert.equal(state.card.progress, card.progress)
    assert.equal(state.card.content, card.content)
  }
}

test('model: all 40,320 orderings of original, two choices, cancel/delete, edit, move and target deletion', () => {
  const events = {
    original: state => state.original(original),
    a: state => state.recover(recovery('a', 'a')),
    b: state => state.recover(recovery('b', 'b')),
    cancel: state => {
      state.cancel(cancellation)
      state.deleteCard()
    },
    delete: state => state.deleteCard(),
    edit: state => state.learnAndEdit(),
    move: state => state.ordinaryMove('b'),
    detach: state => state.deleteTarget('original'),
  }
  let count = 0
  for (const ordering of permutations(Object.keys(events))) {
    const state = new ImportRecoveryModel()
    for (const event of ordering) {
      assertTransition(state, event, events[event])
    }
    count += 1
  }
  assert.equal(count, 40320)
})
