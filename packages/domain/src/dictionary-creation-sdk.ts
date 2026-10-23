import type { DictionaryCreationOwner } from './dictionary-creation-owner'
import type { DictionaryCreationRemote } from './dictionary-creation-transport'
import type {
  DictionaryCreationJournal,
  DictionaryCreationJournalRow,
} from './dictionary-creation-journal'
import type { DictionaryAnalysisAuth } from './dictionary-analysis-owner'
import { withDictionaryCreationOwner } from './dictionary-creation-owner'
import { createDictionaryCreationRemoteClient } from './dictionary-creation-transport'

/** SDK bindings supply ports; construction never creates an intent or starts I/O. */
export function createDictionaryCreationService(ports: {
  userId: string
  assertCurrent(): void
  signal?: AbortSignal
  enabled(): boolean
  connect(): {
    auth: DictionaryAnalysisAuth
    remote: DictionaryCreationRemote
    journal: DictionaryCreationJournal
  }
}) {
  const run = async <T>(
    action: (
      client: ReturnType<typeof createDictionaryCreationRemoteClient>,
      owner: DictionaryCreationOwner
    ) => Promise<T>
  ) => {
    ports.assertCurrent()
    const { auth, remote, journal } = ports.connect()
    return withDictionaryCreationOwner(
      ports.userId,
      auth,
      ports.assertCurrent,
      owner =>
        action(
          createDictionaryCreationRemoteClient({
            userId: ports.userId,
            enabled: ports.enabled,
            remote,
            journal,
          }),
          owner
        ),
      ports.signal
    )
  }
  return {
    list: () => run((client, owner) => client.list(owner)),
    readSaved: (id: string) =>
      run((client, owner) => client.readSaved(id, owner)),
    isAvailable: () => run((client, owner) => client.isAvailable(owner)),
    resolve: (value: DictionaryCreationJournalRow) =>
      run((client, owner) => client.resolve(value, owner)),
    recoverResolution: (id: string) =>
      run((client, owner) => client.recoverResolution(id, owner)),
    prepareCommand: (
      expected: DictionaryCreationJournalRow,
      operationId: string,
      recoveryId?: string
    ) =>
      run((client, owner) =>
        client.prepareCommand(expected, operationId, owner, recoveryId)
      ),
    submit: (expected: DictionaryCreationJournalRow) =>
      run((client, owner) => client.submit(expected, owner)),
    recover: (id: string) => run((client, owner) => client.recover(id, owner)),
  }
}
