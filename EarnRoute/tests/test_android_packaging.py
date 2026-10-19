from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"


def test_android_launcher_activity_exists_and_uses_asset_loader():
    activity = ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java"
    assert activity.is_file()
    source = activity.read_text()
    assert "extends Activity" in source
    assert "WebViewAssetLoader" in source
    assert '"appassets.androidplatform.net"' in source
    assert "setAllowFileAccess(false)" in source
    assert "setAllowContentAccess(false)" in source
    assert "handler.cancel()" in source  # TLS failures are not bypassed.


def test_android_api_settings_require_https_and_health_check():
    source = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    assert '"https".equalsIgnoreCase(uri.getScheme())' in source
    assert 'base + "/api/health"' in source
    assert '"EarnRoute API"' in source
    assert "CORS_ORIGINS" in source


def test_android_build_targets_current_play_api_and_has_launcher_icon():
    gradle = (ANDROID / "app/build.gradle").read_text()
    manifest = (ANDROID / "app/src/main/AndroidManifest.xml").read_text()
    assert re.search(r"compileSdk\s+36", gradle)
    assert re.search(r"targetSdk\s+36", gradle)
    assert "android:name=\".MainActivity\"" in manifest
    assert "@drawable/ic_earnroute" in manifest
    assert (ANDROID / "app/src/main/res/drawable/ic_earnroute.xml").is_file()


def test_android_assets_match_latest_web_frontend():
    source_dir = ROOT / "app/static"
    android_assets = ANDROID / "app/src/main/assets/static"
    assert (ANDROID / "app/src/main/assets/index.html").read_bytes() == (source_dir / "index.html").read_bytes()
    for source in source_dir.rglob("*"):
        if source.is_file():
            relative = source.relative_to(source_dir)
            bundled = android_assets / relative
            assert bundled.is_file(), f"Missing Android asset: {relative}"
            assert bundled.read_bytes() == source.read_bytes(), f"Stale Android asset: {relative}"


def test_frontend_connect_server_button_and_base_url_routing_exist():
    html = (ROOT / "app/static/index.html").read_text()
    js = (ROOT / "app/static/app.js").read_text()
    assert "data-connect-server" in html
    assert "getApiBaseUrl()" in html
    assert "earnroute_api_base" in js
    assert "const requestUrl = apiBase" in js


def test_native_app_header_and_system_navigation_inset_fixes_are_present():
    nearby_css = (ROOT / "app/static/nearby.css").read_text()
    html = (ROOT / "app/static/index.html").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    assert "Android polish: keep the native shell clear" in nearby_css
    assert "bottom: var(--er-system-bottom-inset, 0px) !important" in nearby_css
    assert "font-size: 0 !important" in nearby_css
    assert 'aria-label="Connect server"' in html
    assert 'id="notifications-btn" class="icon-btn notification-btn" aria-label="Notifications" title="Notifications"><svg' in html
    assert "getSystemBottomInsetDp()" in activity
    assert "applyCssSystemBottomInset" in activity
    assert "setVerticalScrollBarEnabled(false)" in activity


def test_nearby_live_map_and_workplace_pin_picker_are_present():
    main = (ROOT / "app/main.py").read_text()
    html = (ROOT / "app/static/index.html").read_text()
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    nearby_css = (ROOT / "app/static/nearby.css").read_text()
    assert "https://tile.openstreetmap.org/{z}/{x}/{y}.png" in nearby_js
    assert '@app.post("/api/jobs/nearby")' in main
    assert "class NearbyJobsSearchBody(BaseModel)" in main
    assert "api('/api/jobs/nearby'" in nearby_js
    assert "api('/api/jobs?' + params.toString())" not in nearby_js
    assert "Choose 1, 3, 5, 8, 10 or 15 km" not in nearby_js
    assert "function erMapTileUrl()" in nearby_js
    assert "L.tileLayer(erMapTileUrl()" in nearby_js
    assert "https://www.openstreetmap.org/fixthemap" in nearby_js
    assert 'name="earnroute-map-tile-url"' in html
    android = (ROOT / "android/app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    assert 'EarnRouteAndroid/" + BuildConfig.VERSION_NAME' in android
    assert "OpenStreetMap contributors" in nearby_js
    assert "function erLiveMapSectionMarkup(options)" in nearby_js
    assert "erLiveMapSectionMarkup({id:'er-nearby-map'" in nearby_js
    assert "erLiveMapSectionMarkup({id:'er-workplace-map'" in nearby_js
    assert "data-er-map-focus-job" in nearby_js
    assert "data-er-map-geolocate" in nearby_js
    assert "function erDisposeLiveMaps(root)" in nearby_js
    assert "erDisposeLiveMaps($('#view-root'))" in nearby_js
    assert ".er-live-map-card" in nearby_css
    assert '"latitude": job.latitude, "longitude": job.longitude' in main
    assert "Interactive nearby shift map" in nearby_js


def test_saved_shifts_discovery_sorting_and_india_safety_are_wired():
    main = (ROOT / "app/main.py").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    nearby_css = (ROOT / "app/static/nearby.css").read_text()
    migration = (ROOT / "migrations/versions/71dca93e5a21_add_saved_shifts.py").read_text()
    assert "class SavedShift(Base)" in main
    assert '@app.get("/api/worker/saved-shifts")' in main
    assert '@app.post("/api/jobs/{job_id}/save")' in main
    assert '@app.delete("/api/jobs/{job_id}/save")' in main
    assert "uq_saved_shift_worker_job" in main
    assert "case 'saved-shifts': html = await renderSavedShifts()" in app_js
    assert "async function renderSavedShifts()" in nearby_js
    assert "renderSavedShifts = async function()" not in nearby_js
    assert "data-er-save-shift" in nearby_js
    assert "t('sortTakeHome')" in nearby_js
    assert "t('sortHourlyRate')" in nearby_js
    assert "mode === 'hourly-rate'" in nearby_js
    assert "er-hourly-estimate" in nearby_js
    assert "t('sortOpenSpots')" in nearby_js
    assert "href=\"tel:112\"" in nearby_js
    assert "href=\"tel:1930\"" in nearby_js
    assert "https://www.ncs.gov.in/" in nearby_js
    assert "prefers-reduced-motion:reduce" in nearby_css
    assert 'down_revision = "e3b90a71c6d2"' in migration
    assert "saved_shifts" in migration


def test_saved_shift_and_safety_report_frontend_are_wired():
    app_js = (ROOT / "app/static/app.js").read_text()
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    nearby_css = (ROOT / "app/static/nearby.css").read_text()
    assert "async function renderSavedShifts()" in nearby_js
    assert "renderSavedShifts = async function()" not in nearby_js
    assert "function erTakeHomePerHour(job)" in nearby_js
    assert "mode === 'hourly-rate'" in nearby_js
    assert "er-hourly-estimate" in nearby_js
    assert "data-er-report-job" in nearby_js
    assert "category:'safety'" in nearby_js
    assert "message:'Published shift ID: ' + jobId + '\\nShift title: '" in nearby_js
    assert "earnroute-shell-v15" in (ROOT / "app/static/sw.js").read_text()
    assert "t('sortHourlyRate')" in nearby_js
    assert "api('/api/support/tickets'" in nearby_js
    assert "reportConcern: 'Report a concern'" in app_js
    assert "reportConcern: 'शिकायत दर्ज करें'" in app_js
    assert ".er-save-shift" in nearby_css
    assert ".er-safety-panel" in nearby_css


def test_safety_report_uses_existing_private_ticket_workflow_and_cache_bust():
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    sw_js = (ROOT / "app/static/sw.js").read_text()
    assert "data-er-report-job" in nearby_js
    assert "category:'safety'" in nearby_js
    assert "api('/api/support/tickets'" in nearby_js
    assert "reportConcern: 'Report a concern'" in app_js
    assert "safetyReportSent: 'आपकी सुरक्षा संबंधी शिकायत" in app_js
    assert "earnroute-shell-v15" in sw_js
    assert "function erMobileNavLabel(screen, fallback)" in nearby_js
    assert "'saved-shifts':'सेव्ड'" in nearby_js
    assert "escapeHtml(erMobileNavLabel(item[0], item[2]))" in nearby_js


def test_native_header_controls_fit_and_hidden_server_button_stays_hidden():
    css = (ROOT / "app/static/nearby.css").read_text()
    html = (ROOT / "app/static/index.html").read_text()
    assert "FINAL ANDROID HEADER FIT" in css
    assert '.connect-server-btn[hidden] { display:none !important; }' in css
    assert "text-overflow:ellipsis" in css
    assert "flex-wrap:nowrap" in css
    assert 'data-connect-server aria-label="Connect server"' in html
    assert "html.er-native-app .topbar-actions > #profile-btn > span:nth-child(2)" in css
    assert "html.er-native-app .view-root {\n  min-width:0;" in css


def test_commute_aware_estimate_is_explicit_and_optional():
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    nearby_css = (ROOT / "app/static/nearby.css").read_text()
    assert "function erGetCommuteCostPerKm(value)" in nearby_js
    assert "function erEstimatedCommuteCost(job, rate)" in nearby_js
    assert "return Math.round(distance * 2 * perKm)" in nearby_js
    assert "mode === 'after-commute'" in nearby_js
    assert "erSortSelectMarkup(sortBy, commuteRate)" in nearby_js
    assert 'name="commute_cost_per_km"' in nearby_js
    assert "road route and actual transport fare may differ" in nearby_js
    assert "sortAfterCommute: 'Best after commute estimate'" in app_js
    assert "sortAfterCommute: 'यात्रा खर्च के बाद सबसे ज़्यादा'" in app_js
    assert ".er-commute-estimate" in nearby_css
    assert ".connect-server-btn[hidden] { display:none !important; }" in nearby_css


def test_manual_area_selection_and_map_provider_compliance_are_wired():
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    assert "const ER_MANUAL_AREAS = [" in nearby_js
    assert "function erSetManualAreaCandidate(latitude, longitude)" in nearby_js
    assert "function erCenterManualArea()" in nearby_js
    assert "function erCommitManualCityCentre()" in nearby_js
    assert "function erCommitManualAreaCandidate()" in nearby_js
    assert "kind === 'origin'" in nearby_js
    assert "data-er-manual-center" in nearby_js
    assert "data-er-use-manual-location" in nearby_js
    assert "data-er-use-city-center" in nearby_js
    assert "!el.closest('details:not([open])')" in nearby_js
    assert "manualAreaHeading: 'Can’t use GPS? Choose your area manually'" in app_js
    assert "manualAreaHeading: 'GPS नहीं चल रहा? अपना क्षेत्र खुद चुनें'" in app_js
    assert "manualAreaApproximateNotice:" in app_js
    assert "locationIntro: 'Choose 1, 3, 5, 8, 10 or 15 km" in app_js
    assert "locationIntro: 'वास्तविक प्रकाशित शिफ्ट" in app_js
    assert "selected coordinates are sent to EarnRoute" in app_js
    assert ".er-manual-area-picker" in css
    assert ".er-manual-location-confirm" in css
    assert "expiresAt:Date.now() + 30 * 60 * 1000" in nearby_js



def test_nearby_search_filters_persist_across_radius_and_category_changes():
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    assert "function erGetNearbyFilterState()" in nearby_js
    assert "function erSaveNearbyFilterState(value)" in nearby_js
    assert "Object.assign({}, erGetNearbyFilterState(), filters || {})" in nearby_js
    assert "erSaveNearbyFilterState(data)" in nearby_js
    assert "sessionStorage.removeItem('earnroute_nearby_filters')" in nearby_js
    assert 'name="search" maxlength="120"' in nearby_js
    assert 'name="min_pay" type="number" min="0" max="1000000"' in nearby_js


def test_android_generates_versioned_buildconfig_for_map_user_agent():
    gradle = (ANDROID / "app/build.gradle").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    assert "buildFeatures {\n        buildConfig true\n    }" in gradle
    assert "versionName '1.6.4'" in gradle
    assert 'EarnRouteAndroid/" + BuildConfig.VERSION_NAME' in activity


def test_account_export_and_privacy_controls_are_wired():
    main = (ROOT / "app/main.py").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    sw = (ROOT / "app/static/sw.js").read_text()
    assert '@app.get("/api/account/data-export")' in main
    assert '@app.post("/api/account/privacy-requests", status_code=201)' in main
    assert 'category: Literal["account", "privacy"' in main
    assert '"legal_policies_accepted"' in main
    assert 'TERMS_POLICY_VERSION = "1.1-draft-2026-10-19"' in main
    assert "function renderAccountPrivacyTools()" in app_js
    assert "data-export-my-data" in app_js
    assert 'data-privacy-request="deletion"' in app_js
    assert "Privacy request sent to support." in app_js
    assert "er-account-privacy" in css
    assert "saveTextFile(String fileName, String mimeType, String content)" in activity
    assert "Intent.ACTION_CREATE_DOCUMENT" in activity
    assert "SAVE_TEXT_FILE_REQUEST" in activity
    assert "earnroute-shell-v15" in sw


def test_android_keyboard_resize_and_auth_sheet_visibility_are_wired():
    manifest = (ANDROID / "app/src/main/AndroidManifest.xml").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    nearby_css = (ROOT / "app/static/nearby.css").read_text()

    assert 'android:windowSoftInputMode="adjustResize"' in manifest
    assert "WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE" in activity
    assert "function erCurrentVisibleViewportHeight()" in app_js
    assert "window.visualViewport.addEventListener('resize', erSyncKeyboardViewport" in app_js
    assert "window.visualViewport.addEventListener('scroll', erSyncKeyboardViewport" in app_js
    assert "function erKeepFocusedControlVisible(target)" in app_js
    assert "if (!document.documentElement.classList.contains('er-native-app') &&" in app_js
    assert "ANDROID KEYBOARD-SAFE AUTH SHEET" in nearby_css
    assert "max-height:var(--er-visual-viewport-height, 100dvh) !important" in nearby_css
    assert "html.er-native-app.er-keyboard-open .er-mobile-nav" in nearby_css
    assert "active.blur()" in app_js


def test_auth_sheet_does_not_automatically_open_mobile_keyboard():
    app_js = (ROOT / "app/static/app.js").read_text()
    open_auth = app_js[app_js.index("function openAuth(mode = 'login'"):app_js.index("function closeAuth()")]
    assert "Do not auto-open the Android keyboard over the sign-up form." in open_auth
    assert "window.setTimeout(() => $('#auth-email').focus(), 50);" in open_auth
    assert "window.matchMedia('(pointer: fine)').matches" in open_auth


def test_admin_user_management_and_system_health_are_server_protected():
    app_js = (ROOT / "app/static/app.js").read_text()
    css = (ROOT / "app/static/styles.css").read_text()
    main = (ROOT / "app/main.py").read_text()
    assert '@app.get("/api/admin/users")' in main
    assert '@app.patch("/api/admin/users/{target_user_id}/status")' in main
    assert '@app.get("/api/admin/system")' in main
    assert "async function renderAdminUsers()" in app_js
    assert "async function renderAdminSystem()" in app_js
    assert "data-admin-user-status" in app_js
    assert "Final admin console usability and Android keyboard-resize safeguards" in css
    assert "er-visual-viewport-height" in css
    assert "er-keyboard-open #auth-modal" in css



def test_native_keyboard_insets_resize_forms_without_double_system_bar_padding():
    manifest = (ANDROID / "app/src/main/AndroidManifest.xml").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    assert 'android:windowSoftInputMode="adjustResize"' in manifest
    assert "WindowInsetsCompat.Type.ime()" in activity
    assert "getSystemImeInsetDp()" in activity
    assert "systemImeInsetDp = imeVisible" in activity
    assert "setInsets(systemBarsAndCutout, Insets.NONE)" in activity
    assert "windowInsets.isVisible(WindowInsetsCompat.Type.ime())" in activity
    assert "function erNativeImeInsetCssPx()" in app_js
    assert "Math.min(observedHeight, nativeVisibleHeight)" in app_js
    assert "nativeImeInset > 110" in app_js
    assert "[40, 100, 180, 300, 480, 720, 1000].forEach(delay =>" in app_js
    assert "MOBILE OVERLAP + KEYBOARD HOTFIX" in css
    assert "html.er-native-app.er-keyboard-open .view-root" in css
    assert "html.er-native-app.er-keyboard-open .er-mobile-nav" in css
    assert "max-height:calc(var(--er-visual-viewport-height, 100dvh) - 6px)" in css
    assert "FINAL MOBILE FORM + KEYBOARD LAYER (v3)" in css
    assert "overflow:hidden !important;\n  overscroll-behavior:none !important;" in css
    assert "html.er-native-app.er-keyboard-open #auth-modal .auth-safe" in css
    assert "html.er-native-app.er-keyboard-open #auth-modal .auth-subheading" in css
    assert "grid-template-columns:minmax(0,1fr) !important" in css
    assert "720, 1000].forEach(delay =>" in app_js



def test_keyboard_layout_has_single_scroll_owner_and_keyboard_resizes_content():
    html = (ROOT / "app/static/index.html").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    assert 'interactive-widget=resizes-content' in html
    assert "const remainingLayoutHeight = Math.max(1, layoutHeight - viewportTop)" in app_js
    assert "function erKeepFocusedControlVisible(target)" in app_js
    assert "const sheetRect = sheet.getBoundingClientRect()" in app_js
    assert "const maxScroll = Math.max(0, sheet.scrollHeight - sheet.clientHeight)" in app_js
    assert "target.scrollIntoView({block:'nearest', inline:'nearest', behavior:'auto'})" in app_js
    assert "FINAL MOBILE FORM + KEYBOARD LAYER (v3)" in css
    assert "overflow:hidden !important;\n  overscroll-behavior:none !important;" in css
    assert "max-height:calc(var(--er-visual-viewport-height, 100dvh) - 6px) !important" in css
    assert "html.er-native-app.er-keyboard-open #auth-modal .auth-modal" in css
    assert css.count("html.er-native-app #auth-modal.modal-backdrop:not([hidden])") == 1
    assert css.count("html.er-native-app.er-keyboard-open #auth-modal .auth-modal {") == 1
    assert 'android:windowSoftInputMode="adjustResize"' in (ANDROID / "app/src/main/AndroidManifest.xml").read_text()
    assert "WindowInsetsCompat.Type.ime()" in activity


def test_mobile_header_drawer_and_bottom_navigation_respect_android_system_bars():
    css = (ROOT / "app/static/nearby.css").read_text()
    js = (ROOT / "app/static/app.js").read_text()
    html = (ROOT / "app/static/index.html").read_text()
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    assert "top:var(--er-mobile-header-height,62px);" in css
    assert "bottom:var(--er-system-bottom-inset,0px) !important;" in css
    assert "padding:7px 7px 7px !important;" in css
    assert "html.er-native-app.er-drawer-open .er-mobile-nav" in css
    assert "html.er-native-app .sidebar > .workspace-label { display:none !important; }" in css
    assert "function erSetMobileDrawerOpen(open)" in js
    assert 'id="er-sidebar-scrim"' in js
    assert "event.key === 'Escape' && document.documentElement.classList.contains('er-drawer-open')" in js
    assert "if(document.documentElement.classList.contains('er-drawer-open')) erSetMobileDrawerOpen(false);" in js
    assert 'aria-controls="sidebar" aria-expanded="false"' in html
    assert "getSystemBottomInsetDp()" in activity


def test_auth_keyboard_layout_keeps_password_and_submit_in_scrollable_sheet():
    css = (ROOT / "app/static/nearby.css").read_text()
    js = (ROOT / "app/static/app.js").read_text()
    assert "html.er-native-app.er-keyboard-open #auth-modal .auth-modal" in css
    assert "overflow-y:auto !important;" in css
    assert "max-height:calc(var(--er-visual-viewport-height, 100dvh) - 6px) !important;" in css
    assert "function erSyncKeyboardViewport()" in js
    assert "window.visualViewport.addEventListener('resize', erSyncKeyboardViewport" in js
    assert "window.requestAnimationFrame(() => erKeepFocusedControlVisible(document.activeElement));" in js
    assert "getSystemImeInsetDp()" in js



def test_android_system_insets_are_applied_once_and_mobile_footer_clears_system_nav():
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    assert "WindowCompat.setDecorFitsSystemWindows(window, false)" in activity
    assert "getInsetsIgnoringVisibility(navigationBarType)" in activity
    assert "WindowInsetsCompat.Type.tappableElement()" in activity
    assert "target.setPadding(bars.left, bars.top, bars.right, 0)" in activity
    assert "window.setNavigationBarContrastEnforced(true)" in activity
    assert "bottom:var(--er-system-bottom-inset,0px) !important" in css
    assert "padding-bottom:calc(var(--er-mobile-nav-height,68px) + 18px + var(--er-system-bottom-inset,0px))" in css
    assert "z-index:530 !important" in css
    assert "z-index:540 !important" in css


def test_auth_password_can_be_revealed_and_strength_feedback_is_live():
    html = (ROOT / "app/static/index.html").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    assert 'data-password-toggle="auth-password"' in html
    assert 'aria-pressed="false">Show</button>' in html
    assert 'id="password-strength" class="password-strength"' in html
    assert "function erPasswordText(key)" in app_js
    assert "function erUpdatePasswordStrength()" in app_js
    assert "if (target.dataset.passwordToggle)" in app_js
    assert "event.target.id === 'auth-password'" in app_js
    assert ".password-input-wrap" in css
    assert ".password-strength[data-level=\"strong\"]" in css


def test_android_back_button_closes_auth_or_drawer_before_leaving():
    activity = (ANDROID / "app/src/main/java/in/earnroute/app/MainActivity.java").read_text()
    app_js = (ROOT / "app/static/app.js").read_text()
    assert "setBackHandlingEnabled(boolean enabled)" in activity
    assert "if (backHandlingEnabled && webView != null)" in activity
    assert "window.erHandleNativeBack = function()" in app_js
    assert "erSetMobileDrawerOpen(false)" in app_js
    assert "closeAuth();" in app_js
    assert "erSyncNativeBackHandling();" in app_js


def test_offline_banner_and_session_only_business_job_draft_recovery_are_wired():
    app_js = (ROOT / "app/static/app.js").read_text()
    nearby_js = (ROOT / "app/static/nearby.js").read_text()
    css = (ROOT / "app/static/nearby.css").read_text()
    assert "function erEnsureNetworkBanner()" in app_js
    assert "window.addEventListener('offline'" in app_js
    assert "window.addEventListener('online'" in app_js
    assert "await api('/api/health')" in app_js
    assert "function erInitializeBusinessJobDraft()" in app_js
    assert "sessionStorage.setItem(key, serialized)" in app_js
    assert "name === 'publish'" in app_js
    assert "erInitializeBusinessJobDraft === 'function'" in nearby_js
    assert ".er-network-banner" in css
    assert ".er-job-draft-notice" in css

