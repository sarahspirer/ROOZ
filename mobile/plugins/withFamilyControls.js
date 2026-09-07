const { withEntitlementsPlist } = require('@expo/config-plugins');

// Adds com.apple.developer.family-controls entitlement
// Required for FamilyControls / ManagedSettings (Screen Time API)
// Apple approval needed: https://developer.apple.com/contact/request/family-controls-distribution/
module.exports = function withFamilyControls(config) {
  return withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.family-controls'] = true;
    return mod;
  });
};
