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
            for (int i = 0; i < group.getChildCount(); i++) text.append(collectText(group.getChildAt(i)));
        }
        return text.toString();
    }

    @Test
    public void freshInstallShowsWelcomeActionsAndAnnualPlan() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View root = activity.findViewById(android.R.id.content);
                assertNotNull("Activity content root must exist", root);
                String visible = collectText(root);
                assertTrue("New user headline must render: " + visible, visible.contains("Your next brand deal starts here."));
                assertTrue("Join beta action must render: " + visible, visible.contains("Join private beta"));
                assertTrue("Existing-account action must render: " + visible, visible.contains("I already have an account"));
                assertTrue("Annual plan must render: " + visible, visible.contains("₹299 / year"));
            });
        }
    }
}
