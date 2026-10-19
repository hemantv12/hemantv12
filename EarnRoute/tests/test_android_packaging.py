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
    assert "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" in nearby_js
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
    assert "renderSavedShifts = async function()" in nearby_js
    assert "data-er-save-shift" in nearby_js
    assert "Highest estimated take-home" in nearby_js
    assert "Most open spots" in nearby_js
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
    assert "api('/api/support/tickets'" in nearby_js
    assert "reportConcern: 'Report a concern'" in app_js
    assert "reportConcern: 'शिकायत दर्ज करें'" in app_js
    assert ".er-save-shift" in nearby_css
    assert ".er-safety-panel" in nearby_css
