const admin = require('firebase-admin');

admin.initializeApp();

exports.incomingCall = require('./incomingCall');
exports.notifyAvailabilityChanged = require('./notifyAvailabilityChanged');