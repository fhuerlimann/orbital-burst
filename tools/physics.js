// Loads the physics core (between //PHYS-START and //PHYS-END in index.html) into Node.
// Usage: const P_ = require('./physics')({doseFac: optionalOverrideSource});
const fs = require('fs'), path = require('path');
module.exports = function load(opts = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  let code = html.split('//PHYS-START')[1].split('//PHYS-END')[0];
  if (opts.fluxMode) // count electrons >0.5 MeV instead of dose (for the Telstar flux check)
    code = code.replace(/const doseFac=E=>[^;]+;/, 'const doseFac=E=>E>0.5?1:0;');
  return new Function(code + '\nreturn PHYS;')();
};
