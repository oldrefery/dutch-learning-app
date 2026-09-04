'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { createCollection } from './actions'
import { INITIAL_COLLECTION_FORM_STATE } from './form-state'

export function CreateCollectionForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(
    createCollection,
    INITIAL_COLLECTION_FORM_STATE
  )

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset()
    }
  }, [state.status])

  return (
    <form ref={formRef} action={action}>
      <h2 className="text-lg font-semibold">Create a collection</h2>
      <p className="dw-support mt-1">
        Start with an empty collection, then add Dutch words to it.
      </p>
      <div className="mt-4 grid gap-3">
        <div className="flex-1">
          <label className="sr-only" htmlFor="collection-name">
            Collection name
          </label>
          <Field
            aria-describedby="collection-name-error"
            aria-invalid={Boolean(state.fieldErrors?.name)}
            id="collection-name"
            maxLength={50}
            name="name"
            placeholder="Collection name"
            required
            type="text"
          />
          {state.fieldErrors?.name && (
            <p
              className="mt-2 text-sm text-red-600 dark:text-red-400"
              id="collection-name-error"
            >
              {state.fieldErrors.name}
            </p>
          )}
        </div>
        <Button disabled={pending} type="submit">
          {pending ? 'Creating…' : 'Create'}
        </Button>
      </div>
      {state.message && (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${
            state.status === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
