// Client-side Component Registry (Dev Only)
(function(){
  if (window.ComponentRegistryClient) return;
  const isProd = (window.NODE_ENV || document.documentElement.dataset.env) === 'production';
  const registered = new Map();

  function register(name, from) {
    if (!name) return;
    const existing = registered.get(name);
    if (existing && !isProd) {
      console.warn(`ComponentRegistryClient: duplicate init for '${name}'. Existing: ${existing}, New: ${from||'unknown'}`);
    }
    registered.set(name, from || 'unknown');
  }

  function list() {
    return Array.from(registered.entries()).map(([name, src]) => ({ name, source: src }));
  }

  window.ComponentRegistryClient = { register, list };
})();


