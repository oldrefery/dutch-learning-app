import type { ReviewCollection } from './types'

export function ReviewCollectionLabel({
  collections,
  collectionId,
}: {
  collections: ReviewCollection[]
  collectionId: string | null
}) {
  const name = collections.find(
    collection => collection.id === collectionId
  )?.name
  return name ? (
    <p className="dw-support break-words">Collection · {name}</p>
  ) : null
}
