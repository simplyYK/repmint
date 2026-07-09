'use client'
import { useState } from 'react'

const FORMSPREE_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID

export default function WaitlistForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  if (status === 'success') {
    return (
      <div className="waitlist-form-wrap">
        <p className="waitlist-confirm">You&apos;re on the list. We&apos;ll be in touch.</p>
      </div>
    )
  }

  if (!FORMSPREE_ID) {
    return (
      <div className="waitlist-actions">
        <a className="button button-primary" href="mailto:hello@repmint.ai?subject=RepMint%20pilot%20request&body=Hi%20RepMint%2C%0A%0AI%27d%20like%20to%20join%20the%20pilot.%0A%0AMy%20main%20training%20goal%3A%0AMy%20current%20routine%3A%0AWhat%20I%20want%20help%20with%3A">
          Get Early Access
        </a>
        <a className="button button-secondary" href="mailto:hello@repmint.ai?subject=RepMint%20survey&body=Hi%20RepMint%2C%0A%0AI%27d%20like%20to%20answer%20the%20validation%20survey.">
          Take Survey
        </a>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      body: new FormData(e.currentTarget),
      headers: { Accept: 'application/json' },
    })
    setStatus(res.ok ? 'success' : 'error')
  }

  return (
    <form className="waitlist-form" onSubmit={handleSubmit}>
      <input
        className="waitlist-input"
        type="email"
        name="email"
        placeholder="your@email.com"
        required
        disabled={status === 'loading'}
        aria-label="Email address"
      />
      <button className="button button-primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending…' : 'Get Early Access'}
      </button>
      {status === 'error' && (
        <p className="waitlist-error">
          Something went wrong. Email <a href="mailto:hello@repmint.ai">hello@repmint.ai</a> directly.
        </p>
      )}
      <a
        className="waitlist-survey-link"
        href="mailto:hello@repmint.ai?subject=RepMint%20survey&body=Hi%20RepMint%2C%0A%0AI%27d%20like%20to%20answer%20the%20validation%20survey."
      >
        Take the survey instead
      </a>
    </form>
  )
}
