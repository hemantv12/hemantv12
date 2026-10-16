package com.collabzy.creator;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.text.InputType;
import org.json.JSONArray;
import org.json.JSONObject;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import java.util.concurrent.TimeUnit;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String API = "https://collabzy-api.onrender.com";
    private static final int BG = Color.rgb(12, 15, 31);
    private static final int PANEL = Color.rgb(23, 29, 51);
    private static final int PANEL_ALT = Color.rgb(30, 37, 63);
    private static final int MINT = Color.rgb(115, 234, 212);
    private static final int VIOLET = Color.rgb(178, 151, 255);
    private static final int WHITE = Color.rgb(246, 248, 255);
    private static final int MUTED = Color.rgb(159, 170, 197);
    private static final int RED = Color.rgb(255, 133, 151);

    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final OkHttpClient httpClient = new OkHttpClient.Builder().connectTimeout(18, TimeUnit.SECONDS).readTimeout(22, TimeUnit.SECONDS).build();
    private static final MediaType JSON_MEDIA = MediaType.get("application/json; charset=utf-8");
    private SharedPreferences storage;
    private FrameLayout frame;
    private LinearLayout content;
    private String token = "";
    private String screen = "welcome";
    private String authMode = "creator";
    private String aiTool = "";
    private JSONObject user = new JSONObject();
    private ProgressBar progress;
    private JSONObject dashboardStats = new JSONObject();
    private boolean dashboardLoaded = false;
    private boolean dashboardRequestStarted = false;
    private JSONArray cachedInstagramMedia = new JSONArray();
    private JSONArray cachedInstagramInsights = new JSONArray();

    private interface ApiCallback {
        void complete(JSONObject data, String error);
    }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        getWindow().getDecorView().setSystemUiVisibility(0);
        storage = getSharedPreferences("collabzy_native", MODE_PRIVATE);
        token = storage.getString("token", "");
        if (token.isEmpty()) {
            if (isInstagramCallback(getIntent())) {
                showWelcome();
                toast("Sign in to Collabzy, then connect Instagram from the app.");
            } else showWelcome();
        } else {
            api("GET", "/api/me", null, (data, error) -> {
                if (error == null && data != null) {
                    user = data.optJSONObject("user");
                    if (user == null) user = data;
                    screen = isInstagramCallback(getIntent()) ? "instagram" : "home";
                    showShell(screen);
                    handleInstagramCallback(getIntent());
                } else {
                    token = "";
                    storage.edit().remove("token").apply();
                    showWelcome();
                }
            });
            showLoadingScreen("Opening your workspace…");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isInstagramCallback(intent) && !token.isEmpty()) {
            handleInstagramCallback(intent);
            showShell("instagram");
        }
    }

    private boolean isInstagramCallback(Intent intent) {
        if (intent == null || intent.getData() == null) return false;
        Uri uri = intent.getData();
        return "collabzy".equals(uri.getScheme()) && "instagram".equals(uri.getHost())
            && "/callback".equals(uri.getPath());
    }

    private void handleInstagramCallback(Intent intent) {
        if (!isInstagramCallback(intent)) return;
        String result = intent.getData().getQueryParameter("instagram");
        if ("connected".equals(result)) {
            toast("Instagram connected. Refreshing account details…");
            api("GET", "/api/instagram/status", null, (data, error) -> {
                if (error == null && data != null) showShell("instagram");
                else toast(error == null ? "Instagram was connected, but status could not be refreshed." : error);
            });
        } else if ("denied".equals(result)) {
            toast("Instagram connection was cancelled.");
        } else {
            toast("Instagram could not be connected. Check Meta app setup and try again.");
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        network.shutdownNow();
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private GradientDrawable rounded(int color, int radius, int strokeColor) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(radius));
        if (strokeColor != 0) d.setStroke(dp(1), strokeColor);
        return d;
    }

    private GradientDrawable gradient(int top, int bottom, int radius) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{top, bottom});
        d.setCornerRadius(dp(radius));
        return d;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextColor(color);
        v.setTextSize(size);
        v.setIncludeFontPadding(true);
        if (bold) v.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        else v.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
        return v;
    }

    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    private LinearLayout row() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    private void gap(LinearLayout parent, int height) {
        View v = new View(this);
        parent.addView(v, new LinearLayout.LayoutParams(1, dp(height)));
    }

    private void line(LinearLayout parent, int color, int height) {
        View v = new View(this);
        v.setBackgroundColor(color);
        parent.addView(v, new LinearLayout.LayoutParams(-1, dp(height)));
    }

    private TextView button(String title, boolean primary) {
        TextView b = text(title, 15, primary ? BG : WHITE, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(16), dp(15), dp(16), dp(15));
        b.setMinHeight(dp(50));
        b.setBackground(rounded(primary ? MINT : PANEL_ALT, 17, primary ? 0 : Color.rgb(54, 63, 91)));
        b.setClickable(true);
        b.setFocusable(true);
        b.setAllCaps(false);
        return b;
    }

    private TextView smallButton(String title) {
        TextView b = text(title, 13, MINT, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(12), dp(10), dp(12), dp(10));
        b.setBackground(rounded(Color.rgb(28, 56, 65), 13, Color.rgb(43, 86, 91)));
        b.setClickable(true);
        b.setFocusable(true);
        return b;
    }

    private EditText field(String hint, int inputType, String value) {
        EditText e = new EditText(this);
        e.setTextColor(WHITE);
        e.setHintTextColor(Color.rgb(121, 133, 163));
        e.setHint(hint);
        e.setTextSize(15);
        e.setSingleLine(inputType != InputType.TYPE_CLASS_TEXT || !hint.equals("Short bio (optional)"));
        e.setInputType(inputType);
        e.setPadding(dp(16), dp(12), dp(16), dp(12));
        e.setMinHeight(dp(53));
        e.setBackground(rounded(PANEL_ALT, 15, Color.rgb(51, 61, 91)));
        if (value != null) e.setText(value);
        e.setSelectAllOnFocus(false);
        e.setImeOptions(EditorInfo.IME_ACTION_NEXT);
        return e;
    }

    private void addField(LinearLayout parent, String label, EditText edit) {
        TextView l = text(label, 12, MUTED, true);
        l.setLetterSpacing(0.04f);
        parent.addView(l);
        gap(parent, 7);
        parent.addView(edit, new LinearLayout.LayoutParams(-1, -2));
        gap(parent, 14);
    }

    private LinearLayout card() {
        LinearLayout c = column();
        c.setPadding(dp(17), dp(17), dp(17), dp(17));
        c.setBackground(rounded(PANEL, 22, Color.rgb(41, 49, 76)));
        return c;
    }

    private void showLoadingScreen(String message) {
        frame = new FrameLayout(this);
        frame.setBackground(gradient(BG, Color.rgb(25, 22, 48), 0));
        LinearLayout box = column();
        box.setGravity(Gravity.CENTER);
        TextView mark = text("C", 32, BG, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(MINT, 24, 0));
        box.addView(mark, new LinearLayout.LayoutParams(dp(72), dp(72)));
        gap(box, 18);
        box.addView(text("collabzy", 28, WHITE, true));
        gap(box, 8);
        ProgressBar spinner = new ProgressBar(this);
        spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(MINT));
        box.addView(spinner, new LinearLayout.LayoutParams(dp(36), dp(36)));
        gap(box, 12);
        box.addView(text(message, 14, MUTED, false));
        frame.addView(box, new FrameLayout.LayoutParams(-2, -2, Gravity.CENTER));
        setContentView(frame);
    }

    private void showWelcome() {
        screen = "welcome";
        frame = new FrameLayout(this);
        frame.setBackground(gradient(BG, Color.rgb(28, 22, 54), 0));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout page = column();
        page.setPadding(dp(24), dp(32), dp(24), dp(28));
        scroll.addView(page);
        frame.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout brand = row();
        TextView mark = text("C", 28, BG, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(MINT, 20, 0));
        brand.addView(mark, new LinearLayout.LayoutParams(dp(56), dp(56)));
        LinearLayout brandWords = column();
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-2, -2);
        bp.leftMargin = dp(12);
        brandWords.setLayoutParams(bp);
        brandWords.addView(text("collabzy", 25, WHITE, true));
        brandWords.addView(text("CREATOR  ×  BRAND", 10, MINT, true));
        brand.addView(brandWords);
        page.addView(brand);
        gap(page, 48);
        TextView eyebrow = text("YOUR CREATOR BUSINESS, CONNECTED", 11, MINT, true);
        eyebrow.setLetterSpacing(0.08f);
        page.addView(eyebrow);
        gap(page, 15);
        TextView headline = text("Your next big\ncollaboration starts here.", 35, WHITE, true);
        headline.setLineSpacing(dp(3), 1f);
        page.addView(headline);
        gap(page, 15);
        TextView explainer = text("Discover paid campaigns, meet the right brands, and keep every opportunity in one native app built for creators and teams.", 16, MUTED, false);
        explainer.setLineSpacing(dp(5), 1.05f);
        page.addView(explainer);
        gap(page, 28);
        LinearLayout valueCard = card();
        valueCard.setBackground(gradient(Color.rgb(28, 51, 67), Color.rgb(30, 30, 61), 22));
        addFeature(valueCard, "✦", "Smart campaign matching", "Find opportunities that fit your niche");
        gap(valueCard, 14);
        addFeature(valueCard, "↗", "Creator–brand workspace", "Applications, chats and progress together");
        gap(valueCard, 14);
        addFeature(valueCard, "✧", "AI-powered creator tools", "Draft ideas and pitches in less time");
        page.addView(valueCard);
        gap(page, 28);
        TextView create = button("Create your account  →", true);
        create.setOnClickListener(v -> showAuth(true));
        page.addView(create);
        gap(page, 12);
        TextView signIn = button("I already have an account", false);
        signIn.setOnClickListener(v -> showAuth(false));
        page.addView(signIn);
        gap(page, 18);
        TextView legal = text("Invite-only early access  •  No payment is taken in this beta", 11, MUTED, false);
        legal.setGravity(Gravity.CENTER);
        page.addView(legal);
        setContentView(frame);
        fadeIn(page);
    }

    private void addFeature(LinearLayout parent, String icon, String title, String subtitle) {
        LinearLayout r = row();
        TextView glyph = text(icon, 22, MINT, true);
        glyph.setGravity(Gravity.CENTER);
        glyph.setBackground(rounded(Color.rgb(32, 67, 75), 13, 0));
        r.addView(glyph, new LinearLayout.LayoutParams(dp(43), dp(43)));
        LinearLayout copy = column();
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
        p.leftMargin = dp(12);
        copy.setLayoutParams(p);
        copy.addView(text(title, 14, WHITE, true));
        gap(copy, 3);
        copy.addView(text(subtitle, 12, MUTED, false));
        r.addView(copy);
        parent.addView(r);
    }

    private void showAuth(boolean create) {
        screen = create ? "register" : "login";
        frame = new FrameLayout(this);
        frame.setBackground(gradient(BG, Color.rgb(25, 22, 49), 0));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout page = column();
        page.setPadding(dp(22), dp(20), dp(22), dp(28));
        scroll.addView(page);
        frame.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        TextView back = text("‹   Back", 15, MINT, true);
        back.setPadding(0, dp(10), 0, dp(10));
        back.setOnClickListener(v -> showWelcome());
        page.addView(back);
        gap(page, 13);
        LinearLayout markRow = row();
        TextView mark = text("C", 23, BG, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(MINT, 17, 0));
        markRow.addView(mark, new LinearLayout.LayoutParams(dp(48), dp(48)));
        TextView word = text("collabzy", 23, WHITE, true);
        LinearLayout.LayoutParams wp = new LinearLayout.LayoutParams(-2, -2);
        wp.leftMargin = dp(11);
        markRow.addView(word, wp);
        page.addView(markRow);
        gap(page, 25);
        page.addView(text(create ? "Create your account" : "Welcome back", 29, WHITE, true));
        gap(page, 8);
        page.addView(text(create ? "Join the Collabzy private beta and set up your workspace." : "Sign in to pick up where your next collaboration begins.", 14, MUTED, false));
        gap(page, 24);
        LinearLayout form = card();
        EditText name = field("Your full name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, "");
        EditText email = field("you@example.com", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, "");
        EditText password = field("At least 8 characters", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD, "");
        EditText beta = field("Private beta invite code", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS, "");
        if (create) addField(form, "FULL NAME", name);
        addField(form, "EMAIL ADDRESS", email);
        addField(form, "PASSWORD", password);
        LinearLayout roleRow = row();
        TextView creatorRole = button("Creator", true);
        TextView brandRole = button("Brand", false);
        roleRow.addView(creatorRole, new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(0, -2, 1);
        rp.leftMargin = dp(8);
        roleRow.addView(brandRole, rp);
        if (create) {
            TextView roleTitle = text("I'M JOINING AS", 12, MUTED, true);
            form.addView(roleTitle);
            gap(form, 8);
            form.addView(roleRow);
            gap(form, 14);
            TextView betaTitle = text("PRIVATE BETA CODE", 12, MUTED, true);
            form.addView(betaTitle);
            gap(form, 7);
            form.addView(beta, new LinearLayout.LayoutParams(-1, -2));
            gap(form, 12);
        }
        CheckBox terms = new CheckBox(this);
        terms.setText("I agree to the Terms of Use and Privacy Notice");
        terms.setTextColor(MUTED);
        terms.setTextSize(12);
        terms.setButtonTintList(new android.content.res.ColorStateList(
            new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
            new int[]{MINT, MUTED}));
        if (create) form.addView(terms);
        gap(form, 4);
        TextView notice = text("Private beta access is required while public registration is paused. No payment is collected here.", 11, MUTED, false);
        form.addView(notice);
        page.addView(form);
        gap(page, 18);
        TextView submit = button(create ? "Create account  →" : "Sign in  →", true);
        page.addView(submit);
        gap(page, 12);
        TextView swap = text(create ? "Already registered?  Sign in" : "New to Collabzy?  Create account", 14, VIOLET, true);
        swap.setGravity(Gravity.CENTER);
        swap.setPadding(dp(10), dp(13), dp(10), dp(13));
        page.addView(swap);
        swap.setOnClickListener(v -> showAuth(!create));

        final String[] selectedRole = new String[]{"creator"};
        creatorRole.setOnClickListener(v -> {
            selectedRole[0] = "creator";
            creatorRole.setBackground(rounded(MINT, 17, 0));
            creatorRole.setTextColor(BG);
            brandRole.setBackground(rounded(PANEL_ALT, 17, Color.rgb(54, 63, 91)));
            brandRole.setTextColor(WHITE);
        });
        brandRole.setOnClickListener(v -> {
            selectedRole[0] = "brand";
            brandRole.setBackground(rounded(MINT, 17, 0));
            brandRole.setTextColor(BG);
            creatorRole.setBackground(rounded(PANEL_ALT, 17, Color.rgb(54, 63, 91)));
            creatorRole.setTextColor(WHITE);
        });
        submit.setOnClickListener(v -> {
            String mail = email.getText().toString().trim();
            String pass = password.getText().toString();
            if (mail.isEmpty() || pass.isEmpty() || (create && name.getText().toString().trim().isEmpty())) {
                toast("Please complete the required fields.");
                return;
            }
            if (create && !terms.isChecked()) {
                toast("Please accept the Terms of Use and Privacy Notice.");
                return;
            }
            hideKeyboard();
            JSONObject payload = new JSONObject();
            try {
                payload.put("email", mail);
                payload.put("password", pass);
                if (create) {
                    payload.put("name", name.getText().toString().trim());
                    payload.put("role", selectedRole[0]);
                    payload.put("beta_code", beta.getText().toString().trim());
                    payload.put("accepted_terms", terms.isChecked());
                }
            } catch (Exception ignored) {}
            submit.setText("Connecting securely…");
            submit.setEnabled(false);
            api("POST", create ? "/api/auth/register" : "/api/auth/login", payload, (data, error) -> {
                submit.setEnabled(true);
                submit.setText(create ? "Create account  →" : "Sign in  →");
                if (error != null) {
                    toast(error);
                    return;
                }
                if (data.optBoolean("requires_email_verification")) {
                    toast("Account created. Check your email to verify it before signing in.");
                    showAuth(false);
                    return;
                }
                token = data.optString("token", "");
                JSONObject returnedUser = data.optJSONObject("user");
                if (token.isEmpty() || returnedUser == null) {
                    toast("The server response was incomplete. Please try again.");
                    return;
                }
                user = returnedUser;
                storage.edit().putString("token", token).apply();
                screen = "home";
                showShell("home");
            });
        });
        setContentView(frame);
        fadeIn(page);
    }

    private void hideKeyboard() {
        try {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) imm.hideSoftInputFromWindow(frame.getWindowToken(), 0);
        } catch (Exception ignored) {}
    }

    private void showShell(String target) {
        screen = target;
        frame = new FrameLayout(this);
        frame.setBackground(gradient(BG, Color.rgb(20, 20, 43), 0));
        LinearLayout shell = column();
        frame.addView(shell, new FrameLayout.LayoutParams(-1, -1));
        shell.addView(header(), new LinearLayout.LayoutParams(-1, -2));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.setClipToPadding(false);
        content = column();
        content.setPadding(dp(18), dp(15), dp(18), dp(24));
        scroll.addView(content);
        shell.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));
        shell.addView(bottomNavigation(target), new LinearLayout.LayoutParams(-1, -2));
        setContentView(frame);
        switch (target) {
            case "explore": renderExplore(); break;
            case "matches": renderMatches(); break;
            case "inbox": renderInbox(); break;
            case "profile": renderProfile(); break;
            case "more": renderMore(); break;
            case "saved": renderSavedCampaigns(); break;
            case "invitations": renderInvitations(); break;
            case "notifications": renderNotifications(); break;
            case "my_campaigns": renderMyCampaigns(); break;
            case "instagram": renderInstagram(); break;
            case "autodm": renderAutoDM(); break;
            case "billing": renderBilling(); break;
            case "support": renderSupport(); break;
            case "applications": renderApplications(); break;
            case "ai": renderAI(); break;
            case "create_campaign": renderCreateCampaign(); break;
            case "conversation": renderConversation(); break;
            default: renderHome();
        }
        fadeIn(content);
    }

    private View header() {
        LinearLayout h = row();
        h.setPadding(dp(18), dp(13), dp(18), dp(11));
        h.setBackgroundColor(Color.rgb(15, 18, 36));
        TextView mark = text("C", 20, BG, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(MINT, 15, 0));
        h.addView(mark, new LinearLayout.LayoutParams(dp(42), dp(42)));
        LinearLayout words = column();
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
        p.leftMargin = dp(10);
        h.addView(words, p);
        words.addView(text("collabzy", 19, WHITE, true));
        words.addView(text("COLLABORATION, IN MOTION", 8, MUTED, true));
        String initial = user.optString("name", "C");
        initial = initial.isEmpty() ? "C" : initial.substring(0, 1).toUpperCase(Locale.ROOT);
        TextView avatar = text(initial, 15, MINT, true);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(rounded(Color.rgb(34, 44, 70), 16, Color.rgb(56, 75, 105)));
        h.addView(avatar, new LinearLayout.LayoutParams(dp(40), dp(40)));
        avatar.setOnClickListener(v -> showShell("profile"));
        return h;
    }

    private View bottomNavigation(String active) {
        LinearLayout nav = row();
        nav.setPadding(dp(7), dp(8), dp(7), dp(10));
        nav.setBackground(rounded(Color.rgb(16, 20, 39), 0, Color.rgb(43, 49, 73)));
        String[] labels = new String[]{"Home", "Explore", "Matches", "Inbox", "More"};
        String[] keys = new String[]{"home", "explore", "matches", "inbox", "more"};
        String[] glyphs = new String[]{"⌂", "⌕", "✦", "▤", "•••"};
        for (int i = 0; i < labels.length; i++) {
            final String key = keys[i];
            boolean selected = active.equals(key) || (active.equals("conversation") && key.equals("inbox"));
            LinearLayout item = column();
            item.setGravity(Gravity.CENTER);
            TextView icon = text(glyphs[i], 21, selected ? MINT : MUTED, true);
            icon.setGravity(Gravity.CENTER);
            item.addView(icon);
            TextView label = text(labels[i], 9, selected ? MINT : MUTED, selected);
            item.addView(label);
            item.setPadding(dp(2), dp(3), dp(2), dp(2));
            item.setBackground(rounded(selected ? Color.rgb(27, 43, 58) : Color.TRANSPARENT, 13, 0));
            item.setClickable(true);
            item.setOnClickListener(v -> showShell(key));
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
            p.leftMargin = dp(2);
            p.rightMargin = dp(2);
            nav.addView(item, p);
        }
        return nav;
    }

    private void heading(String title, String subtitle) {
        content.addView(text(title, 27, WHITE, true));
        gap(content, 6);
        content.addView(text(subtitle, 13, MUTED, false));
        gap(content, 19);
    }

    private void renderHome() {
        boolean creator = "creator".equals(user.optString("role", "creator"));
        String name = user.optString("name", "there");
        int space = name.indexOf(' ');
        if (space > 0) name = name.substring(0, space);
        content.addView(text("YOUR WORKSPACE", 10, MINT, true));
        gap(content, 8);
        content.addView(text("Hey " + name + ",", 29, WHITE, true));
        gap(content, 5);
        content.addView(text(creator ? "Your next opportunity is out there." : "Let's build your next campaign.", 14, MUTED, false));
        gap(content, 19);

        LinearLayout hero = column();
        hero.setPadding(dp(20), dp(20), dp(20), dp(20));
        hero.setBackground(gradient(Color.rgb(33, 66, 76), Color.rgb(42, 36, 76), 24));
        TextView chip = text(creator ? "✦  CREATOR STUDIO" : "✦  BRAND STUDIO", 10, MINT, true);
        chip.setLetterSpacing(0.08f);
        hero.addView(chip);
        gap(hero, 12);
        hero.addView(text(creator ? "Turn your influence\ninto opportunity." : "Find creators who\nfit your brand.", 25, WHITE, true));
        gap(hero, 9);
        hero.addView(text(creator ? "Discover relevant briefs, match with brands, and manage the conversations that matter." : "Publish a campaign, discover talent, and move every collaboration forward.", 13, Color.rgb(210, 218, 240), false));
        gap(hero, 17);
        TextView cta = button(creator ? "Explore campaigns  →" : "Open campaign studio  →", true);
        hero.addView(cta, new LinearLayout.LayoutParams(-1, -2));
        cta.setOnClickListener(v -> showShell("explore"));
        content.addView(hero);
        gap(content, 22);

        heading("Your at-a-glance", "Real account information, not demo numbers.");
        LinearLayout statRow = row();
        statRow.addView(statCard(creator ? "Followers" : "Campaigns", creator ? compact(user.optLong("followers", 0)) : "View studio",
                creator && user.optString("instagram_handle", "").isEmpty() ? "Instagram not linked" : (creator ? "Profile audience" : "Campaign manager")), new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(0, -2, 1);
        sp.leftMargin = dp(10);
        statRow.addView(statCard(creator ? "Engagement" : "Account type", creator ? (user.optDouble("engagement", 0) > 0 ? String.format(Locale.US, "%.1f%%", user.optDouble("engagement", 0)) : "—") : "Brand",
                creator ? "From your profile" : "Brand workspace"), sp);
        content.addView(statRow);
        gap(content, 22);

        heading("Made for your next move", "Jump back into the tools you need.");
        addQuickAction("✦", "Smart matches", creator ? "Find briefs that fit your niche" : "Discover relevant creators", () -> showShell("matches"));
        gap(content, 10);
        addQuickAction("◎", "Explore opportunities", creator ? "Paid, barter and hybrid campaigns" : "Browse the marketplace", () -> showShell("explore"));
        gap(content, 10);
        addQuickAction("✧", "AI Studio", "Pitches, content ideas and campaign briefs", () -> showShell("ai"));
        gap(content, 10);
        addQuickAction("▤", "Applications & activity", "Track collaboration progress", () -> showShell("applications"));
        gap(content, 10);
        addQuickAction("◎", "Instagram & creator insights", "Official account connection and metrics", () -> showShell("instagram"));
        if (!creator) {
            gap(content, 10);
            addQuickAction("+", "Create a campaign", "Publish a collaboration brief", () -> showShell("create_campaign"));
            gap(content, 10);
            addQuickAction("♙", "Manage campaigns", "Edit status and review applicants", () -> showShell("my_campaigns"));
        }
        gap(content, 18);
        TextView beta = text("PRIVATE BETA  ·  Built for real creator–brand workflows", 10, MUTED, false);
        beta.setGravity(Gravity.CENTER);
        content.addView(beta);
    }

    private View statCard(String title, String value, String hint) {
        LinearLayout c = card();
        c.setPadding(dp(15), dp(15), dp(15), dp(15));
        c.addView(text(title, 11, MUTED, true));
        gap(c, 9);
        c.addView(text(value, 21, WHITE, true));
        gap(c, 4);
        c.addView(text(hint, 10, MUTED, false));
        return c;
    }

    private void addQuickAction(String glyph, String title, String subtitle, Runnable action) {
        LinearLayout c = row();
        c.setPadding(dp(14), dp(14), dp(14), dp(14));
        c.setBackground(rounded(PANEL, 19, Color.rgb(43, 52, 79)));
        TextView icon = text(glyph, 21, MINT, true);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(rounded(Color.rgb(32, 54, 66), 14, 0));
        c.addView(icon, new LinearLayout.LayoutParams(dp(45), dp(45)));
        LinearLayout copy = column();
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
        p.leftMargin = dp(12);
        copy.setLayoutParams(p);
        copy.addView(text(title, 14, WHITE, true));
        gap(copy, 3);
        copy.addView(text(subtitle, 11, MUTED, false));
        c.addView(copy);
        c.addView(text("›", 25, MUTED, false));
        c.setClickable(true);
        c.setOnClickListener(v -> action.run());
        content.addView(c);
    }

    private String compact(long n) {
        if (n >= 1000000) return String.format(Locale.US, "%.1fM", n / 1000000.0);
        if (n >= 1000) return String.format(Locale.US, "%.1fK", n / 1000.0);
        return String.valueOf(n);
    }

    private String budget(JSONObject c) {
        long min = c.optLong("budget_min", 0), max = c.optLong("budget_max", 0);
        if (min <= 0 && max <= 0) return "Budget to be discussed";
        if (min > 0 && max > min) return "₹" + compact(min) + " – ₹" + compact(max);
        if (max > 0) return "Up to ₹" + compact(max);
        return "From ₹" + compact(min);
    }

    private void renderExplore() {
        if ("brand".equals(user.optString("role"))) {
            heading("Creator discovery", "Explore the marketplace or publish a new brief.");
            TextView post = button("+  Create campaign", true);
            post.setOnClickListener(v -> showShell("create_campaign"));
            content.addView(post);
            gap(content, 18);
        } else {
            heading("Explore campaigns", "Find paid, barter and hybrid collaborations.");
        }
        TextView loading = text("Loading live opportunities…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "brand".equals(user.optString("role")) ? "/api/creators" : "/api/campaigns", null, (data, error) -> {
            if (!"explore".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Could not load opportunities", error);
                return;
            }
            if ("brand".equals(user.optString("role"))) {
                JSONArray creators = data.optJSONArray("creators");
                if (creators == null || creators.length() == 0) {
                    showEmpty("Creator profiles will appear here", "Create a campaign and invite creators once profiles are available.");
                    return;
                }
                for (int i = 0; i < creators.length(); i++) {
                    JSONObject creator = creators.optJSONObject(i);
                    if (creator != null) renderCreatorCard(creator);
                }
            } else {
                JSONArray campaigns = data.optJSONArray("campaigns");
                if (campaigns == null || campaigns.length() == 0) {
                    showEmpty("Your next campaign is still out there", "No live campaigns are available right now. Check back as brands publish new briefs.");
                    return;
                }
                for (int i = 0; i < campaigns.length(); i++) {
                    JSONObject campaign = campaigns.optJSONObject(i);
                    if (campaign != null) renderCampaignCard(campaign, false, null);
                }
            }
        });
    }

    private void renderCampaignCard(JSONObject c, boolean withScore, JSONObject match) {
        LinearLayout card = card();
        LinearLayout meta = row();
        TextView type = text(c.optString("collaboration_type", "COLLAB"), 10, MINT, true);
        type.setPadding(dp(9), dp(6), dp(9), dp(6));
        type.setBackground(rounded(Color.rgb(29, 58, 64), 10, 0));
        meta.addView(type);
        View spacer = new View(this);
        meta.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
        if (withScore && match != null) {
            TextView score = text(match.optInt("score", 0) + "% match", 11, VIOLET, true);
            meta.addView(score);
        }
        card.addView(meta);
        gap(card, 12);
        card.addView(text(c.optString("title", "Campaign opportunity"), 18, WHITE, true));
        gap(card, 4);
        card.addView(text(c.optString("brand_name", "Brand"), 12, MUTED, true));
        gap(card, 10);
        card.addView(text(budget(c), 14, MINT, true));
        gap(card, 9);
        card.addView(text(c.optString("description", "Open the brief to review collaboration details."), 13, Color.rgb(204, 212, 234), false));
        if (match != null) {
            JSONArray reasons = match.optJSONArray("reasons");
            if (reasons != null && reasons.length() > 0) {
                gap(card, 10);
                card.addView(text("WHY IT MATCHES", 10, VIOLET, true));
                for (int i = 0; i < Math.min(2, reasons.length()); i++) {
                    gap(card, 4);
                    card.addView(text("• " + reasons.optString(i), 11, MUTED, false));
                }
            }
        }
        gap(card, 15);
        LinearLayout actions = row();
        TextView apply = smallButton("View & apply");
        TextView save = smallButton(screen.equals("saved") ? "Remove saved" : "Save");
        actions.addView(apply, new LinearLayout.LayoutParams(0, -2, 1));
        LinearLayout.LayoutParams saveParams = new LinearLayout.LayoutParams(0, -2, 1);
        saveParams.leftMargin = dp(8);
        actions.addView(save, saveParams);
        apply.setOnClickListener(v -> showApplyDialog(c));
        save.setOnClickListener(v -> {
            boolean remove = screen.equals("saved");
            String method = remove ? "DELETE" : "POST";
            api(method, "/api/campaigns/" + c.optLong("id") + "/save", json("saved", "true"), (data, error) -> {
                if (error != null) toast(error);
                else {
                    toast(remove ? "Removed from saved campaigns." : "Campaign saved.");
                    dashboardLoaded = false;
                    if (remove) showShell("saved");
                }
            });
        });
        card.addView(actions, new LinearLayout.LayoutParams(-1, -2));
        content.addView(card);
        gap(content, 12);
    }

    private void renderCreatorCard(JSONObject c) {
        LinearLayout card = card();
        LinearLayout r = row();
        String name = c.optString("name", "Creator");
        TextView avatar = text(name.isEmpty() ? "C" : name.substring(0, 1).toUpperCase(Locale.ROOT), 18, BG, true);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(rounded(VIOLET, 16, 0));
        r.addView(avatar, new LinearLayout.LayoutParams(dp(47), dp(47)));
        LinearLayout copy = column();
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
        p.leftMargin = dp(11);
        copy.setLayoutParams(p);
        copy.addView(text(name, 16, WHITE, true));
        gap(copy, 3);
        copy.addView(text(c.optString("niche", "Creator"), 12, MUTED, false));
        r.addView(copy);
        card.addView(r);
        gap(card, 12);
        card.addView(text(compact(c.optLong("followers", 0)) + " followers  ·  " + (c.optDouble("engagement", 0) > 0 ? String.format(Locale.US, "%.1f%% engagement", c.optDouble("engagement", 0)) : "Engagement not added"), 12, MINT, true));
        gap(card, 8);
        card.addView(text(c.optString("bio", "Creator profile"), 12, MUTED, false));
        gap(card, 12);
        TextView invite = smallButton("Invite to a campaign  →");
        card.addView(invite);
        invite.setOnClickListener(v -> showInviteDialog(c));
        content.addView(card);
        gap(content, 12);
    }

    private void showInviteDialog(JSONObject creator) {
        api("GET", "/api/my-campaigns", null, (data, error) -> {
            if (error != null) { toast(error); return; }
            JSONArray campaigns = data.optJSONArray("campaigns");
            java.util.ArrayList<JSONObject> active = new java.util.ArrayList<>();
            java.util.ArrayList<String> labels = new java.util.ArrayList<>();
            if (campaigns != null) {
                for (int i = 0; i < campaigns.length(); i++) {
                    JSONObject campaign = campaigns.optJSONObject(i);
                    if (campaign != null && "active".equals(campaign.optString("status"))) {
                        active.add(campaign);
                        labels.add(campaign.optString("title", "Campaign") + "  ·  " + budget(campaign));
                    }
                }
            }
            if (active.isEmpty()) {
                new android.app.AlertDialog.Builder(this).setTitle("Create a campaign first")
                    .setMessage("Publish an active campaign before inviting a creator.")
                    .setPositiveButton("Create campaign", (d, w) -> showShell("create_campaign"))
                    .setNegativeButton("Cancel", null).show();
                return;
            }
            new android.app.AlertDialog.Builder(this)
                .setTitle("Invite " + creator.optString("name", "creator"))
                .setItems(labels.toArray(new String[0]), (dialog, which) -> {
                    JSONObject campaign = active.get(which);
                    JSONObject payload = new JSONObject();
                    try {
                        payload.put("creator_id", creator.optLong("id"));
                        payload.put("message", "We would like to invite you to collaborate on " + campaign.optString("title", "our campaign") + ".");
                    } catch (Exception ignored) {}
                    api("POST", "/api/campaigns/" + campaign.optLong("id") + "/invite", payload, (result, problem) -> {
                        if (problem != null) toast(problem);
                        else {
                            toast("Invitation sent.");
                            dashboardLoaded = false;
                        }
                    });
                }).setNegativeButton("Cancel", null).show();
        });
    }

    private void showApplyDialog(JSONObject campaign) {
        android.app.Dialog dialog = new android.app.Dialog(this);
        LinearLayout box = column();
        box.setPadding(dp(22), dp(22), dp(22), dp(22));
        box.setBackground(rounded(PANEL, 24, Color.rgb(57, 70, 99)));
        box.addView(text("Apply to campaign", 21, WHITE, true));
        gap(box, 8);
        box.addView(text(campaign.optString("title", "Campaign"), 13, MINT, true));
        gap(box, 16);
        EditText pitch = field("Tell the brand why you're a fit", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, "");
        pitch.setMinLines(3);
        pitch.setGravity(Gravity.TOP | Gravity.START);
        box.addView(pitch);
        gap(box, 12);
        EditText rate = field("Your proposed rate in ₹ (optional)", InputType.TYPE_CLASS_NUMBER, "");
        box.addView(rate);
        gap(box, 16);
        TextView send = button("Send application", true);
        box.addView(send);
        gap(box, 8);
        TextView cancel = button("Cancel", false);
        box.addView(cancel);
        cancel.setOnClickListener(v -> dialog.dismiss());
        send.setOnClickListener(v -> {
            JSONObject payload = new JSONObject();
            try {
                payload.put("pitch", pitch.getText().toString().trim());
                payload.put("proposed_rate", rate.getText().toString().trim().isEmpty() ? 0 : Long.parseLong(rate.getText().toString().trim()));
            } catch (Exception ignored) {}
            send.setText("Sending…");
            send.setEnabled(false);
            api("POST", "/api/campaigns/" + campaign.optLong("id") + "/apply", payload, (data, error) -> {
                send.setEnabled(true);
                if (error != null) {
                    send.setText("Send application");
                    toast(error);
                } else {
                    dialog.dismiss();
                    toast("Application sent. You can continue the conversation in Inbox.");
                    showShell("applications");
                }
            });
        });
        dialog.setContentView(box);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            dialog.getWindow().setLayout(getResources().getDisplayMetrics().widthPixels - dp(34), -2);
        }
        dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            dialog.getWindow().setLayout(getResources().getDisplayMetrics().widthPixels - dp(34), -2);
        }
    }

    private void renderMatches() {
        boolean creator = "creator".equals(user.optString("role", "creator"));
        heading("Smart Match Center", creator ? "Relevant campaign ideas, with reasons behind each score." : "Creator profiles ranked by fit signals from your brand and campaigns.");
        TextView note = text("Match scores are guidance, not guarantees of acceptance or earnings.", 11, MUTED, false);
        note.setPadding(dp(13), dp(12), dp(13), dp(12));
        note.setBackground(rounded(Color.rgb(31, 28, 54), 14, 0));
        content.addView(note);
        gap(content, 14);
        TextView loading = text("Finding your best matches…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/matches", null, (data, error) -> {
            if (!"matches".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Matches are unavailable", error);
                return;
            }
            JSONArray matches = data.optJSONArray("matches");
            if (matches == null || matches.length() == 0) {
                showEmpty("Your match list is ready for its first signal", creator ? "Complete your niche and bio, then explore campaigns as brands publish briefs." : "Create an active campaign and complete your brand profile to improve creator recommendations.");
                return;
            }
            for (int i = 0; i < matches.length(); i++) {
                JSONObject item = matches.optJSONObject(i);
                if (item == null) continue;
                if (creator) {
                    JSONObject campaign = item.optJSONObject("campaign");
                    if (campaign != null) renderCampaignCard(campaign, true, item);
                } else {
                    JSONObject creatorItem = item.optJSONObject("creator");
                    if (creatorItem == null) creatorItem = item;
                    renderMatchCreatorCard(creatorItem, item);
                }
            }
        });
    }

    private void renderMatchCreatorCard(JSONObject c, JSONObject match) {
        LinearLayout card = card();
        LinearLayout r = row();
        TextView avatar = text(c.optString("name", "C").substring(0, 1).toUpperCase(Locale.ROOT), 18, BG, true);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(rounded(VIOLET, 16, 0));
        r.addView(avatar, new LinearLayout.LayoutParams(dp(46), dp(46)));
        LinearLayout label = column();
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1);
        lp.leftMargin = dp(11);
        label.setLayoutParams(lp);
        label.addView(text(c.optString("name", "Creator"), 16, WHITE, true));
        gap(label, 3);
        label.addView(text(c.optString("niche", "Creator"), 12, MUTED, false));
        r.addView(label);
        TextView score = text(match.optInt("score", 0) + "%", 15, MINT, true);
        r.addView(score);
        card.addView(r);
        gap(card, 12);
        card.addView(text(compact(c.optLong("followers", 0)) + " followers  ·  " + String.format(Locale.US, "%.1f%% engagement", c.optDouble("engagement", 0)), 12, MUTED, false));
        JSONArray reasons = match.optJSONArray("reasons");
        if (reasons != null) {
            for (int i = 0; i < Math.min(3, reasons.length()); i++) {
                gap(card, 5);
                card.addView(text("• " + reasons.optString(i), 11, MUTED, false));
            }
        }
        gap(card, 11);
        TextView invite = smallButton("Invite to campaign");
        card.addView(invite);
        invite.setOnClickListener(v -> showInviteDialog(c));
        content.addView(card);
        gap(content, 12);
    }

    private void renderInbox() {
        heading("Your inbox", "Conversations follow real applications and invitations.");
        TextView loading = text("Loading conversations…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/conversations", null, (data, error) -> {
            if (!"inbox".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Inbox couldn't load", error);
                return;
            }
            JSONArray chats = data.optJSONArray("conversations");
            if (chats == null || chats.length() == 0) {
                showEmpty("Your next conversation starts with a collaboration", "Apply to a campaign or accept an invitation. The resulting conversation will show up here.");
                return;
            }
            for (int i = 0; i < chats.length(); i++) {
                JSONObject chat = chats.optJSONObject(i);
                if (chat == null) continue;
                LinearLayout item = row();
                item.setPadding(dp(14), dp(14), dp(14), dp(14));
                item.setBackground(rounded(PANEL, 18, Color.rgb(43, 52, 79)));
                String counterpart = chat.optString("counterpart_name", "Collaboration");
                TextView avatar = text(counterpart.isEmpty() ? "C" : counterpart.substring(0, 1).toUpperCase(Locale.ROOT), 17, BG, true);
                avatar.setGravity(Gravity.CENTER);
                avatar.setBackground(rounded(MINT, 15, 0));
                item.addView(avatar, new LinearLayout.LayoutParams(dp(45), dp(45)));
                LinearLayout copy = column();
                LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(0, -2, 1);
                cp.leftMargin = dp(12);
                copy.setLayoutParams(cp);
                copy.addView(text(counterpart, 15, WHITE, true));
                gap(copy, 4);
                copy.addView(text(chat.optString("campaign_title", "Collaboration"), 11, MINT, true));
                gap(copy, 4);
                copy.addView(text(chat.optString("last_message", "Open conversation"), 11, MUTED, false));
                item.addView(copy);
                if (chat.optInt("unread", 0) > 0) {
                    TextView unread = text(String.valueOf(chat.optInt("unread")), 11, BG, true);
                    unread.setGravity(Gravity.CENTER);
                    unread.setBackground(rounded(MINT, 30, 0));
                    item.addView(unread, new LinearLayout.LayoutParams(dp(24), dp(24)));
                } else item.addView(text("›", 23, MUTED, false));
                item.setClickable(true);
                item.setOnClickListener(v -> {
                    selectedConversation = chat;
                    selectedConversationId = chat.optLong("id", 0);
                    showShell("conversation");
                });
                content.addView(item);
                gap(content, 10);
            }
        });
    }

    private JSONObject selectedConversation = new JSONObject();
    private long selectedConversationId = 0;
    private EditText messageEntry;
    private LinearLayout messageList;

    private void renderConversation() {
        String other = selectedConversation.optString("counterpart_name", "Conversation");
        LinearLayout titleRow = row();
        TextView back = text("‹", 28, MINT, true);
        back.setPadding(0, 0, dp(12), 0);
        back.setOnClickListener(v -> showShell("inbox"));
        titleRow.addView(back);
        LinearLayout names = column();
        names.addView(text(other, 19, WHITE, true));
        gap(names, 2);
        names.addView(text(selectedConversation.optString("campaign_title", "Collaboration"), 11, MUTED, false));
        titleRow.addView(names);
        content.addView(titleRow);
        gap(content, 15);
        messageList = column();
        content.addView(messageList);
        TextView loading = text("Loading messages…", 12, MUTED, false);
        messageList.addView(loading);
        api("GET", "/api/conversations/" + selectedConversationId + "/messages", null, (data, error) -> {
            if (!"conversation".equals(screen)) return;
            messageList.removeView(loading);
            if (error != null) {
                showInlineMessage("Messages couldn't load", error);
                return;
            }
            JSONArray messages = data.optJSONArray("messages");
            if (messages == null || messages.length() == 0) {
                TextView empty = text("Say hello and keep the collaboration moving.", 12, MUTED, false);
                messageList.addView(empty);
            } else {
                for (int i = 0; i < messages.length(); i++) {
                    JSONObject m = messages.optJSONObject(i);
                    if (m == null) continue;
                    boolean mine = String.valueOf(user.optLong("id", -1)).equals(String.valueOf(m.optLong("sender_id", -2)));
                    LinearLayout bubble = column();
                    bubble.setPadding(dp(13), dp(11), dp(13), dp(11));
                    bubble.setBackground(rounded(mine ? Color.rgb(35, 73, 78) : PANEL, 16, mine ? Color.rgb(51, 111, 108) : Color.rgb(49, 58, 84)));
                    bubble.addView(text(m.optString("body", ""), 14, WHITE, false));
                    LinearLayout.LayoutParams b = new LinearLayout.LayoutParams(Math.min(getResources().getDisplayMetrics().widthPixels - dp(85), dp(300)), -2);
                    b.gravity = mine ? Gravity.RIGHT : Gravity.LEFT;
                    b.bottomMargin = dp(9);
                    messageList.addView(bubble, b);
                }
            }
        });
        gap(content, 15);
        messageEntry = field("Write a message…", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, "");
        messageEntry.setMinLines(1);
        content.addView(messageEntry, new LinearLayout.LayoutParams(-1, -2));
        gap(content, 9);
        TextView send = button("Send message  →", true);
        content.addView(send);
        send.setOnClickListener(v -> {
            String body = messageEntry.getText().toString().trim();
            if (body.isEmpty()) { toast("Write a message first."); return; }
            JSONObject payload = new JSONObject();
            try { payload.put("body", body); } catch (Exception ignored) {}
            send.setEnabled(false);
            api("POST", "/api/conversations/" + selectedConversationId + "/messages", payload, (data, error) -> {
                send.setEnabled(true);
                if (error != null) toast(error);
                else {
                    selectedConversationId = selectedConversationId;
                    showShell("conversation");
                }
            });
        });
    }

    private void renderMore() {
        heading("More tools", "Every part of your creator or brand workspace, in one app.");
        addQuickAction("◉", "Your profile", "Edit your niche, bio and account details", () -> showShell("profile"));
        gap(content, 9);
        addQuickAction("▤", "Applications & activity", "Review applications and collaboration status", () -> showShell("applications"));
        gap(content, 9);
        addQuickAction("♡", "Saved campaigns", "Return to opportunities you bookmarked", () -> showShell("saved"));
        gap(content, 9);
        addQuickAction("✉", "Invitations", "Accept or decline collaboration invitations", () -> showShell("invitations"));
        gap(content, 9);
        addQuickAction("♧", "Notifications", "Review application and message updates", () -> showShell("notifications"));
        gap(content, 9);
        addQuickAction("◎", "Instagram Insights", "Connect your professional account and view metrics", () -> showShell("instagram"));
        if ("creator".equals(user.optString("role", "creator"))) {
            gap(content, 9);
            addQuickAction("↗", "Instagram Auto DM", "Manage keyword reply drafts and activity", () -> showShell("autodm"));
        } else {
            gap(content, 9);
            addQuickAction("♙", "My campaigns", "Manage published briefs and applications", () -> showShell("my_campaigns"));
        }
        gap(content, 9);
        addQuickAction("✧", "AI Studio", "Create pitches, content ideas and campaign briefs", () -> showShell("ai"));
        gap(content, 9);
        addQuickAction("♢", "Plan & billing", "Check beta access and subscription status", () -> showShell("billing"));
        gap(content, 9);
        addQuickAction("?", "Contact support", "Send an account, privacy or technical request", () -> showShell("support"));
    }

    private void renderSavedCampaigns() {
        heading("Saved campaigns", "Keep interesting opportunities close at hand.");
        TextView loading = text("Loading saved opportunities…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/saved-campaigns", null, (data, error) -> {
            if (!"saved".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Saved campaigns couldn't load", error);
                return;
            }
            JSONArray campaigns = data.optJSONArray("campaigns");
            if (campaigns == null || campaigns.length() == 0) {
                showEmpty("No saved campaigns yet", "Open Explore and save a brief you want to revisit.");
                return;
            }
            for (int i = 0; i < campaigns.length(); i++) {
                JSONObject campaign = campaigns.optJSONObject(i);
                if (campaign != null) renderCampaignCard(campaign, false, null);
            }
        });
    }

    private void renderInvitations() {
        heading("Invitations", "Respond to real collaboration invitations.");
        TextView loading = text("Loading invitations…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/invitations", null, (data, error) -> {
            if (!"invitations".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Invitations couldn't load", error);
                return;
            }
            JSONArray invitations = data.optJSONArray("invitations");
            if (invitations == null || invitations.length() == 0) {
                showEmpty("No invitations yet", "When a brand invites you—or you invite a creator—updates will appear here.");
                return;
            }
            boolean creator = "creator".equals(user.optString("role", "creator"));
            for (int i = 0; i < invitations.length(); i++) {
                JSONObject inv = invitations.optJSONObject(i);
                if (inv == null) continue;
                LinearLayout c = card();
                String title = inv.optString("campaign_title", "Collaboration");
                c.addView(text(title, 17, WHITE, true));
                gap(c, 5);
                c.addView(text(creator ? inv.optString("brand_name", "Brand") : inv.optString("creator_name", "Creator"), 12, MUTED, true));
                gap(c, 7);
                if (!inv.optString("message", "").trim().isEmpty()) {
                    c.addView(text(inv.optString("message"), 13, Color.rgb(211, 219, 239), false));
                    gap(c, 10);
                }
                c.addView(text(budget(inv) + "  ·  " + inv.optString("collaboration_type", "Collaboration"), 12, MINT, true));
                gap(c, 10);
                String status = inv.optString("status", "pending");
                TextView state = text(status.toUpperCase(Locale.ROOT), 10, MINT, true);
                state.setPadding(dp(9), dp(6), dp(9), dp(6));
                state.setBackground(rounded(Color.rgb(29, 58, 64), 10, 0));
                c.addView(state, new LinearLayout.LayoutParams(-2, -2));
                if (creator && "pending".equals(status)) {
                    gap(c, 12);
                    LinearLayout actions = row();
                    TextView accept = button("Accept", true);
                    TextView decline = button("Decline", false);
                    actions.addView(accept, new LinearLayout.LayoutParams(0, -2, 1));
                    LinearLayout.LayoutParams d = new LinearLayout.LayoutParams(0, -2, 1);
                    d.leftMargin = dp(8);
                    actions.addView(decline, d);
                    c.addView(actions);
                    accept.setOnClickListener(v -> respondToInvitation(inv, "accepted"));
                    decline.setOnClickListener(v -> respondToInvitation(inv, "declined"));
                } else if (!creator && "pending".equals(status)) {
                    gap(c, 7);
                    c.addView(text("Awaiting creator response", 11, MUTED, false));
                }
                content.addView(c);
                gap(content, 11);
            }
        });
    }

    private void respondToInvitation(JSONObject inv, String response) {
        long id = inv.optLong("id", 0);
        api("PATCH", "/api/invitations/" + id + "/respond", json("status", response), (data, error) -> {
            if (error != null) toast(error);
            else {
                toast(response.equals("accepted") ? "Invitation accepted. Your conversation is ready in Inbox." : "Invitation declined.");
                dashboardLoaded = false;
                showShell("invitations");
            }
        });
    }

    private void renderNotifications() {
        heading("Notifications", "Application, invitation and message updates.");
        TextView loading = text("Loading notifications…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/notifications", null, (data, error) -> {
            if (!"notifications".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Notifications couldn't load", error);
                return;
            }
            JSONArray items = data.optJSONArray("notifications");
            int unread = data.optInt("unread", 0);
            if (unread > 0) {
                TextView mark = button("Mark all as read", false);
                content.addView(mark);
                gap(content, 12);
                mark.setOnClickListener(v -> api("PATCH", "/api/notifications/read-all", json("ok", "true"), (d, e) -> {
                    if (e != null) toast(e);
                    else showShell("notifications");
                }));
            }
            if (items == null || items.length() == 0) {
                showEmpty("You're all caught up", "New collaboration activity will appear here.");
                return;
            }
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                LinearLayout c = card();
                boolean isUnread = item.isNull("read_at") || item.optString("read_at", "").isEmpty();
                LinearLayout top = row();
                TextView dot = text(isUnread ? "●" : "○", 12, isUnread ? MINT : MUTED, true);
                top.addView(dot);
                TextView title = text(item.optString("title", "Collabzy update"), 15, WHITE, true);
                LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0, -2, 1);
                tp.leftMargin = dp(8);
                top.addView(title, tp);
                c.addView(top);
                gap(c, 7);
                c.addView(text(item.optString("body", ""), 12, MUTED, false));
                content.addView(c);
                gap(content, 9);
            }
        });
    }

    private void renderMyCampaigns() {
        heading("My campaigns", "Manage live briefs and review application counts.");
        TextView create = button("+  Create campaign", true);
        content.addView(create);
        create.setOnClickListener(v -> showShell("create_campaign"));
        gap(content, 16);
        TextView loading = text("Loading your campaigns…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/my-campaigns", null, (data, error) -> {
            if (!"my_campaigns".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Campaign manager couldn't load", error);
                return;
            }
            JSONArray campaigns = data.optJSONArray("campaigns");
            if (campaigns == null || campaigns.length() == 0) {
                showEmpty("Your first campaign starts here", "Publish a clear brief and creators can discover it in Explore.");
                return;
            }
            for (int i = 0; i < campaigns.length(); i++) {
                JSONObject campaign = campaigns.optJSONObject(i);
                if (campaign == null) continue;
                LinearLayout c = card();
                c.addView(text(campaign.optString("title", "Campaign"), 17, WHITE, true));
                gap(c, 7);
                c.addView(text(budget(campaign) + "  ·  " + campaign.optString("collaboration_type", "Collaboration"), 12, MINT, true));
                gap(c, 6);
                c.addView(text(campaign.optInt("application_count", 0) + " applications  ·  " + campaign.optString("status", "active"), 12, MUTED, false));
                gap(c, 12);
                boolean active = "active".equals(campaign.optString("status"));
                TextView toggle = button(active ? "Close campaign" : "Reopen campaign", false);
                c.addView(toggle);
                toggle.setOnClickListener(v -> {
                    toggle.setEnabled(false);
                    api("PATCH", "/api/campaigns/" + campaign.optLong("id") + "/manage", json("status", active ? "closed" : "active"), (d, e) -> {
                        if (e != null) { toggle.setEnabled(true); toast(e); }
                        else { toast(active ? "Campaign closed." : "Campaign reopened."); showShell("my_campaigns"); }
                    });
                });
                content.addView(c);
                gap(content, 11);
            }
        });
    }

    private void renderInstagram() {
        heading("Instagram Studio", "Official Meta connection, insights and recent media.");
        LinearLayout panel = card();
        TextView loading = text("Checking Instagram connection…", 13, MUTED, false);
        panel.addView(loading);
        content.addView(panel);
        api("GET", "/api/instagram/status", null, (data, error) -> {
            if (!"instagram".equals(screen)) return;
            panel.removeView(loading);
            if (error != null) {
                panel.addView(text("Instagram status unavailable", 15, RED, true));
                gap(panel, 6);
                panel.addView(text(error, 12, MUTED, false));
                return;
            }
            boolean connected = data.optBoolean("connected");
            panel.addView(text(connected ? "Instagram connected" : "Instagram not connected", 18, WHITE, true));
            gap(panel, 6);
            panel.addView(text(connected ? "@" + data.optString("handle", "") : data.optString("message", "Connect an eligible professional account to continue."), 12, MUTED, false));
            gap(panel, 12);
            if (!connected) {
                TextView connect = button("Connect Instagram securely", true);
                panel.addView(connect);
                connect.setOnClickListener(v -> connectInstagram());
            } else {
                TextView insights = button("Refresh insights", true);
                panel.addView(insights);
                gap(panel, 8);
                TextView media = button("Recent Instagram posts", false);
                panel.addView(media);
                gap(panel, 8);
                TextView disconnect = button("Disconnect Instagram", false);
                panel.addView(disconnect);
                insights.setOnClickListener(v -> loadInstagramInsights());
                media.setOnClickListener(v -> loadInstagramMedia());
                disconnect.setOnClickListener(v -> new android.app.AlertDialog.Builder(this)
                    .setTitle("Disconnect Instagram?")
                    .setMessage("Collabzy will remove the stored access token and synced profile metrics.")
                    .setNegativeButton("Cancel", (d, w) -> d.dismiss())
                    .setPositiveButton("Disconnect", (d, w) -> api("POST", "/api/instagram/disconnect", json("confirm", "true"), (res, problem) -> {
                        if (problem != null) toast(problem);
                        else { user = json("instagram_handle", ""); dashboardLoaded = false; toast("Instagram disconnected."); showShell("instagram"); }
                    })).show());
            }
        });
        gap(content, 12);
        LinearLayout note = card();
        note.addView(text("Connection requirements", 15, WHITE, true));
        gap(note, 6);
        note.addView(text("Live metrics require the operator's Meta app credentials, matching OAuth redirect URI, approved permissions, and an eligible Instagram professional account. If these are not configured, the app will show the setup state rather than fake metrics.", 12, MUTED, false));
        content.addView(note);
    }

    private void connectInstagram() {
        api("GET", "/api/instagram/connect?platform=native", null, (data, error) -> {
            if (error != null) { toast(error); return; }
            String url = data.optString("authorization_url", "");
            if (url.isEmpty()) { toast("The server did not return an Instagram authorization URL."); return; }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ex) {
                toast("Unable to open the secure Instagram authorization page on this device.");
            }
        });
    }

    private void loadInstagramInsights() {
        toast("Refreshing official Instagram metrics…");
        api("GET", "/api/instagram/insights", null, (data, error) -> {
            if (error != null) { toast(error); return; }
            JSONArray items = data.optJSONArray("insights");
            StringBuilder out = new StringBuilder();
            out.append("Account: @").append(data.optString("handle", "")).append("\n\n");
            if (items == null || items.length() == 0) {
                out.append("Instagram returned no insight rows for the available permission set.");
            } else {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject m = items.optJSONObject(i);
                    if (m == null) continue;
                    out.append(m.optString("title", m.optString("name", "Metric"))).append("\n");
                    out.append(m.optString("description", "")).append("\n");
                    JSONArray values = m.optJSONArray("values");
                    if (values != null && values.length() > 0) {
                        JSONObject v = values.optJSONObject(values.length() - 1);
                        if (v != null) out.append("Latest value: ").append(v.opt("value")).append("\n");
                    }
                    out.append("\n");
                }
            }
            showTextDialog("Instagram Insights", out.toString());
        });
    }

    private void loadInstagramMedia() {
        api("GET", "/api/instagram/media", null, (data, error) -> {
            if (error != null) { toast(error); return; }
            JSONArray media = data.optJSONArray("media");
            StringBuilder out = new StringBuilder("Recent posts from @").append(data.optString("handle", "")).append("\n\n");
            if (media == null || media.length() == 0) out.append("No media was returned for this account.");
            else for (int i = 0; i < media.length(); i++) {
                JSONObject m = media.optJSONObject(i);
                if (m == null) continue;
                out.append(i + 1).append(". ").append(m.optString("media_type", "POST")).append("\n");
                out.append(m.optString("caption", "(No caption)")).append("\n");
                out.append("Likes: ").append(m.optInt("like_count", 0)).append("  ·  Comments: ").append(m.optInt("comments_count", 0)).append("\n");
                out.append(m.optString("permalink", "")).append("\n\n");
            }
            showTextDialog("Recent Instagram posts", out.toString());
        });
    }

    private void renderAutoDM() {
        heading("Instagram Auto DM", "Manage comment-triggered reply rules. Live sending stays protected by Meta setup.");
        LinearLayout info = card();
        info.addView(text("Private-reply automation", 16, WHITE, true));
        gap(info, 6);
        info.addView(text("Rules can be saved as drafts. Enabling actual replies requires an authorized Instagram account, Meta messaging/comment permissions, webhook verification and the server-side operator enable switch.", 12, MUTED, false));
        content.addView(info);
        gap(content, 12);
        TextView add = button("+  Add keyword rule", true);
        content.addView(add);
        add.setOnClickListener(v -> showAutomationDialog());
        gap(content, 8);
        TextView setup = button("Configure comment webhook", false);
        content.addView(setup);
        setup.setOnClickListener(v -> api("POST", "/api/instagram/automations/setup", json("confirm", "true"), (data, error) -> {
            if (error != null) toast(error);
            else { toast(data.optString("message", "Webhook setup completed.")); showShell("autodm"); }
        }));
        gap(content, 17);
        content.addView(text("YOUR RULES", 11, MUTED, true));
        gap(content, 8);
        TextView loading = text("Loading reply rules…", 13, MUTED, false);
        content.addView(loading);
        api("GET", "/api/instagram/automations", null, (data, error) -> {
            if (!"autodm".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Auto DM rules couldn't load", error);
                return;
            }
            boolean configured = data.optBoolean("configured");
            boolean connected = data.optBoolean("connected");
            LinearLayout status = card();
            status.addView(text(configured && connected ? "Meta integration configured" : "Draft mode only", 14, configured && connected ? MINT : VIOLET, true));
            gap(status, 4);
            status.addView(text(data.optString("message", ""), 11, MUTED, false));
            content.addView(status);
            gap(content, 10);
            JSONArray rules = data.optJSONArray("rules");
            if (rules == null || rules.length() == 0) {
                showEmpty("No keyword rules yet", "Add a keyword and draft a reply. It will not send until the server and Meta permissions allow it.");
                return;
            }
            for (int i = 0; i < rules.length(); i++) {
                JSONObject rule = rules.optJSONObject(i);
                if (rule == null) continue;
                LinearLayout c = card();
                c.addView(text(rule.optString("keyword", "Keyword"), 16, WHITE, true));
                gap(c, 5);
                c.addView(text(rule.optString("reply_text", ""), 12, MUTED, false));
                if (!rule.optString("cta_url", "").isEmpty()) {
                    gap(c, 5);
                    c.addView(text(rule.optString("cta_url"), 11, MINT, false));
                }
                gap(c, 9);
                c.addView(text(rule.optBoolean("enabled") ? "Enabled on server" : "Paused / draft", 11, rule.optBoolean("enabled") ? MINT : VIOLET, true));
                gap(c, 10);
                LinearLayout actions = row();
                TextView toggle = button(rule.optBoolean("enabled") ? "Pause" : "Enable", false);
                TextView remove = button("Delete", false);
                actions.addView(toggle, new LinearLayout.LayoutParams(0, -2, 1));
                LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(0, -2, 1);
                rp.leftMargin = dp(8);
                actions.addView(remove, rp);
                c.addView(actions);
                toggle.setOnClickListener(v -> api("PATCH", "/api/instagram/automations/" + rule.optLong("id"), jsonBoolean("enabled", !rule.optBoolean("enabled")), (d, e) -> {
                    if (e != null) toast(e); else { toast(d.optString("message", "Rule updated.")); showShell("autodm"); }
                }));
                remove.setOnClickListener(v -> new android.app.AlertDialog.Builder(this)
                    .setTitle("Delete keyword rule?")
                    .setMessage("This rule will be removed from your account.")
                    .setNegativeButton("Cancel", (d, w) -> d.dismiss())
                    .setPositiveButton("Delete", (d, w) -> api("DELETE", "/api/instagram/automations/" + rule.optLong("id"), null, (res, problem) -> {
                        if (problem != null) toast(problem); else { toast("Rule deleted."); showShell("autodm"); }
                    })).show());
                content.addView(c);
                gap(content, 10);
            }
            TextView events = button("View Auto DM activity", false);
            content.addView(events);
            events.setOnClickListener(v -> loadAutomationEvents());
        });
    }

    private void showAutomationDialog() {
        android.app.Dialog dialog = new android.app.Dialog(this);
        LinearLayout box = column();
        box.setPadding(dp(20), dp(20), dp(20), dp(20));
        box.setBackground(rounded(PANEL, 22, Color.rgb(57, 70, 99)));
        box.addView(text("New keyword rule", 21, WHITE, true));
        gap(box, 12);
        EditText keyword = field("Keyword (minimum 2 characters)", InputType.TYPE_CLASS_TEXT, "");
        EditText reply = field("Private reply text", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, "");
        reply.setSingleLine(false); reply.setMinLines(3);
        EditText link = field("Optional HTTPS link", InputType.TYPE_TEXT_VARIATION_URI, "");
        box.addView(keyword); gap(box, 9); box.addView(reply); gap(box, 9); box.addView(link); gap(box, 12);
        TextView save = button("Save draft rule", true);
        TextView cancel = button("Cancel", false);
        box.addView(save); gap(box, 8); box.addView(cancel);
        cancel.setOnClickListener(v -> dialog.dismiss());
        save.setOnClickListener(v -> {
            if (keyword.getText().toString().trim().length() < 2 || reply.getText().toString().trim().length() < 2) {
                toast("Enter a keyword and a reply before saving.");
                return;
            }
            JSONObject payload = new JSONObject();
            try {
                payload.put("keyword", keyword.getText().toString().trim());
                payload.put("match_type", "contains");
                payload.put("reply_text", reply.getText().toString().trim());
                payload.put("cta_url", link.getText().toString().trim());
                payload.put("enabled", false);
            } catch (Exception ignored) {}
            save.setEnabled(false);
            api("POST", "/api/instagram/automations", payload, (data, error) -> {
                save.setEnabled(true);
                if (error != null) toast(error);
                else { dialog.dismiss(); toast(data.optString("message", "Draft saved.")); showShell("autodm"); }
            });
        });
        dialog.setContentView(box);
        dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            dialog.getWindow().setLayout(getResources().getDisplayMetrics().widthPixels - dp(32), -2);
        }
    }

    private void loadAutomationEvents() {
        api("GET", "/api/instagram/automations/events", null, (data, error) -> {
            if (error != null) { toast(error); return; }
            JSONArray events = data.optJSONArray("events");
            StringBuilder out = new StringBuilder("Recent comment-reply activity\n\n");
            if (events == null || events.length() == 0) out.append("No delivery events recorded.");
            else for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.optJSONObject(i);
                if (e == null) continue;
                out.append("• ").append(e.optString("keyword", "Rule")).append(": ")
                   .append(e.optString("status", "received"));
                if (e.optInt("response_code") > 0) out.append(" (HTTP ").append(e.optInt("response_code")).append(")");
                out.append("\n").append(e.optString("message", "")).append("\n\n");
            }
            showTextDialog("Auto DM activity", out.toString());
        });
    }

    private void renderBilling() {
        heading("Plan & billing", "Your subscription status is checked on the server.");
        LinearLayout panel = card();
        TextView loading = text("Checking plan status…", 13, MUTED, false);
        panel.addView(loading);
        content.addView(panel);
        api("GET", "/api/billing/status", null, (data, error) -> {
            if (!"billing".equals(screen)) return;
            panel.removeView(loading);
            if (error != null) {
                showInlineMessage("Plan status unavailable", error);
                return;
            }
            panel.addView(text("Collabzy Pro", 22, WHITE, true));
            gap(panel, 5);
            panel.addView(text("₹" + data.optInt("amount", 299) + " / year", 15, MINT, true));
            gap(panel, 11);
            String status = data.optBoolean("active") ? "Active subscription" : data.optBoolean("beta_access") ? "Private beta access" : "No active subscription";
            panel.addView(text(status, 14, data.optBoolean("active") || data.optBoolean("beta_access") ? MINT : VIOLET, true));
            gap(panel, 7);
            panel.addView(text("Checkout: " + (data.optBoolean("checkout_ready") ? "configured" : "not configured"), 12, MUTED, false));
            if (!data.optString("expires_at", "").isEmpty()) {
                gap(panel, 5);
                panel.addView(text("Expires: " + data.optString("expires_at"), 11, MUTED, false));
            }
        });
        gap(content, 12);
        LinearLayout note = card();
        note.addView(text("Safe beta billing", 15, WHITE, true));
        gap(note, 6);
        note.addView(text("Payment collection is not enabled unless the owner configures Razorpay keys and webhook verification. This screen never marks a payment successful or creates a paid plan on its own.", 12, MUTED, false));
        content.addView(note);
    }

    private void renderSupport() {
        heading("Contact support", "Send a clear account, privacy or technical request.");
        LinearLayout panel = card();
        EditText name = field("Your name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, user.optString("name", ""));
        EditText email = field("Email address", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, user.optString("email", ""));
        EditText subject = field("Subject", InputType.TYPE_CLASS_TEXT, "");
        EditText message = field("Describe the issue (at least 20 characters)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, "");
        message.setSingleLine(false); message.setMinLines(5); message.setGravity(Gravity.TOP | Gravity.START);
        addField(panel, "NAME", name); addField(panel, "EMAIL", email); addField(panel, "SUBJECT", subject); addField(panel, "MESSAGE", message);
        TextView submit = button("Send support request", true);
        panel.addView(submit);
        content.addView(panel);
        submit.setOnClickListener(v -> {
            if (subject.getText().toString().trim().length() < 4 || message.getText().toString().trim().length() < 20) {
                toast("Add a subject and a message of at least 20 characters.");
                return;
            }
            JSONObject payload = new JSONObject();
            try {
                payload.put("name", name.getText().toString().trim());
                payload.put("email", email.getText().toString().trim());
                payload.put("subject", subject.getText().toString().trim());
                payload.put("message", message.getText().toString().trim());
                payload.put("category", "general");
            } catch (Exception ignored) {}
            submit.setEnabled(false);
            api("POST", "/api/support", payload, (data, error) -> {
                submit.setEnabled(true);
                if (error != null) toast(error);
                else { toast(data.optString("message", "Support request received.")); showShell("more"); }
            });
        });
    }

    private void showTextDialog(String title, String value) {
        android.app.Dialog dialog = new android.app.Dialog(this);
        LinearLayout box = column();
        box.setPadding(dp(20), dp(20), dp(20), dp(20));
        box.setBackground(rounded(PANEL, 22, Color.rgb(57, 70, 99)));
        box.addView(text(title, 20, WHITE, true));
        gap(box, 12);
        ScrollView scroll = new ScrollView(this);
        TextView body = text(value, 13, Color.rgb(218, 226, 244), false);
        body.setTextIsSelectable(true);
        body.setLineSpacing(dp(4), 1f);
        scroll.addView(body);
        box.addView(scroll, new LinearLayout.LayoutParams(-1, dp(310)));
        gap(box, 12);
        TextView close = button("Done", true);
        box.addView(close);
        close.setOnClickListener(v -> dialog.dismiss());
        dialog.setContentView(box);
        dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            dialog.getWindow().setLayout(getResources().getDisplayMetrics().widthPixels - dp(32), -2);
        }
    }

    private void renderApplications() {
        heading("Applications & activity", "See where your collaborations stand.");
        String path = "/api/applications";
        TextView loading = text("Loading your activity…", 13, MUTED, false);
        content.addView(loading);
        api("GET", path, null, (data, error) -> {
            if (!"applications".equals(screen)) return;
            content.removeView(loading);
            if (error != null) {
                showInlineMessage("Applications couldn't load", error);
                return;
            }
            JSONArray apps = data.optJSONArray("applications");
            if (apps == null || apps.length() == 0) {
                showEmpty("No applications yet", "When you apply to a brief—or a brand receives your application—it will appear here.");
                return;
            }
            for (int i = 0; i < apps.length(); i++) {
                JSONObject a = apps.optJSONObject(i);
                if (a == null) continue;
                LinearLayout c = card();
                c.addView(text(a.optString("campaign_title", "Campaign"), 16, WHITE, true));
                gap(c, 5);
                c.addView(text(a.optString("brand_name", a.optString("creator_name", "Collaboration")), 12, MUTED, false));
                gap(c, 12);
                String status = a.optString("status", "pending").toUpperCase(Locale.ROOT);
                TextView badge = text(status, 10, MINT, true);
                badge.setPadding(dp(10), dp(7), dp(10), dp(7));
                badge.setBackground(rounded(Color.rgb(30, 56, 64), 11, 0));
                c.addView(badge, new LinearLayout.LayoutParams(-2, -2));
                if ("brand".equals(user.optString("role")) && "pending".equals(a.optString("status"))) {
                    gap(c, 12);
                    TextView accept = smallButton("Accept application");
                    accept.setOnClickListener(v -> api("PATCH", "/api/applications/" + a.optLong("id") + "/status", json("status", "accepted"), (d, e) -> {
                        if (e != null) toast(e); else { toast("Application accepted."); showShell("applications"); }
                    }));
                    c.addView(accept);
                }
                content.addView(c);
                gap(content, 10);
            }
        });
    }

    private void renderProfile() {
        heading("Your profile", "Keep your details sharp so the right collaborations find you.");
        LinearLayout panel = card();
        EditText name = field("Full name", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, user.optString("name", ""));
        EditText niche = field("Niche / industry", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, user.optString("niche", ""));
        EditText location = field("City or region", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, user.optString("location", ""));
        EditText handle = field("Instagram handle", InputType.TYPE_CLASS_TEXT, user.optString("instagram_handle", ""));
        EditText bio = field("Short bio (optional)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, user.optString("bio", ""));
        bio.setSingleLine(false);
        bio.setMinLines(3);
        bio.setGravity(Gravity.TOP | Gravity.START);
        addField(panel, "YOUR NAME", name);
        addField(panel, "NICHE", niche);
        addField(panel, "LOCATION", location);
        addField(panel, "INSTAGRAM HANDLE", handle);
        addField(panel, "BIO", bio);
        TextView save = button("Save profile changes", true);
        panel.addView(save);
        save.setOnClickListener(v -> {
            JSONObject payload = new JSONObject();
            try {
                payload.put("name", name.getText().toString().trim());
                payload.put("niche", niche.getText().toString().trim());
                payload.put("location", location.getText().toString().trim());
                payload.put("instagram_handle", handle.getText().toString().trim());
                payload.put("bio", bio.getText().toString().trim());
            } catch (Exception ignored) {}
            save.setEnabled(false);
            save.setText("Saving…");
            api("PATCH", "/api/me", payload, (data, error) -> {
                save.setEnabled(true);
                save.setText("Save profile changes");
                if (error != null) toast(error);
                else {
                    JSONObject changed = data.optJSONObject("user");
                    if (changed != null) user = changed;
                    toast("Profile saved.");
                    showShell("profile");
                }
            });
        });
        content.addView(panel);
        gap(content, 16);
        addQuickAction("✧", "AI Studio", "Create content, pitches and campaign briefs", () -> showShell("ai"));
        gap(content, 10);
        addQuickAction("▤", "My applications", "Review application statuses", () -> showShell("applications"));
        gap(content, 20);
        TextView signOut = button("Sign out", false);
        content.addView(signOut);
        signOut.setOnClickListener(v -> new android.app.AlertDialog.Builder(this)
            .setTitle("Sign out of Collabzy?")
            .setMessage("Your account remains safe on the server. This device will forget the saved session.")
            .setNegativeButton("Stay signed in", (d, w) -> d.dismiss())
            .setPositiveButton("Sign out", (d, w) -> {
                token = "";
                user = new JSONObject();
                storage.edit().remove("token").apply();
                showWelcome();
            }).show());
    }

    private void renderAI() {
        boolean creator = "creator".equals(user.optString("role", "creator"));
        heading("AI Studio", "A native workspace for your next draft. Review outputs before publishing.");
        LinearLayout panel = card();
        panel.addView(text("CHOOSE A TOOL", 11, MUTED, true));
        gap(panel, 8);
        String[] labels = creator
            ? new String[]{"Creator bio optimizer", "Reel hooks", "Caption & hashtags", "7-day content calendar", "Brand pitch"}
            : new String[]{"Campaign brief builder", "Creator outreach", "UGC video script", "Campaign launch plan"};
        String[] keys = creator
            ? new String[]{"creator_bio", "reel_hooks", "caption_hashtags", "content_calendar", "brand_pitch"}
            : new String[]{"brand_campaign_brief", "brand_outreach", "ugc_script", "brand_campaign_plan"};
        if (aiTool.isEmpty()) aiTool = keys[0];
        for (int i = 0; i < labels.length; i++) {
            final String key = keys[i];
            TextView choice = smallButton((key.equals(aiTool) ? "✓  " : "") + labels[i]);
            choice.setGravity(Gravity.LEFT | Gravity.CENTER_VERTICAL);
            choice.setOnClickListener(v -> { aiTool = key; showShell("ai"); });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
            p.bottomMargin = dp(7);
            panel.addView(choice, p);
        }
        content.addView(panel);
        gap(content, 14);
        LinearLayout briefCard = card();
        briefCard.addView(text("GIVE IT CONTEXT", 11, MUTED, true));
        gap(briefCard, 8);
        EditText brief = field("What are you creating? Add the brand, topic, audience or goal.", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, "");
        brief.setSingleLine(false);
        brief.setMinLines(4);
        brief.setGravity(Gravity.TOP | Gravity.START);
        briefCard.addView(brief);
        gap(briefCard, 12);
        EditText audience = field("Audience (optional)", InputType.TYPE_CLASS_TEXT, "");
        briefCard.addView(audience);
        gap(briefCard, 10);
        CheckBox consent = new CheckBox(this);
        consent.setText("I understand this context will be sent to the AI service to generate a draft.");
        consent.setTextColor(MUTED);
        consent.setTextSize(12);
        consent.setButtonTintList(new android.content.res.ColorStateList(
            new int[][]{new int[]{android.R.attr.state_checked}, new int[]{}},
            new int[]{MINT, MUTED}));
        briefCard.addView(consent);
        gap(briefCard, 12);
        TextView run = button("Generate draft  ✦", true);
        briefCard.addView(run);
        content.addView(briefCard);
        run.setOnClickListener(v -> {
            if (brief.getText().toString().trim().length() < 4) { toast("Add a little context first."); return; }
            if (!consent.isChecked()) { toast("Please confirm the AI data-use note."); return; }
            JSONObject payload = json("tool", aiTool);
            try {
                payload.put("brief", brief.getText().toString().trim());
                payload.put("audience", audience.getText().toString().trim());
                payload.put("confirmed_ai_disclosure", true);
            } catch (Exception ignored) {}
            run.setEnabled(false);
            run.setText("Creating your draft…");
            api("POST", "/api/ai/studio", payload, (data, error) -> {
                run.setEnabled(true);
                run.setText("Generate draft  ✦");
                if (error != null) {
                    toast(error);
                    return;
                }
                String output = data.optString("output", data.optString("content", data.optString("draft", "")));
                if (output.isEmpty()) output = data.toString();
                showAIResult(output, data.optString("mode", ""));
            });
        });
    }

    private void showAIResult(String output, String mode) {
        android.app.Dialog dialog = new android.app.Dialog(this);
        LinearLayout box = column();
        box.setPadding(dp(22), dp(22), dp(22), dp(22));
        box.setBackground(rounded(PANEL, 24, Color.rgb(57, 70, 99)));
        box.addView(text("Your draft is ready", 22, WHITE, true));
        gap(box, 5);
        box.addView(text(mode.isEmpty() ? "Review and refine before publishing." : mode, 11, MINT, true));
        gap(box, 12);
        ScrollView scroll = new ScrollView(this);
        TextView result = text(output, 14, Color.rgb(223, 229, 245), false);
        result.setTextIsSelectable(true);
        result.setLineSpacing(dp(4), 1f);
        scroll.addView(result);
        box.addView(scroll, new LinearLayout.LayoutParams(-1, dp(270)));
        gap(box, 14);
        TextView close = button("Done", true);
        box.addView(close);
        close.setOnClickListener(v -> dialog.dismiss());
        dialog.setContentView(box);
        dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            dialog.getWindow().setLayout(getResources().getDisplayMetrics().widthPixels - dp(32), -2);
        }
    }

    private void renderCreateCampaign() {
        heading("Create a campaign", "Share a clear brief so creators know what you need.");
        LinearLayout panel = card();
        EditText title = field("Campaign title", InputType.TYPE_CLASS_TEXT, "");
        EditText description = field("What is the collaboration about?", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE, "");
        description.setSingleLine(false);
        description.setMinLines(4);
        description.setGravity(Gravity.TOP | Gravity.START);
        EditText category = field("Category (e.g. Beauty, Tech, Food)", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS, "");
        EditText low = field("Minimum budget in ₹", InputType.TYPE_CLASS_NUMBER, "");
        EditText high = field("Maximum budget in ₹", InputType.TYPE_CLASS_NUMBER, "");
        addField(panel, "CAMPAIGN TITLE", title);
        addField(panel, "BRIEF", description);
        addField(panel, "CATEGORY", category);
        addField(panel, "MINIMUM BUDGET", low);
        addField(panel, "MAXIMUM BUDGET", high);
        String[] selectedType = new String[]{"Paid"};
        panel.addView(text("COLLABORATION TYPE", 11, MUTED, true));
        gap(panel, 7);
        LinearLayout typeRow = row();
        String[] types = new String[]{"Paid", "Barter", "Hybrid"};
        for (String type : types) {
            TextView b = button(type, type.equals(selectedType[0]));
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
            p.rightMargin = dp(5);
            typeRow.addView(b, p);
            b.setOnClickListener(v -> {
                selectedType[0] = type;
                for (int j = 0; j < typeRow.getChildCount(); j++) {
                    TextView child = (TextView) typeRow.getChildAt(j);
                    boolean chosen = child.getText().toString().equals(type);
                    child.setBackground(rounded(chosen ? MINT : PANEL_ALT, 15, chosen ? 0 : Color.rgb(54, 63, 91)));
                    child.setTextColor(chosen ? BG : WHITE);
                }
            });
        }
        panel.addView(typeRow);
        gap(panel, 14);
        TextView post = button("Publish campaign  →", true);
        panel.addView(post);
        content.addView(panel);
        post.setOnClickListener(v -> {
            if (title.getText().toString().trim().isEmpty() || description.getText().toString().trim().isEmpty() || category.getText().toString().trim().isEmpty()) {
                toast("Add a title, brief and category first.");
                return;
            }
            JSONObject payload = new JSONObject();
            try {
                payload.put("title", title.getText().toString().trim());
                payload.put("description", description.getText().toString().trim());
                payload.put("category", category.getText().toString().trim());
                payload.put("collaboration_type", selectedType[0]);
                payload.put("budget_min", low.getText().toString().trim().isEmpty() ? 0 : Long.parseLong(low.getText().toString().trim()));
                payload.put("budget_max", high.getText().toString().trim().isEmpty() ? 0 : Long.parseLong(high.getText().toString().trim()));
                payload.put("location", user.optString("location", "India"));
            } catch (Exception ignored) {}
            post.setEnabled(false);
            post.setText("Publishing…");
            api("POST", "/api/campaigns", payload, (data, error) -> {
                post.setEnabled(true);
                post.setText("Publish campaign  →");
                if (error != null) toast(error);
                else {
                    toast("Campaign published.");
                    showShell("explore");
                }
            });
        });
    }

    private void showEmpty(String title, String body) {
        LinearLayout c = card();
        c.setGravity(Gravity.CENTER);
        c.setPadding(dp(24), dp(27), dp(24), dp(27));
        TextView glyph = text("✦", 30, MINT, true);
        glyph.setGravity(Gravity.CENTER);
        c.addView(glyph);
        gap(c, 9);
        TextView h = text(title, 17, WHITE, true);
        h.setGravity(Gravity.CENTER);
        c.addView(h);
        gap(c, 7);
        TextView b = text(body, 12, MUTED, false);
        b.setGravity(Gravity.CENTER);
        b.setLineSpacing(dp(3), 1f);
        c.addView(b);
        content.addView(c);
    }

    private void showInlineMessage(String title, String message) {
        LinearLayout c = card();
        c.setBackground(rounded(Color.rgb(54, 33, 51), 18, Color.rgb(105, 54, 79)));
        c.addView(text(title, 15, RED, true));
        gap(c, 6);
        c.addView(text(message, 12, Color.rgb(232, 195, 209), false));
        content.addView(c);
    }

    private JSONObject json(String key, String value) {
        JSONObject o = new JSONObject();
        try { o.put(key, value); } catch (Exception ignored) {}
        return o;
    }

    private JSONObject jsonBoolean(String key, boolean value) {
        JSONObject o = new JSONObject();
        try { o.put(key, value); } catch (Exception ignored) {}
        return o;
    }

    private void api(String method, String path, JSONObject payload, ApiCallback callback) {
        network.execute(() -> {
            JSONObject result = null;
            String error = null;
            try {
                Request.Builder builder = new Request.Builder().url(API + path).header("Accept", "application/json");
                if (!token.isEmpty()) builder.header("Authorization", "Bearer " + token);
                RequestBody body = payload == null ? null : RequestBody.create(payload.toString(), JSON_MEDIA);
                builder.method(method, body);
                try (Response response = httpClient.newCall(builder.build()).execute()) {
                    String responseText = response.body() == null ? "" : response.body().string();
                    if (!responseText.isEmpty()) {
                        try { result = new JSONObject(responseText); }
                        catch (Exception notJson) { result = new JSONObject().put("message", responseText); }
                    }
                    if (!response.isSuccessful()) {
                        error = result != null ? result.optString("error", result.optString("message", "Request failed (" + response.code() + ").")) : "Request failed (" + response.code() + ").";
                    } else if (result == null) result = new JSONObject();
                }
            } catch (Exception ex) {
                error = "Could not reach Collabzy. Check your internet connection and try again.";
            }
            final JSONObject data = result;
            final String problem = error;
            runOnUiThread(() -> { if (!isFinishing()) callback.complete(data, problem); });
        });
    }

    private void toast(String value) {
        Toast.makeText(this, value, Toast.LENGTH_LONG).show();
    }

    private void fadeIn(View v) {
        if (v == null) return;
        v.setAlpha(0f);
        v.setTranslationY(dp(8));
        v.animate().alpha(1f).translationY(0f).setDuration(220).start();
    }

    @Override
    public void onBackPressed() {
        if ("welcome".equals(screen)) {
            super.onBackPressed();
        } else if ("login".equals(screen) || "register".equals(screen)) {
            showWelcome();
        } else if ("conversation".equals(screen)) {
            showShell("inbox");
        } else if ("create_campaign".equals(screen)) {
            showShell("explore");
        } else {
            showShell("home");
        }
    }
}
