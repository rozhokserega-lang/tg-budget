/** In-memory request cache. No account data is persisted. */
(function (root) {
  var DEFAULT_TTL = 5 * 60 * 1000;

  function create(options) {
    options = options || {};
    var ttl = options.ttl === undefined ? DEFAULT_TTL : options.ttl;
    var now = options.now || Date.now;
    var entries = new Map();
    var pending = new Map();
    var versions = new Map();
    var epoch = 0;
    var scope;

    function staleError() {
      var error = new Error('Response belongs to an obsolete cache context');
      error.code = 'stale_response';
      return error;
    }

    function read(key, allowStale) {
      var entry = entries.get(key);
      return entry && (allowStale || now() - entry.at < ttl) ? entry.data : null;
    }

    function write(key, data) {
      // A confirmed mutation must also supersede an older read of this key.
      versions.set(key, (versions.get(key) || 0) + 1);
      pending.delete(key);
      entries.set(key, { data: data, at: now() });
      return data;
    }

    function fetchData(key, loader, fetchOptions) {
      if (pending.has(key)) return pending.get(key).promise;
      if (!(fetchOptions && fetchOptions.force)) {
        var hit = read(key);
        if (hit !== null) return Promise.resolve(hit);
      }
      var request = { epoch: epoch, version: versions.get(key) || 0 };
      function obsolete() {
        return request.epoch !== epoch || request.version !== (versions.get(key) || 0);
      }
      function finish() {
        if (pending.get(key) === request) pending.delete(key);
      }
      request.promise = Promise.resolve().then(loader).then(function (data) {
        finish();
        if (obsolete()) throw staleError();
        // API resources are JSON. Reuse equal data so consumers can skip paints.
        var previous = entries.get(key);
        if (previous && JSON.stringify(previous.data) === JSON.stringify(data)) data = previous.data;
        entries.set(key, { data: data, at: now() });
        return data;
      }, function (error) {
        finish();
        if (obsolete()) throw staleError();
        throw error;
      });
      pending.set(key, request);
      return request.promise;
    }

    function invalidate(keys) {
      if (keys) {
        keys.forEach(function (key) {
          versions.set(key, (versions.get(key) || 0) + 1);
          pending.delete(key);
          var entry = entries.get(key);
          if (entry) entry.at = -Infinity;
        });
        return;
      }
      epoch++;
      entries.clear();
      pending.clear();
      versions.clear();
    }

    function setScope(nextScope) {
      if (scope === nextScope) return false;
      scope = nextScope;
      invalidate();
      return true;
    }

    return { read: read, write: write, fetch: fetchData, invalidate: invalidate, setScope: setScope };
  }

  root.BudgetCache = { DEFAULT_TTL: DEFAULT_TTL, create: create };
})(window);
