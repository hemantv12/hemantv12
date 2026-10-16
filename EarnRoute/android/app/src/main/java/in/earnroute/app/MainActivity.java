package in.earnroute.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Secure Android container for the same-origin EarnRoute web client. */
public final class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + ASSET_HOST + "/index.html";
    private static final String PREFS = "earnroute_settings";
    private static final String API_BASE_KEY = "api_base_url";
    private static final int LOCATION_PERMISSION_REQUEST = 4821;
    private static final String DEFAULT_API_BASE_URL = "https://earnroute-nearby-api.onrender.com";

    private WebView webView;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private SharedPreferences preferences;
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        configureSystemBars();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(18, 45, 33));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setGeolocationEnabled(true);
        configureGeolocation(webView);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " EarnRouteAndroid/1.2.0");

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(ASSET_HOST)
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.addJavascriptInterface(new EarnRouteBridge(), "EarnRouteNative");
        applyInsets(webView);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && ASSET_HOST.equalsIgnoreCase(uri.getHost())) {
                    return assetLoader.shouldInterceptRequest(uri);
                }
                // API traffic is initiated by fetch() directly to the configured HTTPS server.
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && ASSET_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                // Do not navigate remote content inside the WebView where the native bridge exists.
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                } catch (ActivityNotFoundException | SecurityException ignored) {
                    Toast.makeText(MainActivity.this, "No app available to open this link.", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                if (view == webView) {
                    view.destroy();
                    webView = new WebView(MainActivity.this);
                    setContentView(webView);
                    Toast.makeText(MainActivity.this, "EarnRoute restarted after a display issue. Please reopen it if needed.", Toast.LENGTH_LONG).show();
                    configureWebView(webView);
                    ViewCompat.requestApplyInsets(webView);
                    webView.loadUrl(START_URL);
                }
                return true;
            }
        });
        setContentView(webView);
        ViewCompat.requestApplyInsets(webView);
        webView.loadUrl(START_URL);
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(18, 45, 33));
        window.setNavigationBarColor(Color.rgb(18, 45, 33));
        window.getDecorView().setSystemUiVisibility(0);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setGeolocationEnabled(true);
        configureGeolocation(view);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setDatabaseEnabled(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        view.setBackgroundColor(Color.rgb(18, 45, 33));
        applyInsets(view);
        view.addJavascriptInterface(new EarnRouteBridge(), "EarnRouteNative");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(ASSET_HOST)
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        view.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("https".equalsIgnoreCase(u.getScheme()) && ASSET_HOST.equalsIgnoreCase(u.getHost())) return loader.shouldInterceptRequest(u);
                return super.shouldInterceptRequest(v, r);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("https".equalsIgnoreCase(u.getScheme()) && ASSET_HOST.equalsIgnoreCase(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override public void onReceivedSslError(WebView v, SslErrorHandler h, android.net.http.SslError e) { h.cancel(); }
        });
    }

    /** Restrict native location prompts to this bundled first-party HTTPS origin. */
    private void configureGeolocation(WebView view) {
        view.getSettings().setGeolocationEnabled(true);
        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                Uri uri = Uri.parse(origin);
                boolean isAppOrigin = "https".equalsIgnoreCase(uri.getScheme())
                        && ASSET_HOST.equalsIgnoreCase(uri.getHost());
                if (!isAppOrigin) {
                    callback.invoke(origin, false, false);
                    return;
                }
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                        LOCATION_PERMISSION_REQUEST);
            }
        });
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST && pendingGeoCallback != null) {
            boolean granted = hasLocationPermission();
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
            if (!granted) {
                Toast.makeText(this, "Allow location to find real jobs near you.", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void applyInsets(WebView view) {
        ViewCompat.setOnApplyWindowInsetsListener(view, (target, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            target.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
    }

    private final class EarnRouteBridge {
        @JavascriptInterface public boolean isAndroidApp() { return true; }
        @JavascriptInterface public String getApiBaseUrl() { return preferences.getString(API_BASE_KEY, DEFAULT_API_BASE_URL); }
        @JavascriptInterface public void openServerSettings() { runOnUiThread(() -> showServerSettings()); }
    }

    private void showServerSettings() {
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("https://api.yourdomain.in");
        input.setText(preferences.getString(API_BASE_KEY, ""));
        input.setSelection(input.getText().length());

        TextView helper = new TextView(this);
        helper.setText("Enter your deployed EarnRoute API HTTPS URL. We will test /api/health before saving. A local preview without a server can show the landing page but cannot create real accounts or jobs.");
        helper.setTextSize(13);
        helper.setTextColor(Color.rgb(83, 101, 89));
        helper.setPadding(0, 0, 0, 12);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(22);
        content.setPadding(pad, dp(8), pad, 0);
        content.addView(helper);
        content.addView(input, new LinearLayout.LayoutParams(-1, dp(52)));

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Connect EarnRoute server")
                .setView(content)
                .setPositiveButton("Test & connect", null)
                .setNegativeButton("Cancel", null)
                .setNeutralButton("Clear", null)
                .create();
        dialog.setOnShowListener(unused -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                final String base;
                try { base = validateBaseUrl(input.getText().toString()); }
                catch (IllegalArgumentException ex) { input.setError(ex.getMessage()); return; }
                setInputsEnabled(content, false);
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setText("Checking…");
                ioExecutor.execute(() -> {
                    String error = checkHealth(base);
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        setInputsEnabled(content, true);
                        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setText("Test & connect");
                        if (error != null) {
                            new AlertDialog.Builder(this).setTitle("Server not connected")
                                    .setMessage(error + "\n\nCheck that your HTTPS API is deployed and CORS_ORIGINS includes https://appassets.androidplatform.net.")
                                    .setPositiveButton("OK", null).show();
                            return;
                        }
                        preferences.edit().putString(API_BASE_KEY, base).apply();
                        dialog.dismiss();
                        reloadWithApiBase(base);
                        Toast.makeText(this, "EarnRoute server connected.", Toast.LENGTH_SHORT).show();
                    });
                });
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
                preferences.edit().putString(API_BASE_KEY, "").apply();
                dialog.dismiss();
                reloadWithApiBase("");
                Toast.makeText(this, "Server connection cleared.", Toast.LENGTH_SHORT).show();
            });
        });
        dialog.show();
    }

    private void reloadWithApiBase(String base) {
        if (webView == null) return;
        String encoded = JSONObject.quote(base == null ? "" : base);
        webView.evaluateJavascript("try { if (" + encoded + ") localStorage.setItem('earnroute_api_base', " + encoded + "); else localStorage.removeItem('earnroute_api_base'); location.reload(); } catch(e) { location.reload(); }", null);
    }

    private String validateBaseUrl(String raw) {
        String value = raw == null ? "" : raw.trim().replaceAll("/+$", "");
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("Enter a valid HTTPS URL.");
            }
            if (uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null || (uri.getRawPath() != null && !uri.getRawPath().isEmpty() && !"/".equals(uri.getRawPath()))) {
                throw new IllegalArgumentException("Enter only the API origin, without credentials, path, query, or fragment.");
            }
            if (value.length() > 250) throw new IllegalArgumentException("The URL is too long.");
            return "https://" + uri.getRawAuthority();
        } catch (IllegalArgumentException ex) {
            if (ex.getMessage() != null && (ex.getMessage().startsWith("Enter ") || ex.getMessage().startsWith("The URL"))) throw ex;
            throw new IllegalArgumentException("Enter a valid HTTPS URL, for example https://api.yourdomain.in.");
        }
    }

    private String checkHealth(String base) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(base + "/api/health");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(7000);
            connection.setReadTimeout(7000);
            connection.setInstanceFollowRedirects(false);
            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
            String body = readAll(stream);
            if (status != 200) return "The health endpoint returned HTTP " + status + ".";
            JSONObject json = new JSONObject(body);
            if (!"EarnRoute API".equals(json.optString("service"))) return "This URL responded, but it does not identify itself as EarnRoute API.";
            if (!"ok".equals(json.optString("status"))) return "The API is online but its database health check is not OK.";
            return null;
        } catch (Exception ex) {
            String message = ex.getMessage();
            return "Could not reach the API: " + (message == null || message.isBlank() ? ex.getClass().getSimpleName() : message);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder out = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) out.append(line);
            return out.toString();
        }
    }

    private void setInputsEnabled(View view, boolean enabled) {
        view.setEnabled(enabled);
        if (view instanceof LinearLayout) {
            LinearLayout layout = (LinearLayout) view;
            for (int i = 0; i < layout.getChildCount(); i++) setInputsEnabled(layout.getChildAt(i), enabled);
        }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        ioExecutor.shutdownNow();
        if (webView != null) { webView.stopLoading(); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
