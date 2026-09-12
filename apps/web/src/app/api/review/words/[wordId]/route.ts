import { NextResponse } from 'next/server'
import { getOwnedReviewWordDetail } from '@/features/review/details-repository'
import { requireAuthenticatedIdentity } from '@/lib/auth/session'
import { isUuid } from '@/features/words/word-detail'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wordId: string }> }
) {
  const { wordId } = await params
  if (!isUuid(wordId)) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'The word is not available for this session.',
      },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

  const auth = await requireAuthenticatedIdentity()
  try {
    const word = await getOwnedReviewWordDetail(auth.userId, wordId)
    if (!word) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'The word is not available for this session.',
        },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } }
      )
    }
    return NextResponse.json(
      { status: 'success', word },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Could not load the full card. Please try again.',
      },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
