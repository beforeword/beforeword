'use strict';
// Passenger's documented explicit binding must be configured before loading HTTP code.
if (global.PhusionPassenger) global.PhusionPassenger.configure({ autoInstall: false });
require('./index.cjs').startServer();
