import { useState } from 'react';
import { loginWithPassword, loginWithGoogle, resetPassword, authErrorMessage } from '@/core/firebase';

interface Props { online: boolean; onDone: () => void; onClose: () => void }

export function Login({ online, onDone, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { await loginWithPassword(email, password); onDone(); }
    catch (err) { setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setError(null); setBusy(true);
    try { await loginWithGoogle(); onDone(); } catch (err) { setError(authErrorMessage(err)); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email) { setError('Escribe tu correo para enviarte el enlace de recuperación.'); return; }
    try { await resetPassword(email); setInfo('Te enviamos un correo para cambiar la contraseña.'); } catch (err) { setError(authErrorMessage(err)); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>Iniciar sesión</h2>
        <p className="muted">Usa el usuario y la contraseña que te asignó el administrador de SISVAN.</p>
        {!online && <p className="msg-warning">Sin conexión. Puedes seguir digitando; inicia sesión cuando vuelva la señal.</p>}
        <label>Correo o usuario
          <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>Contraseña
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <p className="msg-error">{error}</p>}
        {info && <p className="msg-ok">{info}</p>}
        <div className="modal-actions">
          <button type="submit" className="primary" disabled={busy || !online}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <button type="button" onClick={google} disabled={busy || !online}>Entrar con cuenta Google</button>
          <button type="button" className="link" onClick={reset} disabled={!online}>Olvidé mi contraseña</button>
          <button type="button" className="link" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
