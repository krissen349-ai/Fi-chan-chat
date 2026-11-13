Object.keys(process.env)
  .filter((name) => /^REACT_APP_CLOUDINARY_/.test(name))
  .forEach((name) => delete process.env[name]);

require('react-scripts/scripts/build');
