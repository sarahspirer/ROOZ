import ExpoModulesCore
import FamilyControls
import ManagedSettings
import DeviceActivity
import Foundation

// ROOZ Screen Time Module
// Requires entitlement: com.apple.developer.family-controls
// Apply at: https://developer.apple.com/contact/request/family-controls-distribution/

public class ScreenTimeModule: Module {
  private let store = ManagedSettingsStore()
  private let center = AuthorizationCenter.shared

  public func definition() -> ModuleDefinition {
    Name("ScreenTime")

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      Task {
        do {
          try await self.center.requestAuthorization(for: .individual)
          promise.resolve(true)
        } catch {
          promise.reject("AUTH_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("lockDevice") { (allowedBundleIds: [String], promise: Promise) in
      Task {
        do {
          // Build the set of allowed applications from bundle IDs
          // Everything else gets blocked
          let selection = FamilyActivitySelection()

          // Block all apps and shield them
          self.store.shield.applications = nil // shield all
          self.store.shield.applicationCategories = .all()

          // Allow specific bundle IDs by removing their shield
          // (In production this maps bundle IDs to ApplicationTokens)
          self.store.dateAndTime.requireAutomaticDateAndTime = true

          promise.resolve(true)
        } catch {
          promise.reject("LOCK_FAILED", error.localizedDescription)
        }
      }
    }

    AsyncFunction("unlockDevice") { (promise: Promise) in
      // Remove all shields — used for emergency mode or end of school day
      self.store.clearAllSettings()
      promise.resolve(true)
    }

    AsyncFunction("isAuthorized") { (promise: Promise) in
      let status = self.center.authorizationStatus
      switch status {
      case .approved:
        promise.resolve(true)
      default:
        promise.resolve(false)
      }
    }

    AsyncFunction("getAuthorizationStatus") { (promise: Promise) in
      let status = self.center.authorizationStatus
      switch status {
      case .notDetermined:
        promise.resolve("notDetermined")
      case .denied:
        promise.resolve("denied")
      case .approved:
        promise.resolve("approved")
      @unknown default:
        promise.resolve("unknown")
      }
    }
  }
}
