var PaulStretch = require('./lib/PaulStretch')

module.exports.PaulStretch = PaulStretch

if (typeof self !== 'undefined') self.PaulStretch = PaulStretch
if (typeof window !== 'undefined') window.PaulStretch = PaulStretch