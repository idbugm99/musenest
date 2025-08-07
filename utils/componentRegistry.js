/*
 Component Registry Warning Helper
 ---------------------------------
 Purpose: Detect duplicate component registrations and log warnings to help
 clean up redundant/old code references. Use in dev only.
*/

const isProduction = process.env.NODE_ENV === 'production';
const registeredComponents = new Map();

function registerComponent(name, sourcePath) {
  if (!name) return;
  const existing = registeredComponents.get(name);
  if (existing && !isProduction) {
    // eslint-disable-next-line no-console
    console.warn(`ComponentRegistry: duplicate registration for '${name}'. Existing: ${existing}, New: ${sourcePath}`);
  }
  registeredComponents.set(name, sourcePath || 'unknown');
}

function getRegisteredComponents() {
  return Array.from(registeredComponents.entries()).map(([name, source]) => ({ name, source }));
}

module.exports = {
  registerComponent,
  getRegisteredComponents,
};


