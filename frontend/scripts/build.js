const frontendEnvironmentVariables = new Set([
  'REACT_APP_BACKEND_URL',
  'REACT_APP_SOCKET_URL'
]);

Object.keys(process.env)
  .filter((name) => name.startsWith('REACT_APP_') && !frontendEnvironmentVariables.has(name))
  .forEach((name) => delete process.env[name]);

require('react-scripts/scripts/build');
