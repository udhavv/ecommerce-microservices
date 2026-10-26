import crypto from 'node:crypto';

// In-memory tables
export const tables = {
  users: [],
  roles: [
    { id: 1, name: 'user' },
    { id: 2, name: 'admin' },
  ],
  user_roles: [],
  sessions: [],
  email_verification_tokens: [],
  password_reset_tokens: [],
  security_audit_events: [],
};

// Helper to clear database between test suites
export function resetDatabase() {
  tables.users = [];
  tables.user_roles = [];
  tables.sessions = [];
  tables.email_verification_tokens = [];
  tables.password_reset_tokens = [];
  tables.security_audit_events = [];
}

export function handleQuery(sql, params = []) {
  const query = sql.replace(/\s+/g, ' ').trim();

  // Transactions
  if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK' || query === 'SELECT 1') {
    return { rows: [], rowCount: 0 };
  }

  // Insert into users
  if (query.includes('INSERT INTO users')) {
    const [email, password_hash, display_name] = params;
    const existing = tables.users.find((u) => u.email === email);
    if (existing) {
      const err = new Error('duplicate key');
      err.code = '23505';
      throw err;
    }
    const user = {
      id: crypto.randomUUID(),
      email,
      password_hash,
      display_name,
      status: 'pending',
      email_verified_at: null,
      created_at: new Date(),
    };
    tables.users.push(user);
    return { rows: [{ ...user }], rowCount: 1 };
  }

  // Insert into user_roles
  if (query.includes('INSERT INTO user_roles')) {
    const [userId] = params;
    tables.user_roles.push({ user_id: userId, role_id: 1, assigned_at: new Date() });
    return { rows: [], rowCount: 1 };
  }

  // Insert into email_verification_tokens
  if (query.includes('INSERT INTO email_verification_tokens')) {
    const [userId, tokenHash, expiresAt] = params;
    const record = {
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date(),
    };
    tables.email_verification_tokens.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // Select from email_verification_tokens
  if (query.includes('FROM email_verification_tokens')) {
    const [tokenHash] = params;
    const record = tables.email_verification_tokens.find((t) => t.token_hash === tokenHash);
    if (!record) return { rows: [], rowCount: 0 };
    const user = tables.users.find((u) => u.id === record.user_id);
    return {
      rows: [
        {
          id: record.id,
          user_id: record.user_id,
          expires_at: record.expires_at,
          used_at: record.used_at,
          email: user?.email,
          display_name: user?.display_name,
          status: user?.status,
        },
      ],
      rowCount: 1,
    };
  }

  // Update email_verification_tokens
  if (query.includes('UPDATE email_verification_tokens')) {
    const [id] = params;
    const record = tables.email_verification_tokens.find((t) => t.id === id);
    if (record) record.used_at = new Date();
    return { rows: [], rowCount: 1 };
  }

  // Update users (verify email)
  if (query.includes('UPDATE users') && query.includes("status = 'active'")) {
    const [id] = params;
    const user = tables.users.find((u) => u.id === id);
    if (user) {
      user.status = 'active';
      user.email_verified_at = new Date();
      return { rows: [{ ...user }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // Insert into password_reset_tokens
  if (query.includes('INSERT INTO password_reset_tokens')) {
    const [userId, tokenHash, expiresAt] = params;
    const record = {
      id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date(),
    };
    tables.password_reset_tokens.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // Update password_reset_tokens
  if (query.includes('UPDATE password_reset_tokens')) {
    if (query.includes('WHERE user_id = $1 AND used_at IS NULL')) {
      const [userId] = params;
      tables.password_reset_tokens
        .filter((t) => t.user_id === userId && !t.used_at)
        .forEach((t) => (t.used_at = new Date()));
      return { rows: [], rowCount: 1 };
    }
    const [id] = params;
    const record = tables.password_reset_tokens.find((t) => t.id === id);
    if (record) record.used_at = new Date();
    return { rows: [], rowCount: 1 };
  }

  // Select from password_reset_tokens
  if (query.includes('FROM password_reset_tokens')) {
    const [tokenHash] = params;
    const record = tables.password_reset_tokens.find((t) => t.token_hash === tokenHash);
    if (!record) return { rows: [], rowCount: 0 };
    const user = tables.users.find((u) => u.id === record.user_id);
    return {
      rows: [
        {
          id: record.id,
          user_id: record.user_id,
          expires_at: record.expires_at,
          used_at: record.used_at,
          email: user?.email,
          status: user?.status,
        },
      ],
      rowCount: 1,
    };
  }

  // Update users (change password)
  if (query.includes('UPDATE users') && query.includes('SET password_hash = $1')) {
    const [hash, id] = params;
    const user = tables.users.find((u) => u.id === id);
    if (user) {
      user.password_hash = hash;
      return { rows: [{ ...user }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // Select user by email
  if (query.includes('FROM users') && query.includes('WHERE email = $1')) {
    const [email] = params;
    const user = tables.users.find((u) => u.email === email);
    return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
  }

  // Select user by id
  if (query.includes('FROM users') && query.includes('WHERE id = $1')) {
    const [id] = params;
    const user = tables.users.find((u) => u.id === id);
    return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
  }

  // User roles lookup
  if (query.includes('FROM roles r') && query.includes('JOIN user_roles ur')) {
    const [userId] = params;
    const userRoles = tables.user_roles.filter((ur) => ur.user_id === userId);
    return {
      rows: userRoles.length > 0 ? [{ name: 'user' }] : [{ name: 'user' }],
      rowCount: 1,
    };
  }

  // Sessions insert
  if (query.includes('INSERT INTO sessions')) {
    const [userId, hash, expiresAt] = params;
    const session = {
      id: crypto.randomUUID(),
      user_id: userId,
      refresh_token_hash: hash,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: new Date(),
    };
    tables.sessions.push(session);
    return { rows: [session], rowCount: 1 };
  }

  // Select session
  if (query.includes('FROM sessions s') && query.includes('JOIN users u')) {
    const [hash] = params;
    const session = tables.sessions.find(
      (s) => s.refresh_token_hash === hash && !s.revoked_at && new Date(s.expires_at) > new Date(),
    );
    if (!session) return { rows: [], rowCount: 0 };
    const user = tables.users.find((u) => u.id === session.user_id);
    return {
      rows: [
        {
          session_id: session.id,
          user_id: session.user_id,
          email: user?.email,
          display_name: user?.display_name,
          status: user?.status,
          email_verified_at: user?.email_verified_at,
          created_at: user?.created_at,
        },
      ],
      rowCount: 1,
    };
  }

  // Revoke session
  if (query.includes('UPDATE sessions') && query.includes('SET revoked_at = NOW()')) {
    if (query.includes('WHERE refresh_token_hash = $1')) {
      const [hash] = params;
      const session = tables.sessions.find((s) => s.refresh_token_hash === hash && !s.revoked_at);
      if (session) {
        session.revoked_at = new Date();
        return { rows: [{ user_id: session.user_id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (query.includes('WHERE user_id = $1')) {
      const [userId] = params;
      tables.sessions
        .filter((s) => s.user_id === userId && !s.revoked_at)
        .forEach((s) => (s.revoked_at = new Date()));
      return { rows: [], rowCount: 1 };
    }
    if (query.includes('WHERE id = $1')) {
      const [id] = params;
      const session = tables.sessions.find((s) => s.id === id);
      if (session) session.revoked_at = new Date();
      return { rows: [], rowCount: 1 };
    }
  }

  // Insert into security_audit_events
  if (query.includes('INSERT INTO security_audit_events')) {
    const [userId, eventType, metadata] = params;
    tables.security_audit_events.push({
      id: tables.security_audit_events.length + 1,
      user_id: userId,
      event_type: eventType,
      metadata,
      created_at: new Date(),
    });
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

export const mockClient = {
  query: async (sql, params) => handleQuery(sql, params),
  release: () => {},
};

export const mockPool = {
  connect: async () => mockClient,
  query: async (sql, params) => handleQuery(sql, params),
  end: async () => {},
  on: () => {},
};
