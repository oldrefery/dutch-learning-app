// Executable D10.3 design model, NOT a production adapter or database proof.
// Each method is one atomic transaction. SQL lock/rollback/RLS behavior needs
// separate implementation tests. Names stand for one owner's personal UUID.
import assert from 'node:assert/strict'

const PERSONAL_ID_UNAVAILABLE = 'personal-id-unavailable'
const fingerprint = input => JSON.stringify(input)

export class ImportRecoveryModel {
  constructor() {
    this.targets = new Set(['original', 'a', 'b'])
    this.claim = null
    this.card = null
    this.births = 0
    this.duplicate = false
    this.originalReceipts = new Map()
    this.recoveryReceipts = new Map()
    this.cancelReceipts = new Map()
  }

  replay(ledger, request) {
    const saved = ledger.get(request.operation)
    if (!saved) return null
    assert.equal(saved.hash, fingerprint(request), 'operation-conflict')
    return { ...saved.receipt, idempotent: true }
  }

  save(ledger, request, outcome) {
    const receipt = {
      operation: request.operation,
      root: request.root,
      outcome,
      version: this.claim?.version ?? 0,
      idempotent: false,
    }
    ledger.set(request.operation, { hash: fingerprint(request), receipt })
    return receipt
  }

  claimRoot(root) {
    this.claim ??= { root, born: false, cancelled: false, version: 0 }
    assert.equal(this.claim.root, root, PERSONAL_ID_UNAVAILABLE)
  }

  insert(target) {
    assert.equal(this.card, null, PERSONAL_ID_UNAVAILABLE)
    assert.equal(this.claim.born, false, PERSONAL_ID_UNAVAILABLE)
    this.card = { target, progress: 0, content: 'original' }
    this.claim.born = true
    this.births += 1
  }

  original(request) {
    const replay = this.replay(this.originalReceipts, request)
    if (replay) return replay
    if (this.claim) {
      assert.equal(this.claim.root, request.root, PERSONAL_ID_UNAVAILABLE)
      assert.equal(this.claim.cancelled, false, 'cancelled')
      assert.equal(this.claim.version, 0, 'original-settled')
    }
    assert(this.targets.has('original'), 'target-unavailable')
    assert.equal(this.card, null, PERSONAL_ID_UNAVAILABLE)
    if (this.duplicate) {
      return this.save(this.originalReceipts, request, 'identity-conflict')
    }
    this.claimRoot(request.root)
    this.insert('original')
    return this.save(this.originalReceipts, request, 'inserted')
  }

  recover(request) {
    const replay = this.replay(this.recoveryReceipts, request)
    if (replay) return replay
    if (this.claim) {
      assert.equal(this.claim.root, request.root, PERSONAL_ID_UNAVAILABLE)
      assert.equal(this.claim.cancelled, false, 'cancelled')
    }
    const version = this.claim?.version ?? 0
    if (request.version !== version)
      return { outcome: 'state-conflict', version }
    assert(this.targets.has(request.target), 'target-unavailable')
    if (this.claim?.born) {
      assert(this.card, PERSONAL_ID_UNAVAILABLE)
      if (this.card.target !== request.from) {
        return {
          outcome: 'placement-conflict',
          version,
          target: this.card.target,
        }
      }
      this.card.target = request.target
    } else {
      assert.equal(this.card, null, PERSONAL_ID_UNAVAILABLE)
      this.claimRoot(request.root)
      if (!this.duplicate) this.insert(request.target)
    }
    this.claim.version += 1
    return this.save(
      this.recoveryReceipts,
      request,
      this.claim.born ? 'applied' : 'identity-conflict'
    )
  }

  cancel(request) {
    const replay = this.replay(this.cancelReceipts, request)
    if (replay) return replay
    if (!this.claim) assert.equal(this.card, null, PERSONAL_ID_UNAVAILABLE)
    this.claimRoot(request.root)
    // Repeated cancellation with a fresh nonce is harmless; never reopen a root.
    if (!this.claim.cancelled) this.claim.version += 1
    this.claim.cancelled = true
    return this.save(this.cancelReceipts, request, 'cancelled')
  }

  deleteCard() {
    this.card = null
  }

  deleteTarget(target) {
    this.targets.delete(target)
    if (this.card?.target === target) this.card.target = null
  }

  ordinaryMove(target) {
    if (this.card && this.targets.has(target)) this.card.target = target
  }

  learnAndEdit() {
    if (this.card) {
      this.card.progress += 1
      this.card.content = `private-${this.card.progress}`
    }
  }

  snapshot() {
    return JSON.stringify({
      claim: this.claim,
      card: this.card,
      births: this.births,
    })
  }
}

// Transactional receipt selection only; SQLite implementation must additionally
// validate owner, original payload, local target and active/deleted row in the TX.
export function mayAcknowledge(current, response) {
  return (
    current.owner === response.owner &&
    current.activeOwner === response.owner &&
    current.active &&
    !current.cancelling &&
    current.payload === response.payload
  )
}
