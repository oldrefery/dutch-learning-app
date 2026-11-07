export class IncompleteDictionaryBatchError extends Error {
  constructor() {
    super('Incomplete dictionary following batch')
    this.name = 'IncompleteDictionaryBatchError'
  }
}
