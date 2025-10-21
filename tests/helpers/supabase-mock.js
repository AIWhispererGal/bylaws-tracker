/**
 * Supabase Mock Helper
 * Provides chainable Supabase client mock for testing
 */

/**
 * Creates a complete chainable Supabase mock
 * @returns {Object} Chainable mock object
 */
function createSupabaseMock() {
  const mockChain = {
    // Query builders
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),

    // Filters
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    rangeGt: jest.fn().mockReturnThis(),
    rangeLt: jest.fn().mockReturnThis(),
    rangeGte: jest.fn().mockReturnThis(),
    rangeLte: jest.fn().mockReturnThis(),
    rangeAdjacent: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),

    // Modifiers
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),

    // Execution methods
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockResolvedValue({ data: [], error: null }),
  };

  return mockChain;
}

/**
 * Creates a Supabase client mock with predefined responses
 * @param {Object} config - Configuration for mock responses
 * @param {Object} config.data - Default data to return
 * @param {Object} config.error - Default error to return
 * @returns {Object} Configured Supabase mock
 */
function createSupabaseClientMock(config = {}) {
  const { data = [], error = null } = config;

  const mockChain = createSupabaseMock();

  // Override default responses
  mockChain.single.mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error });
  mockChain.maybeSingle.mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error });
  mockChain.then.mockResolvedValue({ data, error });

  return mockChain;
}

/**
 * Creates a mock for Supabase auth
 * @returns {Object} Auth mock
 */
function createAuthMock() {
  return {
    signUp: jest.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
    signIn: jest.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
    refreshSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null }),
    updateUser: jest.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
    resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
  };
}

/**
 * Creates a full Supabase client mock with auth
 * @param {Object} config - Configuration for mock responses
 * @returns {Object} Full Supabase client mock
 */
function createFullSupabaseMock(config = {}) {
  const queryMock = createSupabaseClientMock(config);

  return {
    from: jest.fn().mockReturnValue(queryMock),
    auth: createAuthMock(),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
        download: jest.fn().mockResolvedValue({ data: {}, error: null }),
        remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ publicURL: 'https://example.com/file' }),
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: {}, error: null }),
  };
}

/**
 * Reset all mocks in a Supabase mock
 * @param {Object} supabaseMock - The mock to reset
 */
function resetSupabaseMock(supabaseMock) {
  Object.keys(supabaseMock).forEach(key => {
    if (typeof supabaseMock[key] === 'function' && supabaseMock[key].mockReset) {
      supabaseMock[key].mockReset();
    } else if (typeof supabaseMock[key] === 'object' && supabaseMock[key] !== null) {
      resetSupabaseMock(supabaseMock[key]);
    }
  });
}

module.exports = {
  createSupabaseMock,
  createSupabaseClientMock,
  createAuthMock,
  createFullSupabaseMock,
  resetSupabaseMock,
};
