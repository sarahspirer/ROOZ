const { withEntitlementsPlist, withXcodeProject } = require('@expo/config-plugins');

// Adds FamilyControls entitlement + App Group to the main app target.
// The App Group lets ScreenTimeModule share lock state with the
// ROOZMonitor DeviceActivity extension (separate Xcode target).
module.exports = function withFamilyControls(config) {
  // Step 1: add entitlements to the main app
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.family-controls'] = true;
    mod.modResults['com.apple.security.application-groups'] = ['group.com.rooz.app'];
    return mod;
  });

  return config;
};
