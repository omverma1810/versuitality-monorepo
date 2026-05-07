'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Copy,
  Mail,
  Plus,
  RefreshCcw,
  ShieldCheck,
  UserCog,
  UserX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleBadge } from '@/components/ui/role-badge';
import { useAuthGate } from '@/hooks/useAuthGate';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type InvitePayload,
  type Role,
  type User,
} from '@versuitality/types';

const ROLE_OPTIONS: Role[] = ['admin', 'staff', 'master', 'qa', 'accountant'];

interface PaginatedUsers {
  count: number;
  results: User[];
}

export default function AdminUsersPage() {
  const { ready } = useAuthGate({ roles: ['admin'] });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [lastInvite, setLastInvite] = useState<InvitePayload | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<PaginatedUsers>('/api/users/?limit=100');
      setUsers(data.results);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.includes(q),
    );
  }, [users, search]);

  async function handleRoleChange(user: User, role: Role) {
    if (user.role === role) return;
    try {
      const updated = await api<User>(`/api/users/${user.id}/`, {
        method: 'PATCH',
        body: { role },
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update role.');
    }
  }

  async function handleToggleActive(user: User) {
    try {
      const updated = await api<User>(`/api/users/${user.id}/`, {
        method: 'PATCH',
        body: { is_active: !user.is_active },
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update user.');
    }
  }

  async function handleReissueInvite(user: User) {
    try {
      const inv = await api<InvitePayload['invite']>(
        `/api/users/${user.id}/reissue_invite/`,
        { method: 'POST' },
      );
      setLastInvite({ user, invite: inv });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to reissue invite.');
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
            Administration
          </p>
          <h1 className="font-display text-3xl gold-text">Team & roles</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Invite teammates, assign roles, and revoke access. Role changes
            take effect on the next API call.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} size="md">
          <Plus className="h-4 w-4" />
          Invite teammate
        </Button>
      </div>

      <div className="glass-panel p-4">
        <Input
          name="search"
          placeholder="Search by name, email, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-status-rejected/40 bg-status-rejected/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-white/5 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-foreground/40">
          <div className="col-span-5">Member</div>
          <div className="col-span-3">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-foreground/50">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500/40 border-t-gold-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-foreground/40">
            No teammates match this search.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((u) => (
              <li
                key={u.id}
                className="grid grid-cols-12 items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="col-span-5 flex items-center gap-3">
                  <Avatar name={u.full_name} src={u.avatar_url || null} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{u.full_name}</p>
                    <p className="truncate text-xs text-foreground/50">{u.email}</p>
                  </div>
                </div>

                <div className="col-span-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs outline-none transition-colors focus:border-gold-500/50"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r} className="bg-navy-700">
                        {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider',
                      u.is_active
                        ? 'border-status-ready/40 bg-status-ready/10 text-emerald-200'
                        : 'border-foreground/20 bg-white/5 text-foreground/50',
                    )}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                    {u.is_active ? 'Active' : 'Pending / disabled'}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1">
                  {!u.is_active && (
                    <button
                      onClick={() => handleReissueInvite(u)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-foreground/70 hover:bg-white/10"
                      title="Re-issue invitation token"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Resend
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border text-xs',
                      u.is_active
                        ? 'border-status-rejected/30 bg-status-rejected/10 text-red-200 hover:bg-status-rejected/20'
                        : 'border-status-ready/30 bg-status-ready/10 text-emerald-200 hover:bg-status-ready/20',
                    )}
                    title={u.is_active ? 'Deactivate' : 'Reactivate'}
                  >
                    {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {inviteOpen && (
          <InviteModal
            onClose={() => setInviteOpen(false)}
            onInvited={(payload) => {
              setUsers((prev) => [payload.user, ...prev]);
              setLastInvite(payload);
              setInviteOpen(false);
            }}
          />
        )}
        {lastInvite && (
          <InviteResultModal
            payload={lastInvite}
            onClose={() => setLastInvite(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (payload: InvitePayload) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = await api<InvitePayload>('/api/users/', {
        method: 'POST',
        body: { email, full_name: fullName, role },
      });
      onInvited(payload);
    } catch (err) {
      if (err instanceof ApiError && typeof err.data === 'object' && err.data) {
        const data = err.data as Record<string, unknown>;
        const first =
          (Array.isArray(data.email) && data.email[0]) ||
          (Array.isArray(data.full_name) && data.full_name[0]) ||
          (Array.isArray(data.role) && data.role[0]) ||
          err.message;
        setError(String(first));
      } else {
        setError('Could not invite this user.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.2 }}
        className="glass-panel w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
              New invitation
            </p>
            <h2 className="font-display text-2xl gold-text">Invite a teammate</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-foreground/50 hover:bg-white/5 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Full name"
            name="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Sirish Kumar Golem"
            icon={<UserCog className="h-4 w-4" />}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@versuitality.com"
            icon={<Mail className="h-4 w-4" />}
          />
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground/60">
              Role
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROLE_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all',
                    role === r
                      ? 'border-gold-500/60 bg-gold-500/10 text-gold-200 shadow-gold'
                      : 'border-white/10 bg-white/[0.02] text-foreground/60 hover:border-white/20',
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-foreground/40">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-status-rejected/40 bg-status-rejected/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Send invitation
            </Button>
          </div>
        </form>
      </motion.div>
    </Backdrop>
  );
}

function InviteResultModal({
  payload,
  onClose,
}: {
  payload: InvitePayload;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const fullUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${payload.invite.setup_url}`
      : payload.invite.setup_url;

  async function copy() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Backdrop onClose={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.2 }}
        className="glass-panel w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/40">
              Invitation sent
            </p>
            <h2 className="font-display text-2xl gold-text">Setup link ready</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 p-1.5 text-foreground/50 hover:bg-white/5 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-foreground/60">
          Email delivery ships in Phase 6. Until then, copy this link and send
          it to <span className="text-foreground">{payload.user.full_name}</span> —
          the link is single-use and expires on{' '}
          <span className="text-gold-300">
            {new Date(payload.invite.expires_at).toLocaleDateString()}
          </span>
          .
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs">
          <code className="flex-1 truncate font-mono text-gold-200">{fullUrl}</code>
          <button
            onClick={copy}
            className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-foreground/70 hover:bg-white/10"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </motion.div>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/70 px-4 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}
