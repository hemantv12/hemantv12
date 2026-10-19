package com.collabzy.creator;

import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Test;
import org.junit.runner.RunWith;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
public final class StartupScreenTest {
    private static String collectText(View view) {
        StringBuilder text = new StringBuilder();
        if (view instanceof TextView) {
            CharSequence value = ((TextView) view).getText();
            if (value != null) text.append(value).append('\n');
        }
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                text.append(collectText(group.getChildAt(i)));
            }
        }
        return text.toString();
    }

    @Test
    public void launcherShowsWelcomeAndAnnualPlanInsteadOfBlankScreen() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View root = activity.findViewById(android.R.id.content);
                assertNotNull("Activity content root must exist", root);
                String visibleText = collectText(root);
                assertTrue("Welcome headline must be rendered; screen text was: " + visibleText,
                    visibleText.contains("Turn your content"));
                assertTrue("Create-account CTA must be visible",
                    visibleText.contains("Create your account"));
                assertTrue("Annual Pro plan price must be visible",
                    visibleText.contains("₹299 / year"));
            });
        }
    }
}
