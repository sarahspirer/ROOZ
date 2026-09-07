# Apple Family Controls Entitlement Request
## Submit at: https://developer.apple.com/contact/request/family-controls-distribution/

---

### App Name
ROOZ

### Bundle ID
com.rooz.app

### Apple Developer Account
(your Apple Developer account email)

### App Store Category
Education

---

## Description of Your App

ROOZ is a school phone management system that helps K-12 schools enforce phone-free campus policies during school hours. The app is installed on student devices and used exclusively in educational institutional settings — students cannot download it independently; it is distributed by their school.

During school hours, ROOZ monitors student device compliance and — with the Family Controls entitlement — will enforce focus by restricting access to distracting apps while allowing school-approved tools (Google Classroom, Schoology, Kahoot, etc.) to remain accessible.

---

## How You Use the Family Controls API

We use the following frameworks:
- **FamilyControls** — to request authorization from the student (individual mode, not parental)
- **ManagedSettings** — to shield/block non-approved apps during school hours
- **DeviceActivity** — to schedule lock/unlock windows aligned with the school bell schedule

### Specific usage:
1. When a student arrives on campus (detected via geofencing), ROOZ enters "Class Mode"
2. `ManagedSettingsStore` shields all apps except a school-configured allowlist (e.g. Gmail, Schoology)
3. When the school day ends or a teacher triggers Emergency Mode, `store.clearAllSettings()` removes all restrictions instantly
4. No parental relationship is required — students authorize the app themselves as individuals (`.individual` mode), consistent with school policy

---

## Why Individual Authorization (Not Parental)

High school students (14–18) manage their own devices. Requiring parental authorization for every device action creates an unworkable setup for schools. We use `.individual` authorization consistent with Apple's guidance for institutional/educational apps where the user is the student themselves.

---

## Institutional / Educational Context

- ROOZ is sold exclusively to K-12 schools as a SaaS subscription
- Schools distribute the app to student devices through Apple School Manager or direct install link
- The app is not available for individual consumer download
- All configuration (school hours, geofence, allowed apps) is controlled by school administrators, not students
- We are fully FERPA and COPPA compliant — we collect only device lock state and campus presence, never personal content

---

## Privacy

- No access to messages, photos, or browsing history
- No continuous GPS tracking or location history stored
- Geofence check only runs during configured school hours
- All data stays within the school's account — never shared with third parties

---

## Contact

Company: ROOZ  
Website: myrooz.com  
Email: admin@rooz.school  
Developer: Sarah Spirer

---

## Supporting Materials to Attach
- [ ] Screenshot of admin dashboard showing school configuration
- [ ] Screenshot of student app showing lock state UI
- [ ] Link to privacy policy
- [ ] School pilot agreement (if available)
