package com.collabzy.creator;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Fresh, native Collabzy Android client. The screens are rendered directly with Android
 * Views; no WebView or remote HTML is needed to display the first screen.
 */
public final class MainActivity extends Activity {
    private static final String API = "https://collabzy-api.onrender.com";
    private static final int BG = Color.rgb(247, 248, 252);
    private static final int WHITE = Color.WHITE;
    private static final int INK = Color.rgb(39, 34, 61);
    private static final int MUTED = Color.rgb(111, 106, 133);
    private static final int PURPLE = Color.rgb(112, 82, 202);
    private static final int TEAL = Color.rgb(16, 149, 126);
    private static final int LIGHT_PURPLE = Color.rgb(242, 239, 252);
    private static final int LIGHT_TEAL = Color.rgb(227, 247, 242);
    private static final int BORDER = Color.rgb(226, 222, 239);
    private static final int RED = Color.rgb(184, 49, 72);
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final ExecutorService network = Executors.newFixedThreadPool(2);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .build();

    private SharedPreferences prefs;
    private String token = "";
    private String screen = "welcome";
    private String tab = "discover";
    private String signupRole = "creator";
    private String selectedTool = "reel_hooks";
    private String notice = "";
    private boolean noticeIsError = false;

    private JSONObject me = new JSONObject();
    private JSONObject stats = new JSONObject();
    private JSONObject billing = new JSONObject();
    private JSONObject instagram = new JSONObject();
    private JSONArray campaigns = new JSONArray();
    private JSONArray applications = new JSONArray();
    private JSONArray brandCampaigns = new JSONArray();
    private boolean statsLoaded, campaignsLoaded, applicationsLoaded, brandCampaignsLoaded;
    private boolean billingLoaded, instagramLoaded;

    private LinearLayout body;
    private TextView authMessage, composerMessage, applyMessage, studioOutput;
    private TextView instagramStatus, billingStatus;
    private EditText authName, authEmail, authPassword, authBetaCode;
    private CheckBox authTerms, studioDisclosure;
    private EditText studioBrief, studioAudience;
    private String selectedCampaignId = "";
    private String selectedCampaignTitle = "";

    private interface Callback { void done(JSONObject data, String error); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(WHITE);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        prefs = getSharedPreferences("collabzy_native_v2", MODE_PRIVATE);
        token = prefs.getString("token", "");
        try {
            if (token.isEmpty()) {
                showWelcome();
            } else {
                showLoading("Opening your Collabzy workspace…");
                request("GET", "/api/me", null, (data, error) -> {
                    if (error == null && data != null) {
                        me = data.optJSONObject("user") == null ? data : data.optJSONObject("user");
                        clearCaches();
                        tab = isInstagramCallback(getIntent()) ? "profile" : "discover";
                        showApp(tab);
                        if (isInstagramCallback(getIntent())) handleInstagramCallback(getIntent());
                    } else {
                        signOutLocal();
                        notice = error == null ? "Please sign in again to continue." : error;
                        noticeIsError = true;
                        showWelcome();
                    }
                });
            }
        } catch (Throwable error) {
            android.util.Log.e("CollabzyStartup", "Initial startup failed.", error);
            showStartupFailure();
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isInstagramCallback(intent) && !token.isEmpty()) handleInstagramCallback(intent);
    }

    @Override public void onBackPressed() {
        if ("app".equals(screen)) {
            if (!"discover".equals(tab)) showApp("discover"); else super.onBackPressed();
        } else if ("auth".equals(screen) || "forgot".equals(screen)) {
            showWelcome();
        } else if ("composer".equals(screen)) {
            showApp("work");
        } else if ("apply".equals(screen)) {
            showApp("discover");
        } else {
            super.onBackPressed();
        }
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        network.shutdownNow();
        main.removeCallbacksAndMessages(null);
    }

    private int dp(float n) { return (int)(n * getResources().getDisplayMetrics().density + 0.5f); }
    private LinearLayout col() { LinearLayout v = new LinearLayout(this); v.setOrientation(LinearLayout.VERTICAL); return v; }
    private LinearLayout row() { LinearLayout v = new LinearLayout(this); v.setOrientation(LinearLayout.HORIZONTAL); v.setGravity(Gravity.CENTER_VERTICAL); return v; }

    private void gap(LinearLayout parent, int height) {
        parent.addView(new View(this), new LinearLayout.LayoutParams(1, dp(height)));
    }

    private GradientDrawable shape(int color, int radius, int border) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        if (border != 0) d.setStroke(dp(1), border);
        return d;
    }

    private GradientDrawable gradient(int top, int bottom, int radius) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{top, bottom});
        d.setCornerRadius(dp(radius));
        return d;
    }

    private TextView txt(String value, int size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(size);
        v.setTextColor(color);
        v.setIncludeFontPadding(true);
        v.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        return v;
    }

    private TextView button(String title, boolean primary, Runnable click) {
        TextView v = txt(title, 15, primary ? WHITE : INK, true);
        v.setGravity(Gravity.CENTER);
        v.setPadding(dp(16), dp(14), dp(16), dp(14));
        v.setMinHeight(dp(50));
        v.setBackground(shape(primary ? TEAL : LIGHT_PURPLE, 16, primary ? 0 : BORDER));
        v.setClickable(true);
        v.setFocusable(true);
        v.setOnClickListener(view -> { if (click != null) click.run(); });
        return v;
    }

    private TextView smallButton(String title, Runnable click) {
        TextView v = txt(title, 12, PURPLE, true);
        v.setGravity(Gravity.CENTER);
        v.setPadding(dp(12), dp(10), dp(12), dp(10));
        v.setBackground(shape(LIGHT_PURPLE, 12, BORDER));
        v.setClickable(true);
        v.setFocusable(true);
        v.setOnClickListener(view -> { if (click != null) click.run(); });
        return v;
    }

    private LinearLayout card() {
        LinearLayout v = col();
        v.setPadding(dp(17), dp(17), dp(17), dp(17));
        v.setBackground(shape(WHITE, 20, BORDER));
        return v;
    }

    private EditText input(String hint, int type, boolean multiline) {
        EditText v = new EditText(this);
        v.setTextColor(INK);
        v.setHintTextColor(Color.rgb(145, 140, 161));
        v.setHint(hint);
        v.setTextSize(15);
        v.setSingleLine(!multiline);
        v.setInputType(type | (multiline ? InputType.TYPE_TEXT_FLAG_MULTI_LINE : 0));
        v.setPadding(dp(14), dp(12), dp(14), dp(12));
        v.setMinHeight(dp(multiline ? 96 : 52));
        v.setBackground(shape(LIGHT_PURPLE, 14, BORDER));
        v.setImeOptions(multiline ? EditorInfo.IME_ACTION_NONE : EditorInfo.IME_ACTION_NEXT);
        if (multiline) v.setGravity(Gravity.TOP | Gravity.START);
        return v;
    }

    private void field(LinearLayout parent, String label, EditText input) {
        parent.addView(txt(label, 12, MUTED, true));
        gap(parent, 6);
        parent.addView(input, new LinearLayout.LayoutParams(-1, -2));
        gap(parent, 13);
    }

    private void section(LinearLayout parent, String title, String subtitle) {
        parent.addView(txt(title, 21, INK, true));
        if (subtitle != null && !subtitle.isEmpty()) {
            gap(parent, 4);
            TextView copy = txt(subtitle, 13, MUTED, false);
            copy.setLineSpacing(dp(3), 1f);
            parent.addView(copy);
        }
        gap(parent, 15);
    }

    private void feature(LinearLayout parent, String icon, String title, String description) {
        LinearLayout line = row();
        TextView mark = txt(icon, 20, TEAL, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(shape(LIGHT_TEAL, 13, 0));
        line.addView(mark, new LinearLayout.LayoutParams(dp(42), dp(42)));
        LinearLayout copy = col();
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
        p.leftMargin = dp(12);
        copy.setLayoutParams(p);
        copy.addView(txt(title, 14, INK, true));
        gap(copy, 3);
        copy.addView(txt(description, 12, MUTED, false));
        line.addView(copy);
        parent.addView(line);
    }

    private void beginPage(String title, boolean nav, boolean back) {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        LinearLayout shell = col();
        root.addView(shell, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout header = row();
        header.setPadding(dp(19), dp(13), dp(16), dp(12));
        header.setBackgroundColor(WHITE);
        TextView mark = txt("C", 23, WHITE, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(gradient(PURPLE, TEAL, 14));
        header.addView(mark, new LinearLayout.LayoutParams(dp(43), dp(43)));

        LinearLayout brand = col();
        LinearLayout.LayoutParams brandParams = new LinearLayout.LayoutParams(0, -2, 1);
        brandParams.leftMargin = dp(11);
        brand.setLayoutParams(brandParams);
        brand.addView(txt("collabzy", 19, INK, true));
        brand.addView(txt(title, 11, MUTED, false));
        header.addView(brand);

        if (nav) {
            TextView avatar = txt(initial(me.optString("name", "C")), 15, PURPLE, true);
            avatar.setGravity(Gravity.CENTER);
            avatar.setBackground(shape(LIGHT_PURPLE, 22, BORDER));
            header.addView(avatar, new LinearLayout.LayoutParams(dp(40), dp(40)));
            avatar.setOnClickListener(v -> showApp("profile"));
        } else if (back) {
            TextView close = txt("‹", 30, INK, false);
            close.setGravity(Gravity.CENTER);
            header.addView(close, new LinearLayout.LayoutParams(dp(40), dp(42)));
            close.setOnClickListener(v -> onBackPressed());
        }
        shell.addView(header, new LinearLayout.LayoutParams(-1, -2));

        ScrollView scroller = new ScrollView(this);
        scroller.setFillViewport(false);
        scroller.setClipToPadding(false);
        body = col();
        body.setPadding(dp(19), dp(18), dp(19), dp(25));
        scroller.addView(body, new ScrollView.LayoutParams(-1, -2));
        shell.addView(scroller, new LinearLayout.LayoutParams(-1, 0, 1));
        if (nav) shell.addView(bottomNav(), new LinearLayout.LayoutParams(-1, -2));
        setContentView(root);
    }

    private LinearLayout bottomNav() {
        LinearLayout nav = row();
        nav.setPadding(dp(6), dp(8), dp(6), dp(8));
        nav.setBackgroundColor(WHITE);
        navItem(nav, "discover", "⌕", "Discover");
        navItem(nav, "work", "▤", "My work");
        navItem(nav, "studio", "✧", "AI Studio");
        navItem(nav, "profile", "◉", "Profile");
        return nav;
    }

    private void navItem(LinearLayout nav, String key, String icon, String label) {
        boolean active = key.equals(tab);
        LinearLayout item = col();
        item.setGravity(Gravity.CENTER);
        item.setPadding(dp(3), dp(4), dp(3), dp(4));
        item.setBackground(shape(active ? LIGHT_TEAL : WHITE, 12, 0));
        TextView glyph = txt(icon, 19, active ? TEAL : MUTED, true);
        glyph.setGravity(Gravity.CENTER);
        item.addView(glyph);
        TextView caption = txt(label, 10, active ? TEAL : MUTED, active);
        caption.setGravity(Gravity.CENTER);
        item.addView(caption);
        nav.addView(item, new LinearLayout.LayoutParams(0, -2, 1));
        item.setClickable(true);
        item.setOnClickListener(v -> showApp(key));
    }

    private void showLoading(String message) {
        screen = "loading";
        FrameLayout frame = new FrameLayout(this);
        frame.setBackground(gradient(BG, LIGHT_PURPLE, 0));
        LinearLayout center = col();
        center.setGravity(Gravity.CENTER);
        center.setPadding(dp(26), dp(26), dp(26), dp(26));
        TextView logo = txt("C", 30, WHITE, true);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(gradient(PURPLE, TEAL, 22));
        center.addView(logo, new LinearLayout.LayoutParams(dp(72), dp(72)));
        gap(center, 16);
        center.addView(txt("collabzy", 27, INK, true));
        gap(center, 14);
        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(TEAL));
        center.addView(spinner, new LinearLayout.LayoutParams(dp(34), dp(34)));
        gap(center, 12);
        TextView label = txt(message, 14, MUTED, false);
        label.setGravity(Gravity.CENTER);
        center.addView(label);
        frame.addView(center, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        setContentView(frame);
    }

    private void showWelcome() {
        screen = "welcome";
        beginPage("CREATOR  ×  BRAND", false, false);
        if (!notice.isEmpty()) {
            message(body, notice, noticeIsError);
            gap(body, 12);
        }
        TextView eyebrow = txt("YOUR CREATOR BUSINESS, CONNECTED", 10, TEAL, true);
        eyebrow.setLetterSpacing(0.08f);
        body.addView(eyebrow);
        gap(body, 12);
        TextView headline = txt("Your next brand deal starts here.", 34, INK, true);
        headline.setLineSpacing(dp(3), 1f);
        body.addView(headline);
        gap(body, 12);
        TextView copy = txt("Discover creator campaigns, send smarter pitches and manage collaborations in one simple mobile app.", 15, MUTED, false);
        copy.setLineSpacing(dp(5), 1f);
        body.addView(copy);
        gap(body, 20);

        LinearLayout plan = col();
        plan.setPadding(dp(19), dp(19), dp(19), dp(18));
        plan.setBackground(gradient(Color.rgb(42, 29, 74), Color.rgb(92, 62, 157), 23));
        TextView planLabel = txt("COLLABZY PRO  ·  365 DAYS", 10, Color.rgb(122, 241, 219), true);
        planLabel.setLetterSpacing(0.08f);
        plan.addView(planLabel);
        gap(plan, 8);
        plan.addView(txt("₹299 / year", 30, WHITE, true));
        gap(plan, 5);
        plan.addView(txt("Smart creator tools for your next collaboration.", 13, Color.rgb(238, 232, 250), true));
        gap(plan, 12);
        TextView benefits = txt("✦  AI-assisted pitches and content ideas\n↗  Paid, barter and hybrid campaigns\n◎  Instagram insights after official Meta setup", 12, Color.rgb(243, 239, 251), false);
        benefits.setLineSpacing(dp(5), 1f);
        plan.addView(benefits);
        gap(plan, 15);
        plan.addView(button("Join private beta  →", true, () -> showAuth(true)), new LinearLayout.LayoutParams(-1, -2));
        gap(plan, 10);
        TextView priceNote = txt("Intro plan price. Checkout is not active yet; beta access is free. Campaigns and earnings are not guaranteed.", 10, Color.rgb(225, 218, 243), false);
        priceNote.setLineSpacing(dp(3), 1f);
        plan.addView(priceNote);
        body.addView(plan);
        gap(body, 18);

        LinearLayout features = card();
        feature(features, "✦", "Campaign discovery", "Find opportunities that match your niche.");
        gap(features, 15);
        feature(features, "↗", "Creator–brand workspace", "Manage applications and collaboration progress.");
        gap(features, 15);
        feature(features, "✧", "AI creator studio", "Draft hooks, captions, bios and brand pitches.");
        body.addView(features);
        gap(body, 20);
        body.addView(button("I already have an account", false, () -> showAuth(false)), new LinearLayout.LayoutParams(-1, -2));
        gap(body, 13);
        TextView beta = txt("PRIVATE BETA  ·  NO PAYMENT IS TAKEN", 10, MUTED, true);
        beta.setGravity(Gravity.CENTER);
        body.addView(beta);
    }

    private void showAuth(boolean create) {
        screen = "auth";
        beginPage(create ? "Create account" : "Sign in", false, true);
        section(body, create ? "Join Collabzy" : "Welcome back",
            create ? "Create a creator or brand account to get started." : "Sign in to open your collaboration workspace.");
        if (create) {
            body.addView(txt("I am joining as", 12, MUTED, true));
            gap(body, 8);
            LinearLayout roles = row();
            roles.addView(button("Creator" + ("creator".equals(signupRole) ? "  ✓" : ""),
                "creator".equals(signupRole), () -> { signupRole = "creator"; showAuth(true); }),
                new LinearLayout.LayoutParams(0, -2, 1));
            roles.addView(new View(this), new LinearLayout.LayoutParams(dp(10), 1));
            roles.addView(button("Brand" + ("brand".equals(signupRole) ? "  ✓" : ""),
                "brand".equals(signupRole), () -> { signupRole = "brand"; showAuth(true); }),
                new LinearLayout.LayoutParams(0, -2, 1));
            body.addView(roles);
            gap(body, 16);
            authName = input("Your full name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, false);
            field(body, "FULL NAME", authName);
        } else {
            authName = null;
        }
        authEmail = input("you@example.com", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, false);
        field(body, "EMAIL ADDRESS", authEmail);
        authPassword = input("At least 8 characters", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, false);
        field(body, "PASSWORD", authPassword);
        if (create) {
            authBetaCode = input("Only if you received an invite", InputType.TYPE_CLASS_TEXT, false);
            field(body, "PRIVATE BETA ACCESS CODE", authBetaCode);
            authTerms = new CheckBox(this);
            authTerms.setText("I agree to the Terms of Use and Privacy Notice.");
            authTerms.setTextColor(MUTED);
            authTerms.setTextSize(12);
            authTerms.setButtonTintList(android.content.res.ColorStateList.valueOf(TEAL));
            body.addView(authTerms);
            gap(body, 12);
        } else {
            authBetaCode = null;
            authTerms = null;
        }
        authMessage = txt("", 12, RED, false);
        authMessage.setLineSpacing(dp(3), 1f);
        if (!notice.isEmpty()) {
            authMessage.setText(notice);
            authMessage.setTextColor(noticeIsError ? RED : TEAL);
            notice = "";
            noticeIsError = false;
        }
        body.addView(authMessage);
        gap(body, 10);
        body.addView(button(create ? "Create account  →" : "Sign in  →", true, () -> submitAuth(create)),
            new LinearLayout.LayoutParams(-1, -2));
        gap(body, 12);
        body.addView(button(create ? "I already have an account" : "Create a new account", false,
            () -> showAuth(!create)), new LinearLayout.LayoutParams(-1, -2));
        if (!create) {
            gap(body, 11);
            body.addView(smallButton("Forgot your password?", this::showForgotPassword),
                new LinearLayout.LayoutParams(-1, -2));
        }
        gap(body, 16);
        TextView note = txt("Invite-only access may be required while the app is in private beta.", 11, MUTED, false);
        note.setGravity(Gravity.CENTER);
        body.addView(note);
    }

    private void submitAuth(boolean create) {
        String email = authEmail == null ? "" : authEmail.getText().toString().trim();
        String password = authPassword == null ? "" : authPassword.getText().toString();
        JSONObject payload = new JSONObject();
        try {
            payload.put("email", email);
            payload.put("password", password);
            if (create) {
                String name = authName == null ? "" : authName.getText().toString().trim();
                if (name.isEmpty()) { setAuthMessage("Enter your name to continue.", true); return; }
                if (email.isEmpty() || password.length() < 8) {
                    setAuthMessage("Enter a valid email and a password of at least 8 characters.", true); return;
                }
                if (authTerms == null || !authTerms.isChecked()) {
                    setAuthMessage("Please accept the Terms of Use and Privacy Notice.", true); return;
                }
                payload.put("name", name);
                payload.put("role", signupRole);
                payload.put("beta_code", authBetaCode == null ? "" : authBetaCode.getText().toString().trim());
                payload.put("accepted_terms", true);
            }
        } catch (Exception ignored) { setAuthMessage("Please check the details and try again.", true); return; }

        setAuthMessage(create ? "Creating your account…" : "Signing you in…", false);
        request("POST", create ? "/api/auth/register" : "/api/auth/login", payload, (data, error) -> {
            if (error != null) { setAuthMessage(error, true); return; }
            String nextToken = data == null ? "" : data.optString("token", "");
            if (nextToken.isEmpty()) {
                setAuthMessage(data == null ? "The server did not return a sign-in session."
                    : data.optString("message", "Your account needs another step before you can sign in."), false);
                return;
            }
            token = nextToken;
            prefs.edit().putString("token", token).apply();
            me = data.optJSONObject("user") == null ? new JSONObject() : data.optJSONObject("user");
            clearCaches();
            notice = "";
            showApp("discover");
        });
    }

    private void setAuthMessage(String text, boolean error) {
        if (authMessage != null) {
            authMessage.setText(text == null ? "" : text);
            authMessage.setTextColor(error ? RED : TEAL);
        } else toast(text);
    }

    private void showForgotPassword() {
        screen = "forgot";
        beginPage("Password recovery", false, true);
        section(body, "Reset your password", "We will ask the server to send a secure reset link if email delivery is configured.");
        EditText email = input("you@example.com", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, false);
        field(body, "EMAIL ADDRESS", email);
        TextView result = txt("", 12, MUTED, false);
        body.addView(result);
        gap(body, 10);
        body.addView(button("Send reset link", true, () -> {
            JSONObject payload = new JSONObject();
            try { payload.put("email", email.getText().toString().trim()); } catch (Exception ignored) {}
            result.setText("Sending request…");
            request("POST", "/api/auth/forgot-password", payload, (data, error) -> {
                result.setText(error == null ? data.optString("message",
                    "If an account matches, recovery instructions will be sent.") : error);
                result.setTextColor(error == null ? TEAL : RED);
            });
        }), new LinearLayout.LayoutParams(-1, -2));
    }

    private void showApp(String destination) {
        screen = "app";
        tab = destination == null ? "discover" : destination;
        String title = "discover".equals(tab) ? "Discover campaigns" :
            "work".equals(tab) ? "My work" : "studio".equals(tab) ? "AI Studio" : "Your profile";
        beginPage(title, true, false);
        renderTabBody();
        loadTabData();
    }

    private void renderTabBody() {
        if (body == null) return;
        body.removeAllViews();
        if ("discover".equals(tab)) renderDiscover();
        else if ("work".equals(tab)) renderWork();
        else if ("studio".equals(tab)) renderStudio();
        else renderProfile();
    }

    private void loadTabData() {
        if (!"app".equals(screen)) return;
        if ("discover".equals(tab)) {
            if (!statsLoaded) request("GET", "/api/dashboard", null, (data, error) -> {
                statsLoaded = true;
                if (error == null) stats = data.optJSONObject("stats") == null ? new JSONObject() : data.optJSONObject("stats");
                else toast(error);
                if ("app".equals(screen) && "discover".equals(tab)) renderTabBody();
            });
            if (!campaignsLoaded) request("GET", "/api/campaigns", null, (data, error) -> {
                campaignsLoaded = true;
                if (error == null) campaigns = data.optJSONArray("campaigns") == null ? new JSONArray() : data.optJSONArray("campaigns");
                else toast(error);
                if ("app".equals(screen) && "discover".equals(tab)) renderTabBody();
            });
        } else if ("work".equals(tab)) {
            if ("brand".equals(me.optString("role"))) {
                if (!brandCampaignsLoaded) request("GET", "/api/my-campaigns", null, (data, error) -> {
                    brandCampaignsLoaded = true;
                    if (error == null) brandCampaigns = data.optJSONArray("campaigns") == null ? new JSONArray() : data.optJSONArray("campaigns");
                    else toast(error);
                    if ("app".equals(screen) && "work".equals(tab)) renderTabBody();
                });
            } else if (!applicationsLoaded) request("GET", "/api/applications", null, (data, error) -> {
                applicationsLoaded = true;
                if (error == null) applications = data.optJSONArray("applications") == null ? new JSONArray() : data.optJSONArray("applications");
                else toast(error);
                if ("app".equals(screen) && "work".equals(tab)) renderTabBody();
            });
        } else if ("profile".equals(tab)) {
            if (!billingLoaded) request("GET", "/api/billing/status", null, (data, error) -> {
                billingLoaded = true;
                if (error == null) billing = data;
                if ("app".equals(screen) && "profile".equals(tab)) renderTabBody();
            });
            if (!instagramLoaded) request("GET", "/api/instagram/status", null, (data, error) -> {
                instagramLoaded = true;
                if (error == null) instagram = data;
                else {
                    instagram = new JSONObject();
                    try { instagram.put("message", error); } catch (Exception ignored) {}
                }
                if ("app".equals(screen) && "profile".equals(tab)) renderTabBody();
            });
        }
    }

    private void renderDiscover() {
        TextView eyebrow = txt("YOUR COLLABORATION WORKSPACE", 10, TEAL, true);
        eyebrow.setLetterSpacing(0.07f);
        body.addView(eyebrow);
        gap(body, 7);
        body.addView(txt("Hello, " + me.optString("name", "creator") + " 👋", 26, INK, true));
        gap(body, 5);
        body.addView(txt("Small steps today can build your next great collaboration.", 13, MUTED, false));
        gap(body, 17);

        LinearLayout hero = col();
        hero.setPadding(dp(18), dp(18), dp(18), dp(18));
        hero.setBackground(gradient(Color.rgb(232, 248, 244), Color.rgb(242, 238, 253), 21));
        hero.addView(txt("Make your next collaboration happen.", 20, INK, true));
        gap(hero, 7);
        hero.addView(txt("Explore campaign briefs and apply with a thoughtful pitch. Brands can publish from My work.", 12, MUTED, false));
        gap(hero, 13);
        hero.addView(button("brand".equals(me.optString("role")) ? "Publish a campaign  +" : "Open AI creator studio  ✧",
            true, () -> { if ("brand".equals(me.optString("role"))) showCampaignComposer(); else showApp("studio"); }));
        body.addView(hero);
        gap(body, 18);
        section(body, "Your activity", "A quick view of your workspace.");
        LinearLayout metrics = row();
        metrics.addView(metric("Active campaigns", statsLoaded ? String.valueOf(stats.optInt("activeCampaigns", 0)) : "—"),
            new LinearLayout.LayoutParams(0, -2, 1));
        metrics.addView(new View(this), new LinearLayout.LayoutParams(dp(8), 1));
        metrics.addView(metric("Applications", statsLoaded ? String.valueOf(stats.optInt("myApplications", 0)) : "—"),
            new LinearLayout.LayoutParams(0, -2, 1));
        metrics.addView(new View(this), new LinearLayout.LayoutParams(dp(8), 1));
        metrics.addView(metric("Accepted", statsLoaded ? String.valueOf(stats.optInt("accepted", 0)) : "—"),
            new LinearLayout.LayoutParams(0, -2, 1));
        body.addView(metrics);
        gap(body, 20);
        section(body, "Campaigns for you", "Paid, barter and hybrid opportunities.");
        if (!campaignsLoaded) body.addView(loadingCard("Loading active campaigns…"));
        else if (campaigns.length() == 0) body.addView(emptyCard("No active campaigns yet",
            "Check back soon for opportunities. Brands can publish a campaign to appear here."));
        else for (int i = 0; i < Math.min(campaigns.length(), 30); i++) {
            JSONObject c = campaigns.optJSONObject(i);
            if (c != null) { body.addView(campaignCard(c, false)); gap(body, 12); }
        }
        gap(body, 6);
        body.addView(smallButton("Refresh this screen", this::refreshCurrentTab));
    }

    private LinearLayout metric(String label, String value) {
        LinearLayout c = card();
        c.setPadding(dp(10), dp(13), dp(10), dp(13));
        c.addView(txt(value, 21, PURPLE, true));
        gap(c, 5);
        c.addView(txt(label, 10, MUTED, true));
        return c;
    }

    private View loadingCard(String message) {
        LinearLayout c = card();
        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(TEAL));
        c.addView(spinner, new LinearLayout.LayoutParams(dp(26), dp(26)));
        gap(c, 8);
        c.addView(txt(message, 13, MUTED, false));
        return c;
    }

    private View emptyCard(String title, String copy) {
        LinearLayout c = card();
        c.addView(txt("✧", 24, PURPLE, true));
        gap(c, 7);
        c.addView(txt(title, 16, INK, true));
        gap(c, 5);
        c.addView(txt(copy, 12, MUTED, false));
        return c;
    }

    private LinearLayout campaignCard(JSONObject c, boolean owned) {
        LinearLayout card = card();
        LinearLayout line = row();
        TextView type = txt(c.optString("collaboration_type", "Campaign").toUpperCase(), 10, TEAL, true);
        type.setPadding(dp(9), dp(6), dp(9), dp(6));
        type.setBackground(shape(LIGHT_TEAL, 10, 0));
        line.addView(type);
        TextView category = txt(c.optString("category", "Creator"), 11, MUTED, true);
        LinearLayout.LayoutParams categoryParams = new LinearLayout.LayoutParams(0, -2, 1);
        categoryParams.leftMargin = dp(8);
        line.addView(category, categoryParams);
        card.addView(line);
        gap(card, 10);
        card.addView(txt(c.optString("title", "Untitled campaign"), 18, INK, true));
        gap(card, 4);
        card.addView(txt("By " + c.optString("brand_name", "Brand") + "  ·  " + c.optString("location", "India"), 12, MUTED, false));
        gap(card, 10);
        card.addView(txt(shorten(c.optString("description", "Campaign details available when you open it."), 220), 13, INK, false));
        gap(card, 10);
        int min = c.optInt("budget_min", 0), max = c.optInt("budget_max", min);
        String budgetText = min == 0 && max == 0 ? c.optString("collaboration_type", "Collaboration") + " opportunity"
            : "₹" + min + (max > min ? " – ₹" + max : "") + " budget";
        card.addView(txt(budgetText, 13, TEAL, true));
        if (!c.optString("deliverables", "").isEmpty()) {
            gap(card, 4);
            card.addView(txt("Deliverables: " + c.optString("deliverables"), 11, MUTED, false));
        }
        gap(card, 13);
        if (owned) card.addView(txt("Applications: " + c.optInt("application_count", 0), 12, MUTED, true));
        else card.addView(button("View campaign & apply  →", true, () -> showApply(c)));
        return card;
    }

    private void renderWork() {
        if ("brand".equals(me.optString("role"))) {
            section(body, "Campaign manager", "Publish campaigns and follow applications from your brand.");
            body.addView(button("Create a campaign  +", true, this::showCampaignComposer), new LinearLayout.LayoutParams(-1, -2));
            gap(body, 18);
            section(body, "Your campaigns", "Campaigns published by your account.");
            if (!brandCampaignsLoaded) body.addView(loadingCard("Loading your campaigns…"));
            else if (brandCampaigns.length() == 0) body.addView(emptyCard("No campaigns published",
                "Create a brief with clear deliverables and budget. Active campaigns can appear in discovery."));
            else for (int i = 0; i < brandCampaigns.length(); i++) {
                JSONObject c = brandCampaigns.optJSONObject(i);
                if (c != null) { body.addView(campaignCard(c, true)); gap(body, 12); }
            }
            gap(body, 6);
            body.addView(smallButton("Refresh my campaigns", () -> { brandCampaignsLoaded = false; showApp("work"); }));
        } else {
            section(body, "My applications", "Track the campaigns you have applied to.");
            if (!applicationsLoaded) body.addView(loadingCard("Loading your applications…"));
            else if (applications.length() == 0) {
                body.addView(emptyCard("Your next opportunity is waiting", "Explore active campaigns and send a pitch. Your submissions will appear here."));
                gap(body, 12);
                body.addView(button("Explore campaigns", true, () -> showApp("discover")), new LinearLayout.LayoutParams(-1, -2));
            } else for (int i = 0; i < applications.length(); i++) {
                JSONObject a = applications.optJSONObject(i);
                if (a == null) continue;
                LinearLayout c = card();
                c.addView(txt(a.optString("campaign_title", "Campaign application"), 16, INK, true));
                gap(c, 5);
                c.addView(txt(a.optString("brand_name", "Brand"), 12, MUTED, false));
                gap(c, 10);
                String status = a.optString("status", "pending");
                TextView badge = txt(status.replace('_', ' ').toUpperCase(), 10,
                    "accepted".equals(status) ? TEAL : PURPLE, true);
                badge.setPadding(dp(9), dp(6), dp(9), dp(6));
                badge.setBackground(shape("accepted".equals(status) ? LIGHT_TEAL : LIGHT_PURPLE, 10, 0));
                c.addView(badge);
                body.addView(c);
                gap(body, 12);
            }
            gap(body, 6);
            body.addView(smallButton("Refresh my applications", () -> { applicationsLoaded = false; showApp("work"); }));
        }
    }

    private void showCampaignComposer() {
        screen = "composer";
        beginPage("Publish a campaign", false, true);
        section(body, "Create campaign", "Give creators a clear, honest brief with a budget and deliverables.");
        EditText title = input("e.g. Summer skincare Reel", InputType.TYPE_CLASS_TEXT, false);
        field(body, "CAMPAIGN TITLE", title);
        EditText description = input("What are you promoting? What should the creator make?", InputType.TYPE_CLASS_TEXT, true);
        field(body, "CAMPAIGN BRIEF", description);
        EditText category = input("e.g. Beauty, Fashion, Food, Tech", InputType.TYPE_CLASS_TEXT, false);
        field(body, "CATEGORY", category);
        EditText type = input("Paid, Barter or Hybrid", InputType.TYPE_CLASS_TEXT, false);
        type.setText("Paid");
        field(body, "COLLABORATION TYPE", type);
        LinearLayout budgets = row();
        EditText min = input("Min ₹", InputType.TYPE_CLASS_NUMBER, false);
        EditText max = input("Max ₹", InputType.TYPE_CLASS_NUMBER, false);
        budgets.addView(min, new LinearLayout.LayoutParams(0, -2, 1));
        budgets.addView(new View(this), new LinearLayout.LayoutParams(dp(10), 1));
        budgets.addView(max, new LinearLayout.LayoutParams(0, -2, 1));
        body.addView(txt("BUDGET RANGE (INR)", 12, MUTED, true));
        gap(body, 6);
        body.addView(budgets);
        gap(body, 13);
        EditText deliverables = input("e.g. 1 Reel + 2 story frames", InputType.TYPE_CLASS_TEXT, false);
        field(body, "DELIVERABLES", deliverables);
        EditText location = input("India", InputType.TYPE_CLASS_TEXT, false);
        location.setText("India");
        field(body, "LOCATION", location);
        composerMessage = txt("", 12, RED, false);
        body.addView(composerMessage);
        gap(body, 8);
        body.addView(button("Publish campaign  →", true, () -> {
            String t = title.getText().toString().trim();
            String d = description.getText().toString().trim();
            String cat = category.getText().toString().trim();
            String collab = type.getText().toString().trim();
            if (t.isEmpty() || d.isEmpty() || cat.isEmpty()) {
                composerMessage.setText("Add a title, brief and category before publishing.");
                composerMessage.setTextColor(RED); return;
            }
            if (!(collab.equalsIgnoreCase("Paid") || collab.equalsIgnoreCase("Barter") || collab.equalsIgnoreCase("Hybrid"))) {
                composerMessage.setText("Choose Paid, Barter or Hybrid as the collaboration type.");
                composerMessage.setTextColor(RED); return;
            }
            JSONObject payload = new JSONObject();
            try {
                payload.put("title", t);
                payload.put("description", d);
                payload.put("category", cat);
                payload.put("collaboration_type", titleCase(collab));
                payload.put("budget_min", number(min.getText().toString()));
                payload.put("budget_max", number(max.getText().toString()));
                payload.put("deliverables", deliverables.getText().toString().trim());
                payload.put("location", location.getText().toString().trim().isEmpty() ? "India" : location.getText().toString().trim());
            } catch (Exception ignored) {}
            composerMessage.setText("Publishing…");
            composerMessage.setTextColor(TEAL);
            request("POST", "/api/campaigns", payload, (data, error) -> {
                if (error != null) { composerMessage.setText(error); composerMessage.setTextColor(RED); }
                else {
                    campaignsLoaded = false;
                    brandCampaignsLoaded = false;
                    toast("Campaign published.");
                    showApp("work");
                }
            });
        }), new LinearLayout.LayoutParams(-1, -2));
    }

    private void showApply(JSONObject campaign) {
        selectedCampaignId = campaign.optString("id", "");
        selectedCampaignTitle = campaign.optString("title", "campaign");
        screen = "apply";
        beginPage("Campaign application", false, true);
        section(body, "Pitch this campaign", "Tell the brand why your content and audience fit the brief.");
        body.addView(txt(selectedCampaignTitle, 18, INK, true));
        gap(body, 5);
        body.addView(txt("Brand: " + campaign.optString("brand_name", "Brand"), 12, MUTED, false));
        gap(body, 16);
        EditText pitch = input("Share your content idea and why you fit this brief.", InputType.TYPE_CLASS_TEXT, true);
        field(body, "YOUR PITCH", pitch);
        EditText rate = input("Proposed rate in INR (optional)", InputType.TYPE_CLASS_NUMBER, false);
        field(body, "PROPOSED RATE", rate);
        applyMessage = txt("", 12, RED, false);
        body.addView(applyMessage);
        gap(body, 9);
        body.addView(button("Submit application  →", true, () -> {
            if (selectedCampaignId.isEmpty()) { applyMessage.setText("Invalid campaign id. Refresh campaigns and try again."); return; }
            JSONObject payload = new JSONObject();
            try {
                payload.put("pitch", pitch.getText().toString().trim());
                payload.put("proposed_rate", number(rate.getText().toString()));
            } catch (Exception ignored) {}
            applyMessage.setText("Submitting…");
            request("POST", "/api/campaigns/" + Uri.encode(selectedCampaignId) + "/apply", payload, (data, error) -> {
                if (error != null) { applyMessage.setText(error); applyMessage.setTextColor(RED); }
                else {
                    applicationsLoaded = false;
                    toast("Your application has been submitted.");
                    showApp("work");
                }
            });
        }), new LinearLayout.LayoutParams(-1, -2));
    }

    private void renderStudio() {
        boolean brand = "brand".equals(me.optString("role"));
        section(body, "AI creator studio", "Create a useful first draft. Review and personalize it before publishing.");
        LinearLayout plan = card();
        plan.setBackground(gradient(Color.rgb(42, 29, 74), Color.rgb(92, 62, 157), 20));
        plan.addView(txt("COLLABZY PRO", 10, Color.rgb(122, 241, 219), true));
        gap(plan, 5);
        plan.addView(txt("₹299 / year", 24, WHITE, true));
        gap(plan, 5);
        plan.addView(txt("Checkout is inactive in the private beta.", 11, Color.rgb(238, 232, 250), false));
        body.addView(plan);
        gap(body, 17);
        body.addView(txt("CHOOSE A TOOL", 11, MUTED, true));
        gap(body, 9);
        String[][] choices = brand
            ? new String[][]{{"brand_campaign_brief", "Campaign brief"}, {"brand_outreach", "Creator outreach"}, {"ugc_script", "UGC script"}, {"brand_campaign_plan", "Campaign plan"}}
            : new String[][]{{"reel_hooks", "Reel hooks"}, {"caption_hashtags", "Caption & hashtags"}, {"creator_bio", "Creator bio"}, {"content_calendar", "7-day calendar"}, {"brand_pitch", "Brand pitch"}};
        for (String[] choice : choices) {
            body.addView(button((selectedTool.equals(choice[0]) ? "✓  " : "") + choice[1], selectedTool.equals(choice[0]), () -> {
                selectedTool = choice[0];
                renderTabBody();
            }), new LinearLayout.LayoutParams(-1, -2));
            gap(body, 8);
        }
        studioBrief = input("Describe your niche, product or campaign. Include details to make the draft specific.", InputType.TYPE_CLASS_TEXT, true);
        field(body, "YOUR BRIEF", studioBrief);
        studioAudience = input("e.g. Gen Z beauty audience in India (optional)", InputType.TYPE_CLASS_TEXT, false);
        field(body, "TARGET AUDIENCE (OPTIONAL)", studioAudience);
        studioDisclosure = new CheckBox(this);
        studioDisclosure.setText("I understand my brief is sent to Collabzy's AI generation endpoint.");
        studioDisclosure.setTextColor(MUTED);
        studioDisclosure.setTextSize(12);
        studioDisclosure.setButtonTintList(android.content.res.ColorStateList.valueOf(TEAL));
        body.addView(studioDisclosure);
        gap(body, 11);
        studioOutput = txt("Your draft will appear here.", 13, MUTED, false);
        studioOutput.setLineSpacing(dp(4), 1f);
        studioOutput.setPadding(dp(14), dp(14), dp(14), dp(14));
        studioOutput.setBackground(shape(WHITE, 15, BORDER));
        body.addView(studioOutput);
        gap(body, 11);
        body.addView(button("Generate draft  ✧", true, this::generateAiDraft), new LinearLayout.LayoutParams(-1, -2));
    }

    private void generateAiDraft() {
        if (studioBrief == null || studioBrief.getText().toString().trim().length() < 4) {
            toast("Add a little more context for a useful draft."); return;
        }
        if (studioDisclosure == null || !studioDisclosure.isChecked()) {
            toast("Please confirm the AI data-use note before generating."); return;
        }
        JSONObject payload = new JSONObject();
        try {
            payload.put("tool", selectedTool);
            payload.put("brief", studioBrief.getText().toString().trim());
            payload.put("audience", studioAudience == null ? "" : studioAudience.getText().toString().trim());
            payload.put("tone", "warm and confident");
            payload.put("confirmed_ai_disclosure", true);
        } catch (Exception ignored) {}
        studioOutput.setText("Creating your draft…");
        studioOutput.setTextColor(TEAL);
        request("POST", "/api/ai/studio", payload, (data, error) -> {
            if (studioOutput == null) return;
            if (error != null) { studioOutput.setText(error); studioOutput.setTextColor(RED); }
            else {
                studioOutput.setText(data.optString("output",
                    data.optString("draft", data.optString("text", data.optString("message", "The draft could not be displayed."))));
                studioOutput.setTextColor(INK);
            }
        });
    }

    private void renderProfile() {
        section(body, "Your profile", "Account details, Instagram connection and membership.");
        LinearLayout profile = card();
        LinearLayout top = row();
        TextView avatar = txt(initial(me.optString("name", "C")), 24, WHITE, true);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(gradient(PURPLE, TEAL, 28));
        top.addView(avatar, new LinearLayout.LayoutParams(dp(54), dp(54)));
        LinearLayout labels = col();
        LinearLayout.LayoutParams names = new LinearLayout.LayoutParams(0, -2, 1);
        names.leftMargin = dp(12);
        labels.setLayoutParams(names);
        labels.addView(txt(me.optString("name", "Collabzy member"), 17, INK, true));
        labels.addView(txt(me.optString("email", ""), 12, MUTED, false));
        labels.addView(txt(me.optString("role", "creator").toUpperCase(), 10, TEAL, true));
        top.addView(labels);
        profile.addView(top);
        gap(profile, 13);
        profile.addView(txt("NICHE  ·  " + me.optString("niche", "Not added"), 11, MUTED, false));
        gap(profile, 7);
        profile.addView(txt("LOCATION  ·  " + me.optString("location", "Not added"), 11, MUTED, false));
        body.addView(profile);
        gap(body, 16);

        section(body, "Instagram connection", "Official insights require Meta app setup and Instagram authorization.");
        LinearLayout instagramCard = card();
        instagramStatus = txt(instagramLoaded ? instagram.optString("message",
            instagram.optBoolean("connected") ? "Instagram is connected." : "Instagram is not connected.") : "Checking Instagram connection…", 12, MUTED, false);
        instagramStatus.setLineSpacing(dp(3), 1f);
        instagramCard.addView(instagramStatus);
        gap(instagramCard, 10);
        instagramCard.addView(button(instagram.optBoolean("connected") ? "Refresh Instagram status" : "Connect Instagram", true, this::connectInstagram));
        gap(instagramCard, 10);
        instagramCard.addView(smallButton("Refresh status", () -> { instagramLoaded = false; showApp("profile"); }));
        body.addView(instagramCard);
        gap(body, 17);

        section(body, "Membership", "No payment is taken while the app is in private beta.");
        LinearLayout plan = card();
        plan.addView(txt("Collabzy Pro · 365 days", 16, INK, true));
        gap(plan, 4);
        plan.addView(txt("₹299 / year", 24, PURPLE, true));
        gap(plan, 6);
        String status = billingLoaded ? (billing.optBoolean("active") ? "Plan active" :
            billing.optBoolean("beta_access") ? "Private beta access" : "Plan not activated") : "Checking plan status…";
        billingStatus = txt(status, 12, MUTED, false);
        plan.addView(billingStatus);
        gap(plan, 8);
        plan.addView(txt("Secure checkout is not configured yet; the plan cannot be purchased from the app.", 11, MUTED, false));
        body.addView(plan);
        gap(body, 17);
        body.addView(button("Sign out", false, () -> { signOutLocal(); notice = ""; showWelcome(); }),
            new LinearLayout.LayoutParams(-1, -2));
    }

    private void connectInstagram() {
        if (instagramStatus != null) instagramStatus.setText("Opening official Instagram authorization…");
        request("GET", "/api/instagram/connect?platform=native", null, (data, error) -> {
            if (error != null) {
                if (instagramStatus != null) { instagramStatus.setText(error); instagramStatus.setTextColor(RED); }
                return;
            }
            String url = data.optString("authorization_url", "");
            if (url.isEmpty()) {
                if (instagramStatus != null) { instagramStatus.setText("The authorization link was not returned."); instagramStatus.setTextColor(RED); }
                return;
            }
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch (Exception ex) {
                if (instagramStatus != null) { instagramStatus.setText("Could not open Instagram authorization."); instagramStatus.setTextColor(RED); }
            }
        });
    }

    private void handleInstagramCallback(Intent intent) {
        if (!isInstagramCallback(intent)) return;
        String result = intent.getData().getQueryParameter("instagram");
        if ("connected".equals(result)) toast("Instagram connected. Refreshing status…");
        else if ("denied".equals(result)) toast("Instagram connection was cancelled.");
        else toast("Instagram could not be connected. Check the Meta app setup.");
        instagramLoaded = false;
        showApp("profile");
    }

    private boolean isInstagramCallback(Intent intent) {
        if (intent == null || intent.getData() == null) return false;
        Uri uri = intent.getData();
        return "collabzy".equals(uri.getScheme()) && "instagram".equals(uri.getHost()) && "/callback".equals(uri.getPath());
    }

    private void refreshCurrentTab() {
        if (!"app".equals(screen)) return;
        if ("discover".equals(tab)) { statsLoaded = false; campaignsLoaded = false; }
        else if ("work".equals(tab)) { applicationsLoaded = false; brandCampaignsLoaded = false; }
        else if ("profile".equals(tab)) { billingLoaded = false; instagramLoaded = false; }
        showApp(tab);
    }

    private void clearCaches() {
        stats = new JSONObject();
        billing = new JSONObject();
        instagram = new JSONObject();
        campaigns = new JSONArray();
        applications = new JSONArray();
        brandCampaigns = new JSONArray();
        statsLoaded = campaignsLoaded = applicationsLoaded = brandCampaignsLoaded = false;
        billingLoaded = instagramLoaded = false;
    }

    private void signOutLocal() {
        token = "";
        me = new JSONObject();
        prefs.edit().remove("token").apply();
        clearCaches();
    }

    private void showStartupFailure() {
        try {
            screen = "failure";
            FrameLayout frame = new FrameLayout(this);
            frame.setBackgroundColor(BG);
            LinearLayout center = col();
            center.setGravity(Gravity.CENTER);
            center.setPadding(dp(28), dp(28), dp(28), dp(28));
            TextView logo = txt("collabzy", 27, INK, true);
            logo.setGravity(Gravity.CENTER);
            center.addView(logo, new LinearLayout.LayoutParams(-1, -2));
            gap(center, 16);
            TextView title = txt("We couldn't open Collabzy.", 21, INK, true);
            title.setGravity(Gravity.CENTER);
            center.addView(title);
            gap(center, 10);
            TextView details = txt("The app hit a startup problem. Close and reopen it. If this keeps happening, share your Android version and this message with support.", 13, MUTED, false);
            details.setGravity(Gravity.CENTER);
            details.setLineSpacing(dp(4), 1f);
            center.addView(details);
            gap(center, 17);
            center.addView(button("Open welcome screen", true, this::showWelcome));
            frame.addView(center, new FrameLayout.LayoutParams(-1, -1));
            setContentView(frame);
        } catch (Throwable fatal) {
            android.util.Log.e("CollabzyStartup", "Unable to show startup fallback.", fatal);
        }
    }

    private void message(LinearLayout parent, String value, boolean error) {
        TextView v = txt(value, 12, error ? RED : TEAL, false);
        v.setPadding(dp(12), dp(10), dp(12), dp(10));
        v.setLineSpacing(dp(3), 1f);
        v.setBackground(shape(error ? Color.rgb(255, 239, 242) : LIGHT_TEAL, 12, 0));
        parent.addView(v);
    }

    private void request(String method, String path, JSONObject payload, Callback callback) {
        network.execute(() -> {
            JSONObject data = null;
            String error = null;
            try {
                Request.Builder builder = new Request.Builder().url(API + path).header("Accept", "application/json");
                if (!token.isEmpty()) builder.header("Authorization", "Bearer " + token);
                RequestBody body = payload == null ? null : RequestBody.create(payload.toString(), JSON);
                builder.method(method, body);
                try (Response response = client.newCall(builder.build()).execute()) {
                    String content = response.body() == null ? "" : response.body().string();
                    if (!content.isEmpty()) {
                        try { data = new JSONObject(content); }
                        catch (Exception ignored) { data = new JSONObject().put("message", content); }
                    }
                    if (!response.isSuccessful()) error = data == null
                        ? "Request failed (" + response.code() + ")."
                        : data.optString("error", data.optString("message", "Request failed (" + response.code() + ")."));
                    else if (data == null) data = new JSONObject();
                }
            } catch (Exception ex) {
                error = "Could not reach Collabzy. Check your internet connection and try again.";
                android.util.Log.w("CollabzyNetwork", method + " " + path + " failed.", ex);
            }
            JSONObject finalData = data;
            String finalError = error;
            main.post(() -> { if (!isFinishing() && callback != null) callback.done(finalData, finalError); });
        });
    }

    private void toast(String text) {
        if (text != null && !text.trim().isEmpty()) Toast.makeText(this, text, Toast.LENGTH_LONG).show();
    }
    private String initial(String name) {
        return name == null || name.trim().isEmpty() ? "C" : name.trim().substring(0, 1).toUpperCase();
    }
    private String shorten(String value, int max) {
        if (value == null) return "";
        String s = value.trim();
        return s.length() <= max ? s : s.substring(0, max - 1).trim() + "…";
    }
    private int number(String value) {
        try { return Math.max(0, Integer.parseInt(value.trim())); } catch (Exception ignored) { return 0; }
    }
    private String titleCase(String value) {
        if (value == null || value.isEmpty()) return "";
        String s = value.trim().toLowerCase();
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
