import { useCallback, useEffect, useState } from 'react';
import type { AdminAuthConfig, OAuthProvider } from '@bestchain/shared';
import { api } from '../api.js';
import { setToken } from '../auth.js';

const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
};

/**
 * Reads a value out of the URL fragment and clears it. The OAuth callback
 * returns the stage-one token there rather than in a query string, so it never
 * reaches a server log or a Referer header; clearing it keeps it out of the
 * address bar and out of the browser history entry.
 */
function takeFromFragment(key: string): string | null {
  if (!window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const value = params.get(key);
  if (value === null) return null;

  params.delete(key);
  const rest = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (rest ? `#${rest}` : ''));
  return value;
}

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [config, setConfig] = useState<AdminAuthConfig | null>(null);
  const [stageOneToken, setStageOneToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStageOneToken(takeFromFragment('stage1'));
    const failure = takeFromFragment('error');
    if (failure) setError(failure);

    api
      .authConfig()
      .then(setConfig)
      .catch(() => setError('Cannot reach the backend.'));
  }, []);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const { accessToken } = await api.login(username, password, stageOneToken);
        setToken(accessToken);
        onSuccess();
      } catch {
        setError('Rejected. Check the username and password.');
      } finally {
        setBusy(false);
      }
    },
    [username, password, stageOneToken, onSuccess],
  );

  if (!config) {
    return (
      <div className="login">
        <p className="muted">{error ?? '…'}</p>
      </div>
    );
  }

  const needsProvider = config.oauthRequired && !stageOneToken;

  return (
    <div className="login">
      <div className="login__card">
        <h1>admin</h1>

        <ol className="stages" aria-label="Sign-in stages">
          {config.oauthRequired && (
            <li className={stageOneToken ? 'is-done' : 'is-active'}>
              <span className="stages__mark">{stageOneToken ? '✓' : '1'}</span>
              Identity
            </li>
          )}
          <li className={needsProvider ? '' : 'is-active'}>
            <span className="stages__mark">{config.oauthRequired ? '2' : '1'}</span>
            Credentials
          </li>
        </ol>

        {error && <p className="banner banner--critical">{error}</p>}

        {needsProvider ? (
          <>
            <p className="muted small">
              Sign in with the account registered as <code>ADMIN_EMAIL</code>.
            </p>
            {config.providers.length === 0 ? (
              <p className="banner banner--warning">
                No provider is configured. Set <code>OAUTH_GOOGLE_CLIENT_ID</code>/
                <code>_SECRET</code> or the GitHub pair.
              </p>
            ) : (
              <div className="providers">
                {config.providers.map((provider) => (
                  <a
                    key={provider}
                    className="btn btn--primary"
                    href={`/api/auth/oauth/${provider}`}
                  >
                    Continue with {PROVIDER_LABELS[provider]}
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Enter'}
            </button>
          </form>
        )}

        {!config.oauthRequired && (
          <p className="muted small">
            The identity stage is off because <code>ADMIN_EMAIL</code> is unset. It cannot be
            skipped in production.
          </p>
        )}
      </div>
    </div>
  );
}
