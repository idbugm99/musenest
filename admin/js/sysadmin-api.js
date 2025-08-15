(() => {
  const PREFIX_MAP = [
    [/^\/api\/system-management(\/|$)/, '/api/sysadmin/system$1'],
    [/^\/api\/admin-business(\/|$)/, '/api/sysadmin/business$1'],
    [/^\/api\/admin-models(\/|$)/, '/api/sysadmin/models$1'],
    [/^\/api\/ai-server-management(\/|$)/, '/api/sysadmin/ai-servers$1'],
    [/^\/api\/media-review-queue(\/|$)/, '/api/media-review-queue$1'],
    [/^\/api\/site-configuration(\/|$)/, '/api/sysadmin/site-configuration$1'],
    [/^\/api\/model-dashboard(\/|$)/, '/api/sysadmin/model-dashboard$1'],
  ];

  function rewritePath(path) {
    if (typeof path !== 'string') return path;
    for (const [re, repl] of PREFIX_MAP) {
      if (re.test(path)) return path.replace(re, repl);
    }
    return path;
  }

  async function sysFetch(input, init) {
    if (typeof input === 'string') {
      return fetch(rewritePath(input), init);
    }
    // Request object
    try {
      const url = new URL(input.url, window.location.origin);
      const rewritten = rewritePath(url.pathname) + url.search + url.hash;
      return fetch(rewritten, init || input);
    } catch (_e) {
      return fetch(input, init);
    }
  }

  window.SysadminApi = { rewritePath, fetch: sysFetch };
  window.sysFetch = sysFetch;
})();


