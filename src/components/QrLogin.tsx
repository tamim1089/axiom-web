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

/* ── design harness ───────────────────────────────────────────────────────
 * This page is the hardest one in the app to look at: it needs a phone to get
 * past, and once a session exists it never renders again. So it was being
 * iterated on blind, which is how a column sized for a laptop shipped with its
 * last step under the fold on a phone.
 *
 * /app.html#signin fakes a live code and skips every network call, so the
 * layout can be checked at any window size. Same idea as the workspace's
 * #demo, and gated on DEV the same way, so it is dropped from production.
 * ──────────────────────────────────────────────────────────────────────── */
const HARNESS = import.meta.env.DEV && window.location.hash === '#signin'

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

  /* Resume an existing session before offering a new login. A returning user
     should never be asked to scan again just because they reloaded the tab. */
  useEffect(() => {
    let cancelled = false
    if (HARNESS) {
      QRCode.toDataURL('https://t.me/login?token=harness', {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 640,
        color: { dark: '#0a0a0bff', light: '#ffffffff' },
      })
        .then(setQrPng)
        .catch(() => setQrPng(null))
      setState({ kind: 'qr', url: '', expires: new Date(Date.now() + 30_000) })
      return
    }
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
            // Fixed colours in both themes. A QR is a scanning target, not a
            // surface: decoders expect dark modules on a light ground, and a
            // transparent background inherits whatever is behind it, which in
            // dark mode made the code black on near-black and unscannable.
            color: { dark: '#0a0a0bff', light: '#ffffffff' },
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
    /* svh, not vh: on a phone vh is the tallest the viewport ever gets, so a
       vh-sized column sits partly under the browser chrome until you scroll.
       The page is sized to fit rather than to scroll, because everything on it
       is needed at once, the code and the instructions for using it. */
    <main className="flex min-h-[100svh] flex-col bg-paper">
      <header className="shrink-0 border-b border-line">
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

      {/* Every gap on this page is viewport-relative, because the page has a
          fixed amount to say and a viewport that varies by a factor of three.
          Fixed padding sized for a laptop pushes the last step off a short
          window; sized for a short window it looks starved on a large one.
          clamp() gives each gap a floor, a share of the height, and a ceiling,
          so the column compresses in one motion instead of scrolling. */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-[clamp(0.75rem,2.5vh,3.5rem)] text-center">
        <Mark className="size-[clamp(2.25rem,5.5vh,3.5rem)] shrink-0 [@media(max-height:660px)]:hidden" />

        {state.kind === 'password' ? (
          <>
            <h1 className="mt-8 text-[clamp(2rem,4vw,2.75rem)]">Two-step verification</h1>
            <p className="mt-4 text-lead leading-relaxed text-graphite">
              Your account has a password. Enter it to finish. Telegram checks it over SRP
              and it is never sent anywhere else.
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
            <h1 className="mt-[clamp(0.75rem,3vh,2rem)] text-[clamp(2rem,min(4vw,5.5vh),2.75rem)]">
              Open Axiom
            </h1>
            {/* The old lead opened "Scan with the Telegram app on your phone",
                which is step 1 and step 3 said again above the steps: four
                lines on a phone, 118px, spent on the one instruction the page
                repeats twice below. What is left is the part the steps do not
                cover, which is what signing in costs you. */}
            <p className="mt-[clamp(0.5rem,1.5vh,1rem)] max-w-md text-lead leading-relaxed text-graphite">
              Links your storage to this browser. No password, no account to create.
            </p>

            {/* The QR plate keeps a fixed footprint across every state, so the
                layout never jumps between connecting, live, and scanned.

                It is the one element that can afford to give height back: a
                code only has to be big enough for a phone camera to resolve.
                31vh keeps it the largest thing on the page at every window
                size, capped at 18rem so it stops growing once it is
                comfortably scannable, and never falling below ~176px, which
                is about six device pixels per module on a phone. */}
            <div className="relative mt-[clamp(0.75rem,3vh,2.5rem)] flex size-[min(18rem,31vh)] shrink-0 items-center justify-center rounded-3xl border border-line bg-white">
              {state.kind === 'qr' && qrPng ? (
                /* Sized as a share of the plate rather than a fixed 15rem, so
                   the quiet zone around the code stays proportional as the
                   plate shrinks. */
                <img
                  src={qrPng}
                  alt="Telegram login QR code"
                  width={640}
                  height={640}
                  className="size-[83%]"
                />
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
                /* Resting. No spinner here. Nothing is happening yet, and a
                   spinner next to a button that says "Show QR code" claims
                   otherwise. */
                <QrCode className="size-14 text-line" strokeWidth={1.25} />
              )}
            </div>

            {state.kind === 'qr' && (
              <p className="mt-[clamp(0.5rem,1.5vh,1.25rem)] text-small text-titanium">
                Code refreshes in {seconds}s
              </p>
            )}

            {/* Only failure needs a button now. The code fetches itself. */}
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
                of being pushed around by "1." / "2." / "3." widths.

                Compact rather than three across. Across is shorter, but step 2
                is the longest line on the page and a third of a phone's width
                wraps it to five lines against a one-line neighbour. Squeezing
                the rows instead keeps every step on one or two lines at a size
                that reads at arm's length, and still lands step 3 above the
                fold on a short window.

                The chip is ink on paper, not grey on mist: it is the only
                thing that says which step you are on, and at 3:1 against the
                background it was the first thing to disappear on a phone held
                at an angle in daylight. */}
            <ol className="mt-[clamp(0.875rem,3vh,3rem)] w-full space-y-[clamp(0.375rem,1.2vh,0.75rem)] text-left">
              {[
                'Open Telegram on your phone',
                'Go to Settings → Devices → Link Desktop Device',
                'Point it at the code above',
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-tiny font-semibold text-paper">
                    {i + 1}
                  </span>
                  <span className="text-small leading-snug text-graphite">{step}</span>
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
