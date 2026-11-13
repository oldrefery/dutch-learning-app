export class IncompleteDictionaryBatchError extends Error {
  constructor() {
    super('Incomplete dictionary following batch')
    this.name = 'IncompleteDictionaryBatchError'
  }
}

export class PendingLegacyDictionaryCommandsError extends Error {
  constructor() {
    super('Legacy dictionary commands require reconciliation')
    this.name = 'PendingLegacyDictionaryCommandsError'
  }
}
