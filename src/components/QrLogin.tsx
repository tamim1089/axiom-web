import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowLeft, QrCode, RefreshCw } from 'lucide-react'
import { getClient, requestPersistentStorage } from '@/lib/telegram'
import { forgetVault } from '@/lib/vault'
import { Mark } from '@/components/Mark'
import { Workspace } from '@/components/app/Workspace'

type User = { displayName: string; username?: string | null; id: number }

type State =
  | { kind: 'checking' }
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'qr'; url: string; expires: Date }
  | { kind: 'scanned' }
  | { kind: 'password' }
  | { kind: 'done'; user: User }
  | { kind: 'error'; message: string }

/** Countdown against the token's own expiry, so the UI never lies about staleness. */
function useSecondsLeft(expires?: Date) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!expires) return
    const tick = () =>
      setLeft(Math.max(0, Math.round((expires.getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expires])
  return left
}

export function QrLogin({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<State>({ kind: 'checking' })
  const [qrPng, setQrPng] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  // signInQr asks for the 2FA password by calling a function and awaiting it.
  // We park the resolver here and hand it the value when the form is submitted.
  const passwordResolver = useRef<((value: string) => void) | null>(null)
  const started = useRef(false)

  const seconds = useSecondsLeft(state.kind === 'qr' ? state.expires : undefined)

  /* Resume an existing session before offering a new login — a returning user
     should never be asked to scan again just because they reloaded the tab. */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getClient().getMe()
        if (!cancelled && me) {
          setState({
            kind: 'done',
            user: { displayName: me.displayName, username: me.username, id: me.id },
          })
          return
        }
      } catch {
        /* No stored session, or it was revoked from another device. Sign in. */
      }
      // Nobody arrives here wanting to look at a button. Requesting the code is
      // the only reason to be on this page, so it starts on its own and the
      // space a "Show QR code" button occupied goes to the instructions.
      if (!cancelled) void signIn()
    })()
    return () => {
      cancelled = true
    }
    // signIn is a stable useCallback with no deps; re-running this on identity
    // change would start a second login flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = useCallback(async () => {
    if (started.current) return
    started.current = true
    setState({ kind: 'connecting' })

    try {
      const me = await getClient().signInQr({
        onUrlUpdated: (url, expires) => {
          // mtcute regenerates the token before it expires and calls this
          // again, so the QR on screen is always the live one.
          QRCode.toDataURL(url, {
            errorCorrectionLevel: 'M',
            margin: 0,
            width: 640,
            color: { dark: '#0a0a0bff', light: '#00000000' },
          })
            .then(setQrPng)
            .catch(() => setQrPng(null))
          setState({ kind: 'qr', url, expires })
        },
        onQrScanned: () => setState({ kind: 'scanned' }),
        password: () =>
          new Promise<string>((resolve) => {
            passwordResolver.current = resolve
            setState({ kind: 'password' })
          }),
        invalidPasswordCallback: () => {
          setPasswordBusy(false)
          setState({ kind: 'password' })
        },
      })

      // Now that there is a session worth keeping, ask the browser to keep it.
      void requestPersistentStorage()
      setState({
        kind: 'done',
        user: { displayName: me.displayName, username: me.username, id: me.id },
      })
    } catch (err) {
      started.current = false
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [])

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordResolver.current || !password) return
    setPasswordBusy(true)
    setState({ kind: 'scanned' })
    passwordResolver.current(password)
    passwordResolver.current = null
    setPassword('')
  }

  const signOut = async () => {
    try {
      await getClient().logOut()
    } catch {
      /* Already gone server-side; the local session is dropped either way. */
    }
    started.current = false
    setQrPng(null)
    forgetVault()
    // Straight back to a live code rather than an idle screen with nothing on it.
    void signIn()
  }

  /* Signed in means the workspace, not a congratulations screen. The sign-in
     view's whole job is to stop existing. */
  if (state.kind === 'done') {
    return <Workspace user={state.user} onSignOut={signOut} />
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <button
            onClick={onBack}
            className="tap items-center gap-2 text-body text-titanium transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-5" />
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
        <Mark className="size-14" />

        {state.kind === 'password' ? (
          <>
            <h1 className="mt-8 text-[clamp(2rem,4vw,2.75rem)]">Two-step verification</h1>
            <p className="mt-4 text-lead leading-relaxed text-graphite">
              Your account has a password. Enter it to finish — it's checked by Telegram
              over SRP and never sent anywhere else.
            </p>
            <form onSubmit={submitPassword} className="mt-8 w-full">
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Telegram password"
                className="h-14 w-full rounded-xl border border-line bg-paper px-4 text-center text-body outline-none transition-colors placeholder:text-titanium focus:border-signal"
              />
              <button
                type="submit"
                disabled={!password || passwordBusy}
                className="mt-3 h-14 w-full rounded-xl bg-ink text-lead font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Continue
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-[clamp(2rem,4vw,2.75rem)]">Open Axiom</h1>
            <p className="mt-4 max-w-md text-lead leading-relaxed text-graphite">
              Scan with the Telegram app on your phone. This links your storage to this
              browser — no password, no account to create.
            </p>

            {/* The QR plate keeps a fixed footprint across every state, so the
                layout never jumps between connecting, live, and scanned. */}
            <div className="relative mt-10 flex size-72 items-center justify-center rounded-3xl border border-line bg-mist">
              {state.kind === 'qr' && qrPng ? (
                <img src={qrPng} alt="Telegram login QR code" width={640} height={640} className="size-60" />
              ) : state.kind === 'error' ? (
                <p className="px-8 text-small leading-relaxed text-titanium">
                  {state.message}
                </p>
              ) : state.kind === 'connecting' || state.kind === 'scanned' ? (
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw
                    className="size-6 animate-spin text-titanium"
                    style={{ animationDuration: '1.6s' }}
                  />
                  <span className="text-small font-medium text-titanium">
                    {state.kind === 'scanned' ? 'Authorising' : 'Connecting'}
                  </span>
                </div>
              ) : (
                /* Resting. No spinner here — nothing is happening yet, and a
                   spinner next to a button that says "Show QR code" claims
                   otherwise. */
                <QrCode className="size-14 text-line" strokeWidth={1.25} />
              )}
            </div>

            {state.kind === 'qr' && (
              <p className="mt-5 text-small text-titanium">Code refreshes in {seconds}s</p>
            )}

            {/* Only failure needs a button now — the code fetches itself. */}
            {state.kind === 'error' && (
              <button
                onClick={signIn}
                className="mt-8 h-14 w-full rounded-xl bg-ink text-lead font-medium text-paper transition-opacity hover:opacity-90"
              >
                Try again
              </button>
            )}

            {/* Numbered steps as real steps: the numeral is a token in its own
                column, so the instruction text starts on one left edge instead
                of being pushed around by "1." / "2." / "3." widths. */}
            <ol className="mt-12 w-full space-y-5 text-left">
              {[
                'Open Telegram on your phone',
                'Go to Settings → Devices → Link Desktop Device',
                'Point it at the code above',
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mist text-small font-semibold text-graphite">
                    {i + 1}
                  </span>
                  <span className="text-body leading-snug text-graphite">{step}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  )
}

export default QrLogin
