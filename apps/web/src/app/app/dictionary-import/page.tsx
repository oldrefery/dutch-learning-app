import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { isDictionaryContentEnabled } from '@/features/dictionary/repository'
import { getTransferContext } from '@/features/sharing/dictionary-transfer-commands'
import { DictionaryDocumentImport } from '@/features/sharing/DictionaryDocumentImport'
import styles from '@/features/sharing/DictionaryTransfer.module.css'

export default async function DictionaryImportPage() {
  const auth = await requireAuthContext()
  if (!isDictionaryContentEnabled()) notFound()
  const context = await getTransferContext(await createClient(), auth.userId)
  return (
    <section className={styles.page}>
      <header>
        <Link href="/app/collections">Collections</Link>
        <h1 className="dw-page-title">Import a collection</h1>
      </header>
      <DictionaryDocumentImport
        key={auth.userId}
        ownerId={auth.userId}
        {...context}
      />
    </section>
  )
}
