package com.collabzy.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.TimeUnit

private val Ink = Color(0xFF100E1B)
private val Panel = Color(0xFF1B192B)
private val Panel2 = Color(0xFF242137)
private val Violet = Color(0xFFB4A1FF)
private val VioletStrong = Color(0xFF8E73FF)
private val Mint = Color(0xFFB4F4D0)
private val White = Color(0xFFF8F6FF)
private val Muted = Color(0xFFA8A4BE)
private val Border = Color(0xFF343149)
private val Danger = Color(0xFFFFA6B9)

class MainActivity : ComponentActivity() {
    var oauthResult by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleOAuthIntent(intent)
        setContent {
            CollabzyTheme {
                CollabzyNativeApp(this, oauthResult) { oauthResult = null }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOAuthIntent(intent)
    }

    private fun handleOAuthIntent(intent: Intent?) {
        val uri: Uri = intent?.data ?: return
        if (uri.scheme == "collabzy" && uri.host == "instagram") {
            oauthResult = uri.getQueryParameter("instagram") ?: "error"
        }
    }
}

@Composable
private fun CollabzyTheme(content: @Composable () -> Unit) {
    val scheme = darkColorScheme(
        primary = Violet,
        onPrimary = Ink,
        secondary = Mint,
        background = Ink,
        onBackground = White,
        surface = Panel,
        onSurface = White,
        surfaceVariant = Panel2,
        onSurfaceVariant = Muted,
        outline = Border,
        error = Danger
    )
    MaterialTheme(colorScheme = scheme, typography = Typography(), content = content)
}

private object Api {
    const val BASE = "https://collabzy-api.onrender.com/api"
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .callTimeout(35, TimeUnit.SECONDS)
        .build()
    @Volatile var token: String = ""

    suspend fun call(
        path: String,
        method: String = "GET",
        body: JSONObject? = null,
        authenticated: Boolean = true
    ): JSONObject = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url(BASE + path).header("Accept", "application/json")
        if (authenticated && token.isNotBlank()) builder.header("Authorization", "Bearer " + token)
        when (method.uppercase(Locale.ROOT)) {
            "GET", "HEAD" -> builder.get()
            else -> {
                val payload = (body ?: JSONObject()).toString().toRequestBody(jsonType)
                builder.method(method.uppercase(Locale.ROOT), payload)
            }
        }
        client.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val parsed = try {
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            } catch (_: Exception) {
                JSONObject().put("message", raw.take(300))
            }
            if (!response.isSuccessful) {
                throw IOException(parsed.optString("error").ifBlank {
                    parsed.optString("message").ifBlank { "Request failed (" + response.code + ")." }
                })
            }
            parsed
        }
    }

    fun query(value: String): String = URLEncoder.encode(value, Charsets.UTF_8.name())
}

private fun JSONArray?.objects(): List<JSONObject> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { optJSONObject(it) }
}

private fun JSONObject.flag(key: String): Boolean {
    val value = opt(key)
    return value == true || value?.toString() == "1" || value?.toString() == "true"
}

private data class CreatorUser(
    val id: Long,
    val name: String,
    val email: String,
    val role: String,
    val niche: String,
    val bio: String,
    val location: String,
    val handle: String,
    val followers: Long,
    val engagement: Double,
    val connected: Boolean
) {
    companion object {
        fun from(j: JSONObject) = CreatorUser(
            id = j.optLong("id"),
            name = j.optString("name", "Creator"),
            email = j.optString("email"),
            role = j.optString("role", "creator"),
            niche = j.optString("niche"),
            bio = j.optString("bio"),
            location = j.optString("location"),
            handle = j.optString("instagram_handle"),
            followers = j.optLong("followers"),
            engagement = j.optDouble("engagement"),
            connected = j.flag("instagram_connected")
        )
    }
}

private data class Campaign(
    val id: Long,
    val title: String,
    val brandName: String,
    val description: String,
    val category: String,
    val type: String,
    val low: Long,
    val high: Long,
    val deliverables: String,
    val location: String,
    val status: String,
    val applications: Int,
    val sample: Boolean
) {
    companion object {
        fun from(j: JSONObject) = Campaign(
            id = j.optLong("id"),
            title = j.optString("title"),
            brandName = j.optString("brand_name", "Brand"),
            description = j.optString("description"),
            category = j.optString("category", "Creator"),
            type = j.optString("collaboration_type", "Paid"),
            low = j.optLong("budget_min"),
            high = j.optLong("budget_max"),
            deliverables = j.optString("deliverables"),
            location = j.optString("location", "India"),
            status = j.optString("status", "active"),
            applications = j.optInt("application_count"),
            sample = j.flag("is_sample")
        )
    }
    fun budgetLabel(): String {
        if (type == "Barter" && high == 0L) return "Product / experience"
        if (low == 0L && high == 0L) return "Discuss with brand"
        if (low == 0L) return "Up to " + rupees(high)
        if (high <= low) return rupees(low)
        return rupees(low) + "–" + rupees(high)
    }
}

private data class ApplicationRow(
    val id: Long,
    val campaignId: Long,
    val campaignTitle: String,
    val brandName: String,
    val creatorName: String,
    val niche: String,
    val followers: Long,
    val pitch: String,
    val rate: Long,
    val status: String,
    val type: String,
    val category: String
) {
    companion object {
        fun from(j: JSONObject) = ApplicationRow(
            id = j.optLong("id"),
            campaignId = j.optLong("campaign_id"),
            campaignTitle = j.optString("campaign_title", "Collaboration"),
            brandName = j.optString("brand_name"),
            creatorName = j.optString("creator_name"),
            niche = j.optString("niche"),
            followers = j.optLong("followers"),
            pitch = j.optString("pitch"),
            rate = j.optLong("proposed_rate"),
            status = j.optString("status", "pending"),
            type = j.optString("collaboration_type"),
            category = j.optString("category")
        )
    }
}

private data class Creator(
    val id: Long,
    val name: String,
    val niche: String,
    val bio: String,
    val location: String,
    val handle: String,
    val followers: Long,
    val engagement: Double,
    val connected: Boolean
) {
    companion object {
        fun from(j: JSONObject) = Creator(
            id = j.optLong("id"),
            name = j.optString("name", "Creator"),
            niche = j.optString("niche"),
            bio = j.optString("bio"),
            location = j.optString("location"),
            handle = j.optString("instagram_handle"),
            followers = j.optLong("followers"),
            engagement = j.optDouble("engagement"),
            connected = j.flag("instagram_connected")
        )
    }
}

private data class Conversation(
    val id: Long,
    val name: String,
    val campaignTitle: String,
    val lastMessage: String,
    val unread: Int
) {
    companion object {
        fun from(j: JSONObject) = Conversation(
            id = j.optLong("id"),
            name = j.optString("counterpart_name", "Creator"),
            campaignTitle = j.optString("campaign_title", "Collaboration"),
            lastMessage = j.optString("last_message", "Start the conversation"),
            unread = j.optInt("unread")
        )
    }
}

private data class ChatMessage(
    val id: Long,
    val sender: String,
    val body: String,
    val mine: Boolean
) {
    companion object {
        fun from(j: JSONObject, userId: Long) = ChatMessage(
            id = j.optLong("id"),
            sender = j.optString("sender_name", "Member"),
            body = j.optString("body"),
            mine = j.optLong("sender_id") == userId
        )
    }
}

private data class AppNotice(
    val id: Long,
    val title: String,
    val body: String,
    val kind: String,
    val read: Boolean
) {
    companion object {
        fun from(j: JSONObject) = AppNotice(
            id = j.optLong("id"),
            title = j.optString("title"),
            body = j.optString("body"),
            kind = j.optString("kind"),
            read = j.optString("read_at").isNotBlank()
        )
    }
}

private data class Invitation(
    val id: Long,
    val campaignTitle: String,
    val counterpart: String,
    val message: String,
    val status: String,
    val campaignId: Long
) {
    companion object {
        fun from(j: JSONObject, creatorRole: Boolean) = Invitation(
            id = j.optLong("id"),
            campaignTitle = j.optString("campaign_title", "Campaign"),
            counterpart = if (creatorRole) j.optString("brand_name", "Brand") else j.optString("creator_name", "Creator"),
            message = j.optString("message"),
            status = j.optString("status", "pending"),
            campaignId = j.optLong("campaign_id")
        )
    }
}

private fun rupees(value: Long): String = "₹" + String.format(Locale("en", "IN"), "%,d", value)

@Composable
private fun CollabzyNativeApp(activity: MainActivity, oauthResult: String?, clearOAuth: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("collabzy_session", 0) }

    var token by remember { mutableStateOf(prefs.getString("token", "").orEmpty()) }
    var me by remember { mutableStateOf<CreatorUser?>(null) }
    var screen by remember { mutableStateOf("discover") }
    var loading by remember { mutableStateOf(false) }
    var campaigns by remember { mutableStateOf(emptyList<Campaign>()) }
    var myCampaigns by remember { mutableStateOf(emptyList<Campaign>()) }
    var applications by remember { mutableStateOf(emptyList<ApplicationRow>()) }
    var saved by remember { mutableStateOf(emptySet<Long>()) }
    var savedCampaigns by remember { mutableStateOf(emptyList<Campaign>()) }
    var creators by remember { mutableStateOf(emptyList<Creator>()) }
    var invitations by remember { mutableStateOf(emptyList<Invitation>()) }
    var conversations by remember { mutableStateOf(emptyList<Conversation>()) }
    var notices by remember { mutableStateOf(emptyList<AppNotice>()) }
    var stats by remember { mutableStateOf(JSONObject()) }
    var activeConversation by remember { mutableStateOf<Conversation?>(null) }
    var messages by remember { mutableStateOf(emptyList<ChatMessage>()) }
    var igConnected by remember { mutableStateOf(false) }
    var igHandle by remember { mutableStateOf("") }
    var igInsights by remember { mutableStateOf(emptyList<JSONObject>()) }
    var igMedia by remember { mutableStateOf(emptyList<JSONObject>()) }
    var applyTarget by remember { mutableStateOf<Campaign?>(null) }
    var inviteTarget by remember { mutableStateOf<Creator?>(null) }
    var createCampaignOpen by remember { mutableStateOf(false) }

    fun toast(message: String) {
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
    }

    suspend fun refreshAll() {
        val user = me ?: return
        val campaignData = Api.call("/campaigns").optJSONArray("campaigns").objects()
        campaigns = campaignData.map { Campaign.from(it) }
        applications = Api.call("/applications").optJSONArray("applications").objects().map { ApplicationRow.from(it) }
        savedCampaigns = Api.call("/saved-campaigns").optJSONArray("campaigns").objects().map { Campaign.from(it) }
        saved = savedCampaigns.map { it.id }.toSet()
        stats = Api.call("/dashboard").optJSONObject("stats") ?: JSONObject()
        conversations = Api.call("/conversations").optJSONArray("conversations").objects().map { Conversation.from(it) }
        invitations = Api.call("/invitations").optJSONArray("invitations").objects().map { Invitation.from(it, user.role == "creator") }
        notices = Api.call("/notifications").optJSONArray("notifications").objects().map { AppNotice.from(it) }
        if (user.role == "brand") {
            myCampaigns = Api.call("/my-campaigns").optJSONArray("campaigns").objects().map { Campaign.from(it) }
            creators = Api.call("/creators").optJSONArray("creators").objects().map { Creator.from(it) }
        } else {
            myCampaigns = emptyList()
        }
    }

    suspend fun refreshInstagram() {
        val result = Api.call("/instagram/status")
        igConnected = result.flag("connected")
        igHandle = result.optString("handle")
        igInsights = emptyList()
        igMedia = emptyList()
        if (igConnected) {
            try {
                igInsights = Api.call("/instagram/insights").optJSONArray("insights").objects()
            } catch (_: Exception) {
                // The profile can be connected even when its current permission set has no daily insights.
            }
            try {
                igMedia = Api.call("/instagram/media").optJSONArray("media").objects()
            } catch (_: Exception) {
                // Display a useful connected state even if media permission is unavailable.
            }
        }
    }

    fun perform(block: suspend () -> Unit) {
        scope.launch {
            loading = true
            try {
                block()
            } catch (e: Exception) {
                toast(e.message ?: "Something went wrong. Please try again.")
            } finally {
                loading = false
            }
        }
    }

    fun openChat(conversation: Conversation) {
        perform {
            activeConversation = conversation
            val data = Api.call("/conversations/" + conversation.id + "/messages")
            messages = data.optJSONArray("messages").objects().map { ChatMessage.from(it, me?.id ?: -1L) }
            screen = "chat"
            refreshAll()
        }
    }

    suspend fun acceptSession(result: JSONObject) {
        token = result.optString("token")
        prefs.edit().putString("token", token).apply()
        Api.token = token
        me = CreatorUser.from(result.getJSONObject("user"))
        screen = if (me?.role == "brand") "overview" else "discover"
        refreshAll()
        toast("Welcome to Collabzy!")
    }

    LaunchedEffect(Unit) {
        if (token.isNotBlank()) {
            Api.token = token
            try {
                me = CreatorUser.from(Api.call("/me").getJSONObject("user"))
                refreshAll()
            } catch (_: Exception) {
                token = ""
                Api.token = ""
                prefs.edit().remove("token").apply()
            }
        }
    }

    LaunchedEffect(oauthResult) {
        val result = oauthResult ?: return@LaunchedEffect
        clearOAuth()
        if (result == "connected" && token.isNotBlank()) {
            perform {
                me = CreatorUser.from(Api.call("/me").getJSONObject("user"))
                refreshInstagram()
                screen = "instagram"
                toast("Instagram connection confirmed.")
            }
        } else {
            toast(if (result == "denied") "Instagram authorization was cancelled." else "Instagram could not be connected. Check the Meta app setup.")
        }
    }

    LaunchedEffect(screen, me?.id) {
        if (screen == "instagram" && me != null) {
            try {
                refreshInstagram()
            } catch (e: Exception) {
                toast(e.message ?: "Unable to load Instagram status.")
            }
        }
    }

    if (me == null) {
        AuthPane(
            loading = loading,
            onSubmit = { isRegister, name, email, password, role ->
                perform {
                    val body = JSONObject().put("email", email.trim()).put("password", password).put("role", role)
                    if (isRegister) body.put("name", name.trim())
                    val endpoint = if (isRegister) "/auth/register" else "/auth/login"
                    acceptSession(Api.call(endpoint, "POST", body, authenticated = false))
                }
            }
        )
        return
    }

    val user = me!!
    val navItems = if (user.role == "brand") {
        listOf(
            NavItem("overview", "Home", Icons.Outlined.Dashboard),
            NavItem("campaigns", "Campaigns", Icons.Outlined.Campaign),
            NavItem("creators", "Creators", Icons.Outlined.PeopleAlt),
            NavItem("messages", "Messages", Icons.Outlined.ChatBubbleOutline),
            NavItem("profile", "Profile", Icons.Outlined.PersonOutline)
        )
    } else {
        listOf(
            NavItem("discover", "Discover", Icons.Outlined.Explore),
            NavItem("applications", "Deals", Icons.Outlined.WorkOutline),
            NavItem("messages", "Messages", Icons.Outlined.ChatBubbleOutline),
            NavItem("profile", "Profile", Icons.Outlined.PersonOutline)
        )
    }

    Scaffold(
        containerColor = Ink,
        bottomBar = {
            if (screen !in setOf("chat", "instagram", "notifications")) {
                NavigationBar(containerColor = Panel, tonalElevation = 0.dp) {
                    navItems.forEach { item ->
                        NavigationBarItem(
                            selected = screen == item.key,
                            onClick = { screen = item.key },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label, fontSize = 10.sp, maxLines = 1) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Violet,
                                selectedTextColor = Violet,
                                indicatorColor = Violet.copy(alpha = 0.12f),
                                unselectedIconColor = Muted,
                                unselectedTextColor = Muted
                            )
                        )
                    }
                }
            }
        }
    ) { inset ->
        Column(
            Modifier.fillMaxSize().background(Ink).padding(inset)
        ) {
            AppHeader(
                user = user,
                screen = screen,
                onBack = {
                    screen = when (screen) {
                        "chat", "instagram", "notifications" -> if (user.role == "brand") "overview" else "discover"
                        else -> if (user.role == "brand") "overview" else "discover"
                    }
                },
                onNotifications = { screen = "notifications" },
                onRefresh = { perform { refreshAll(); toast("Everything is up to date.") } }
            )
            if (loading) LinearProgressIndicator(
                Modifier.fillMaxWidth().height(2.dp),
                color = VioletStrong,
                trackColor = Panel
            )
            when (screen) {
                "discover" -> DiscoverPane(
                    user = user,
                    campaigns = campaigns,
                    saved = saved,
                    savedCount = savedCampaigns.size,
                    onOpenSaved = { screen = "saved" },
                    onSearch = { query, category ->
                        perform {
                            var path = "/campaigns"
                            val parameters = mutableListOf<String>()
                            if (query.isNotBlank()) parameters.add("q=" + Api.query(query))
                            if (category != "All") parameters.add("category=" + Api.query(category))
                            if (parameters.isNotEmpty()) path += "?" + parameters.joinToString("&")
                            campaigns = Api.call(path).optJSONArray("campaigns").objects().map { Campaign.from(it) }
                        }
                    },
                    onSave = { campaign ->
                        perform {
                            val isSaved = saved.contains(campaign.id)
                            Api.call("/campaigns/" + campaign.id + "/save", if (isSaved) "DELETE" else "POST")
                            saved = if (isSaved) saved - campaign.id else saved + campaign.id
                            savedCampaigns = if (isSaved) savedCampaigns.filterNot { it.id == campaign.id } else (savedCampaigns + campaign).distinctBy { it.id }
                            toast(if (isSaved) "Removed from saved campaigns." else "Campaign saved.")
                        }
                    },
                    onApply = { applyTarget = it },
                    onOpenSaved = { screen = "saved" },
                    onOpenInstagram = { screen = "instagram" }
                )
                "saved" -> SavedPane(
                    user = user,
                    campaigns = savedCampaigns,
                    saved = saved,
                    onSave = { campaign ->
                        perform {
                            Api.call("/campaigns/" + campaign.id + "/save", "DELETE")
                            saved = saved - campaign.id
                            savedCampaigns = savedCampaigns.filterNot { it.id == campaign.id }
                            toast("Removed from saved campaigns.")
                        }
                    },
                    onApply = { applyTarget = it }
                )
                "overview" -> OverviewPane(
                    user = user,
                    stats = stats,
                    campaigns = myCampaigns,
                    invitations = invitations,
                    onCreate = { createCampaignOpen = true },
                    onManage = { campaign, status ->
                        perform {
                            Api.call("/campaigns/" + campaign.id + "/manage", "PATCH", JSONObject().put("status", status))
                            refreshAll()
                        }
                    },
                    onViewApps = { screen = "applications" },
                    onMessages = { screen = "messages" }
                )
                "campaigns" -> BrandCampaignsPane(
                    campaigns = myCampaigns,
                    onCreate = { createCampaignOpen = true },
                    onManage = { campaign, status ->
                        perform {
                            Api.call("/campaigns/" + campaign.id + "/manage", "PATCH", JSONObject().put("status", status))
                            refreshAll()
                        }
                    }
                )
                "applications" -> ApplicationsPane(
                    user = user,
                    applications = applications,
                    invitations = invitations,
                    onInvitationStatus = { invitation, status ->
                        perform {
                            Api.call("/invitations/" + invitation.id + "/respond", "PATCH", JSONObject().put("status", status))
                            refreshAll()
                            toast("Invitation " + status + ".")
                        }
                    },
                    onStatus = { app, status ->
                        perform {
                            Api.call("/applications/" + app.id + "/status", "PATCH", JSONObject().put("status", status))
                            refreshAll()
                            toast("Application status updated.")
                        }
                    }
                )
                "creators" -> CreatorDiscoveryPane(
                    creators = creators,
                    campaigns = myCampaigns,
                    onSearch = { query, niche, location ->
                        perform {
                            val parts = mutableListOf<String>()
                            if (query.isNotBlank()) parts.add("q=" + Api.query(query))
                            if (niche.isNotBlank()) parts.add("niche=" + Api.query(niche))
                            if (location.isNotBlank()) parts.add("location=" + Api.query(location))
                            val path = "/creators" + if (parts.isEmpty()) "" else "?" + parts.joinToString("&")
                            creators = Api.call(path).optJSONArray("creators").objects().map { Creator.from(it) }
                        }
                    },
                    onInvite = { inviteTarget = it }
                )
                "messages" -> MessagesPane(conversations = conversations, onOpen = { openChat(it) })
                "chat" -> ChatPane(
                    conversation = activeConversation,
                    messages = messages,
                    currentUserId = user.id,
                    onSend = { body ->
                        perform {
                            val conversation = activeConversation ?: return@perform
                            Api.call("/conversations/" + conversation.id + "/messages", "POST", JSONObject().put("body", body))
                            val data = Api.call("/conversations/" + conversation.id + "/messages")
                            messages = data.optJSONArray("messages").objects().map { ChatMessage.from(it, user.id) }
                            refreshAll()
                        }
                    }
                )
                "notifications" -> NotificationsPane(
                    notices = notices,
                    onReadAll = {
                        perform {
                            Api.call("/notifications/read-all", "PATCH")
                            notices = notices.map { it.copy(read = true) }
                        }
                    }
                )
                "profile" -> ProfilePane(
                    user = user,
                    onSave = { name, niche, location, bio ->
                        perform {
                            val data = Api.call("/me", "PATCH", JSONObject()
                                .put("name", name.trim())
                                .put("niche", niche.trim())
                                .put("location", location.trim())
                                .put("bio", bio.trim()))
                            me = CreatorUser.from(data.getJSONObject("user"))
                            toast("Profile saved.")
                        }
                    },
                    onInstagram = { screen = "instagram" },
                    onShare = {
                        val copy = buildString {
                            append(user.name).append(" · ").append(user.niche.ifBlank { "Creator" }).append("\n")
                            if (user.handle.isNotBlank()) append("Instagram: @").append(user.handle.removePrefix("@")).append("\n")
                            if (user.location.isNotBlank()) append("Location: ").append(user.location).append("\n")
                            if (user.followers > 0) append("Audience: ").append(String.format(Locale("en", "IN"), "%,d", user.followers)).append(" followers\n")
                            if (user.engagement > 0) append("Engagement: ").append(user.engagement).append("%\n")
                            if (user.bio.isNotBlank()) append("\n").append(user.bio)
                            append("\n\nMade with Collabzy")
                        }
                        val intent = Intent(Intent.ACTION_SEND).setType("text/plain")
                            .putExtra(Intent.EXTRA_SUBJECT, user.name + " — Creator Media Kit")
                            .putExtra(Intent.EXTRA_TEXT, copy)
                        activity.startActivity(Intent.createChooser(intent, "Share creator media kit"))
                    },
                    onExport = {
                        perform {
                            val result = Api.call("/me/export")
                            val intent = Intent(Intent.ACTION_SEND).setType("application/json")
                                .putExtra(Intent.EXTRA_SUBJECT, "Collabzy account data export")
                                .putExtra(Intent.EXTRA_TEXT, result.toString(2))
                            activity.startActivity(Intent.createChooser(intent, "Export account data"))
                        }
                    },
                    onDelete = { password ->
                        perform {
                            Api.call("/me", "DELETE", JSONObject().put("password", password))
                            token = ""
                            Api.token = ""
                            prefs.edit().remove("token").apply()
                            me = null
                            toast("Account deleted.")
                        }
                    },
                    onLogout = {
                        token = ""
                        Api.token = ""
                        prefs.edit().remove("token").apply()
                        me = null
                        screen = "discover"
                    }
                )
                "instagram" -> InstagramPane(
                    connected = igConnected || user.connected,
                    handle = igHandle.ifBlank { user.handle },
                    insights = igInsights,
                    media = igMedia,
                    onConnect = {
                        perform {
                            val result = Api.call("/instagram/connect?platform=native")
                            val url = result.optString("authorization_url")
                            if (!url.startsWith("https://www.instagram.com/")) throw IOException(
                                "The server did not return Meta's official Instagram authorization page."
                            )
                            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        }
                    },
                    onRefresh = { perform { refreshInstagram(); toast("Instagram insights refreshed.") } },
                    onDisconnect = {
                        perform {
                            Api.call("/instagram/disconnect", "POST")
                            igConnected = false
                            igHandle = ""
                            igInsights = emptyList()
                            igMedia = emptyList()
                            me = CreatorUser.from(Api.call("/me").getJSONObject("user"))
                            toast("Instagram account disconnected.")
                        }
                    }
                )
                else -> DiscoverPane(
                    user = user, campaigns = campaigns, saved = saved, savedCount = savedCampaigns.size,
                    onSearch = { _, _ -> perform { refreshAll() } },
                    onSave = {}, onApply = { applyTarget = it }, onOpenSaved = { screen = "saved" }, onOpenInstagram = { screen = "instagram" }
                )
            }
        }
    }

    if (applyTarget != null) {
        ApplyDialog(
            campaign = applyTarget!!,
            onDismiss = { applyTarget = null },
            onConfirm = { pitch, rate ->
                val campaign = applyTarget!!
                applyTarget = null
                perform {
                    Api.call("/campaigns/" + campaign.id + "/apply", "POST",
                        JSONObject().put("pitch", pitch).put("proposed_rate", rate.toLongOrNull() ?: 0L))
                    refreshAll()
                    toast("Application submitted. Good luck!")
                }
            }
        )
    }

    if (inviteTarget != null) {
        InviteDialog(
            creator = inviteTarget!!,
            campaigns = myCampaigns.filter { it.status == "active" },
            onDismiss = { inviteTarget = null },
            onConfirm = { campaign, message ->
                val creator = inviteTarget!!
                inviteTarget = null
                perform {
                    Api.call("/campaigns/" + campaign.id + "/invite", "POST",
                        JSONObject().put("creator_id", creator.id).put("message", message))
                    refreshAll()
                    toast("Invitation sent to " + creator.name + ".")
                }
            }
        )
    }

    if (createCampaignOpen) {
        CreateCampaignDialog(
            onDismiss = { createCampaignOpen = false },
            onCreate = { title, desc, category, type, low, high, deliverables, location ->
                createCampaignOpen = false
                perform {
                    Api.call("/campaigns", "POST", JSONObject()
                        .put("title", title).put("description", desc).put("category", category)
                        .put("collaboration_type", type).put("budget_min", low.toLongOrNull() ?: 0L)
                        .put("budget_max", high.toLongOrNull() ?: 0L)
                        .put("deliverables", deliverables).put("location", location))
                    refreshAll()
                    screen = "campaigns"
                    toast("Campaign published.")
                }
            }
        )
    }
}

private data class NavItem(val key: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

@Composable
private fun AppHeader(
    user: CreatorUser,
    screen: String,
    onBack: () -> Unit,
    onNotifications: () -> Unit,
    onRefresh: () -> Unit
) {
    val title = when (screen) {
        "discover" -> "Discover collaborations"
        "saved" -> "Saved campaigns"
        "overview" -> "Your workspace"
        "campaigns" -> "Campaign manager"
        "applications" -> "Applications"
        "creators" -> "Creator discovery"
        "messages" -> "Messages"
        "chat" -> "Conversation"
        "profile" -> "Your profile"
        "instagram" -> "Instagram insights"
        "notifications" -> "Activity"
        else -> "Collabzy"
    }
    Row(
        Modifier.fillMaxWidth().background(Ink).padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (screen in setOf("chat", "instagram", "notifications")) {
            IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, contentDescription = "Back", tint = White) }
        } else {
            Box(
                Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(VioletStrong),
                contentAlignment = Alignment.Center
            ) {
                Text("C", color = White, fontSize = 24.sp, fontWeight = FontWeight.Black)
            }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("COLLABZY", color = Violet, fontSize = 11.sp, letterSpacing = 2.sp, fontWeight = FontWeight.ExtraBold)
            Text(title, color = White, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }
        IconButton(onClick = onRefresh) { Icon(Icons.Outlined.Refresh, contentDescription = "Refresh", tint = Muted) }
        IconButton(onClick = onNotifications) {
            BadgedBox(badge = {}) { Icon(Icons.Outlined.NotificationsNone, contentDescription = "Notifications", tint = Violet) }
        }
    }
}

@Composable
private fun AuthPane(
    loading: Boolean,
    onSubmit: (Boolean, String, String, String, String) -> Unit
) {
    var register by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("creator") }
    var validation by remember { mutableStateOf("") }

    Box(Modifier.fillMaxSize().background(Ink)) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Box(Modifier.size(58.dp).clip(RoundedCornerShape(18.dp)).background(VioletStrong), contentAlignment = Alignment.Center) {
                Text("C", fontSize = 32.sp, color = White, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(22.dp))
            Text("CREATORS × BRANDS × OPPORTUNITY", color = Mint, fontSize = 10.sp, letterSpacing = 1.6.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Text(if (register) "Make your next move." else "Your next collab starts here.", color = White, fontSize = 32.sp, lineHeight = 38.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(10.dp))
            Text(
                "A focused workspace to find collaborations, manage campaigns and build real brand relationships.",
                color = Muted, fontSize = 15.sp, lineHeight = 23.sp
            )
            Spacer(Modifier.height(24.dp))
            if (register) {
                FieldValue("Full name", name, { name = it }, singleLine = true)
                Spacer(Modifier.height(10.dp))
                Text("I am joining as", color = Muted, fontSize = 12.sp)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    RoleChoice("Creator", role == "creator", Modifier.weight(1f)) { role = "creator" }
                    RoleChoice("Brand", role == "brand", Modifier.weight(1f)) { role = "brand" }
                }
                Spacer(Modifier.height(10.dp))
            }
            FieldValue("Email address", email, { email = it }, singleLine = true, keyboard = KeyboardType.Email)
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth(),
                label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                shape = RoundedCornerShape(16.dp), colors = fieldColors()
            )
            if (validation.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(validation, color = Danger, fontSize = 12.sp)
            }
            Spacer(Modifier.height(18.dp))
            Button(
                onClick = {
                    validation = when {
                        register && name.trim().isBlank() -> "Please enter your name."
                        email.trim().isBlank() -> "Please enter your email address."
                        password.length < 8 -> "Password must contain at least 8 characters."
                        else -> ""
                    }
                    if (validation.isBlank()) onSubmit(register, name, email, password, role)
                },
                modifier = Modifier.fillMaxWidth().height(54.dp),
                enabled = !loading,
                shape = RoundedCornerShape(17.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink)
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Ink)
                else Text(if (register) "Create your account  →" else "Sign in  →", fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                onClick = { register = !register; validation = "" },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(17.dp),
                border = BorderStroke(1.dp, Border),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = White)
            ) { Text(if (register) "Already have an account? Sign in" else "New to Collabzy? Create account") }
            Spacer(Modifier.height(22.dp))
            Text("Use your own account. Brand deals and earnings are not guaranteed.", color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
        }
    }
}

@Composable
private fun RoleChoice(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.clip(RoundedCornerShape(14.dp)).clickable(onClick = onClick),
        color = if (selected) Violet.copy(alpha = 0.17f) else Panel,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, if (selected) VioletStrong else Border)
    ) {
        Text(label, Modifier.padding(vertical = 13.dp), color = if (selected) Violet else White, fontWeight = FontWeight.SemiBold, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun FieldValue(
    label: String,
    value: String,
    onValue: (String) -> Unit,
    singleLine: Boolean = false,
    keyboard: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValue,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        singleLine = singleLine,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        shape = RoundedCornerShape(16.dp),
        colors = fieldColors()
    )
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = White,
    unfocusedTextColor = White,
    focusedLabelColor = Violet,
    unfocusedLabelColor = Muted,
    cursorColor = Violet,
    focusedBorderColor = VioletStrong,
    unfocusedBorderColor = Border
)

@Composable
private fun DiscoverPane(
    user: CreatorUser,
    campaigns: List<Campaign>,
    saved: Set<Long>,
    savedCount: Int,
    onSearch: (String, String) -> Unit,
    onSave: (Campaign) -> Unit,
    onApply: (Campaign) -> Unit,
    onOpenSaved: () -> Unit,
    onOpenInstagram: () -> Unit
) {
    var query by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
    val categories = listOf("All", "Beauty", "Fashion", "Food", "Fitness", "Tech", "Travel")
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Hey, " + user.name.substringBefore(" ").take(22) + " 👋", color = White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
                    Text("Your next opportunity could be one swipe away.", color = Muted, fontSize = 12.sp)
                }
                Surface(color = Violet.copy(alpha = 0.12f), shape = CircleShape, border = BorderStroke(1.dp, Violet.copy(alpha = 0.25f))) {
                    IconButton(onClick = onOpenInstagram) { Text("◎", color = Violet, fontSize = 24.sp) }
                }
            }
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = query, onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(), placeholder = { Text("Brand, campaign or keyword") },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null, tint = Muted) },
                trailingIcon = {
                    IconButton(onClick = { onSearch(query, category) }) {
                        Icon(Icons.Outlined.ArrowForward, contentDescription = "Search", tint = Violet)
                    }
                },
                singleLine = true, shape = RoundedCornerShape(16.dp), colors = fieldColors()
            )
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                categories.forEach { item ->
                    FilterChip(
                        selected = category == item,
                        onClick = { category = item; onSearch(query, item) },
                        label = { Text(item) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Violet.copy(alpha = 0.18f),
                            selectedLabelColor = Violet,
                            labelColor = Muted
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true, selected = category == item,
                            borderColor = Border, selectedBorderColor = VioletStrong
                        )
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(campaigns.size.toString() + " opportunities", color = White, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = onOpenSaved) {
                    Icon(Icons.Outlined.BookmarkBorder, contentDescription = null, tint = Violet)
                    Spacer(Modifier.width(4.dp))
                    Text("Saved " + savedCount, color = Violet, fontSize = 11.sp)
                }
            }
        }
        if (campaigns.isEmpty()) {
            EmptyState("No campaigns match yet", "Try another category or refresh the feed.", Icons.Outlined.Explore, Modifier.weight(1f))
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 22.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(campaigns, key = { it.id }) { campaign ->
                    CampaignCard(
                        campaign = campaign,
                        saved = saved.contains(campaign.id),
                        showApply = user.role == "creator",
                        onSave = { onSave(campaign) },
                        onApply = { onApply(campaign) }
                    )
                }
            }
        }
    }
}

@Composable
private fun CampaignCard(
    campaign: Campaign,
    saved: Boolean,
    showApply: Boolean,
    showSave: Boolean = true,
    onSave: () -> Unit,
    onApply: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Border)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(categoryColor(campaign.category)), contentAlignment = Alignment.Center) {
                    Text(campaign.category.take(1).uppercase(), color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Black)
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(campaign.brandName, color = White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(campaign.category + " · " + campaign.location, color = Muted, fontSize = 11.sp)
                }
                if (showSave) {
                    IconButton(onClick = onSave) {
                        Icon(if (saved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, contentDescription = "Save campaign", tint = if (saved) Violet else Muted)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(campaign.title, color = White, fontSize = 19.sp, lineHeight = 24.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(6.dp))
            Text(campaign.description, color = Muted, fontSize = 12.sp, lineHeight = 18.sp, maxLines = 3)
            Spacer(Modifier.height(13.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Pill(campaign.type, if (campaign.type == "Paid") Mint else if (campaign.type == "Barter") Violet else Color(0xFFFFD38B))
                if (campaign.deliverables.isNotBlank()) {
                    Surface(color = Panel2, shape = RoundedCornerShape(8.dp)) {
                        Text(campaign.deliverables, Modifier.padding(horizontal = 8.dp, vertical = 6.dp), color = Muted, fontSize = 10.sp, maxLines = 1)
                    }
                }
            }
            Spacer(Modifier.height(13.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(campaign.budgetLabel(), color = Mint, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                    Text(if (campaign.applications > 0) campaign.applications.toString() + " applicants" else "Creator-friendly collaboration", color = Muted, fontSize = 10.sp)
                }
                if (showApply) {
                    Button(
                        onClick = onApply,
                        shape = RoundedCornerShape(13.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink),
                        contentPadding = PaddingValues(horizontal = 15.dp, vertical = 10.dp)
                    ) { Text("Apply →", fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                } else {
                    Text(if (campaign.status == "active") "ACTIVE" else campaign.status.uppercase(), color = Mint, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
            if (campaign.sample) {
                Spacer(Modifier.height(7.dp))
                Text("Sample listing · confirm the brand before accepting an offer.", color = Color(0xFFFFD38B), fontSize = 10.sp)
            }
        }
    }
}

private fun categoryColor(category: String): Color = when (category.lowercase(Locale.ROOT)) {
    "beauty" -> Color(0xFFF2B7D2)
    "fashion" -> Color(0xFFD9C6FF)
    "food" -> Color(0xFFFFD38B)
    "fitness" -> Color(0xFFB2E7C9)
    "tech" -> Color(0xFFB6D7FF)
    "travel" -> Color(0xFFA8E8E8)
    else -> Violet
}

@Composable
private fun OverviewPane(
    user: CreatorUser,
    stats: JSONObject,
    campaigns: List<Campaign>,
    invitations: List<Invitation>,
    onCreate: () -> Unit,
    onManage: (Campaign, String) -> Unit,
    onViewApps: () -> Unit,
    onMessages: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 8.dp)) {
        Text("Build better partnerships.", color = White, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
        Text("A clear view of your brand workspace.", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard("Campaigns", stats.optInt("myCampaigns"), "Published by you", Modifier.weight(1f))
            StatCard("Applications", stats.optInt("receivedApplications"), "Creator interest", Modifier.weight(1f))
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatCard("Messages", stats.optInt("unreadMessages"), "Unread", Modifier.weight(1f))
            StatCard("Active listings", campaigns.count { it.status == "active" }, "Open to apply", Modifier.weight(1f))
        }
        Spacer(Modifier.height(18.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Your campaigns", color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
            TextButton(onClick = onCreate) { Icon(Icons.Filled.Add, null, tint = Violet); Text(" New", color = Violet) }
        }
        if (campaigns.isEmpty()) {
            InfoPanel("Publish your first brief", "Tell creators what you need, your budget and the content deliverables.", Icons.Outlined.Campaign)
            Spacer(Modifier.height(10.dp))
            Button(onClick = onCreate, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink)) {
                Icon(Icons.Filled.Add, null); Spacer(Modifier.width(8.dp)); Text("Create campaign", fontWeight = FontWeight.Bold)
            }
        } else {
            campaigns.take(3).forEach { campaign ->
                MiniCampaignRow(campaign, onClick = { onManage(campaign, if (campaign.status == "active") "closed" else "active") })
                Spacer(Modifier.height(8.dp))
            }
            OutlinedButton(onClick = onViewApps, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Border), colors = ButtonDefaults.outlinedButtonColors(contentColor = White)) {
                Text("Review creator applications")
            }
        }
        Spacer(Modifier.height(18.dp))
        Text("Creator invitations", color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(8.dp))
        if (invitations.isEmpty()) {
            InfoPanel("Your next partnership starts with an invite", "Explore creators and invite profiles that fit your campaign.", Icons.Outlined.PeopleAlt)
        } else {
            invitations.take(5).forEach { invitation ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(13.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(invitation.counterpart + " · " + invitation.campaignTitle, color = White, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            StatusPill(invitation.status)
                        }
                        if (invitation.message.isNotBlank()) Text(invitation.message, color = Muted, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(onClick = onMessages, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Border), colors = ButtonDefaults.outlinedButtonColors(contentColor = White)) {
            Icon(Icons.Outlined.ChatBubbleOutline, null); Spacer(Modifier.width(8.dp)); Text("Open collaboration inbox")
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun SavedPane(
    user: CreatorUser,
    campaigns: List<Campaign>,
    saved: Set<Long>,
    onSave: (Campaign) -> Unit,
    onApply: (Campaign) -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 18.dp, vertical = 8.dp)) {
            Text("Your saved campaigns", color = White, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
            Text("Keep good-fit opportunities close while you prepare a pitch.", color = Muted, fontSize = 12.sp)
        }
        if (campaigns.isEmpty()) {
            EmptyState("No saved campaigns yet", "Tap the bookmark on a campaign to save it here.", Icons.Outlined.BookmarkBorder, Modifier.weight(1f))
        } else {
            LazyColumn(
                Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(campaigns, key = { it.id }) { campaign ->
                    CampaignCard(
                        campaign = campaign,
                        saved = saved.contains(campaign.id),
                        showApply = user.role == "creator",
                        onSave = { onSave(campaign) },
                        onApply = { onApply(campaign) }
                    )
                }
            }
        }
    }
}

@Composable
private fun BrandCampaignsPane(
    campaigns: List<Campaign>,
    onCreate: () -> Unit,
    onManage: (Campaign, String) -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Campaign studio", color = White, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
                Text("Publish, manage and close your briefs.", color = Muted, fontSize = 12.sp)
            }
            Button(onClick = onCreate, shape = RoundedCornerShape(13.dp), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink)) {
                Icon(Icons.Filled.Add, null); Spacer(Modifier.width(4.dp)); Text("New")
            }
        }
        Spacer(Modifier.height(12.dp))
        if (campaigns.isEmpty()) EmptyState("No campaigns published yet", "Create a campaign and start receiving creator applications.", Icons.Outlined.Campaign, Modifier.weight(1f))
        else LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(campaigns, key = { it.id }) { campaign ->
                CampaignCard(campaign, saved = false, showApply = false, showSave = false, onSave = {}, onApply = {})
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(campaign.applications.toString() + " applications", color = Muted, fontSize = 11.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { onManage(campaign, if (campaign.status == "active") "closed" else "active") }) {
                        Text(if (campaign.status == "active") "Close campaign" else "Reopen campaign", color = if (campaign.status == "active") Danger else Mint)
                    }
                }
            }
        }
    }
}

@Composable
private fun ApplicationsPane(
    user: CreatorUser,
    applications: List<ApplicationRow>,
    invitations: List<Invitation>,
    onInvitationStatus: (Invitation, String) -> Unit,
    onStatus: (ApplicationRow, String) -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 18.dp)) {
            Text(if (user.role == "brand") "Creator applications" else "Your applications", color = White, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
            Text(if (user.role == "brand") "Choose collaborators and keep expectations clear." else "Follow every pitch from pending to completed.", color = Muted, fontSize = 12.sp)
            Spacer(Modifier.height(12.dp))
        }
        if (user.role == "creator" && invitations.isNotEmpty()) {
            Column(Modifier.padding(horizontal = 18.dp).heightIn(max = 240.dp).verticalScroll(rememberScrollState())) {
                Text("Brand invitations", color = White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(7.dp))
                invitations.take(5).forEach { invitation ->
                    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(invitation.campaignTitle, color = White, fontWeight = FontWeight.Bold)
                                    Text("Invited by " + invitation.counterpart, color = Muted, fontSize = 11.sp)
                                }
                                StatusPill(invitation.status)
                            }
                            if (invitation.message.isNotBlank()) {
                                Spacer(Modifier.height(5.dp))
                                Text(invitation.message, color = Muted, fontSize = 12.sp)
                            }
                            if (invitation.status == "pending") {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SmallAction("Accept invite", Mint, Modifier.weight(1f)) { onInvitationStatus(invitation, "accepted") }
                                    SmallAction("Decline", Danger, Modifier.weight(1f)) { onInvitationStatus(invitation, "declined") }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(7.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
        }
        if (applications.isEmpty()) {
            EmptyState("Nothing here yet", if (user.role == "brand") "Your campaign applications will appear here." else "Apply to a campaign to start tracking your collaborations.", Icons.Outlined.WorkOutline, Modifier.weight(1f))
        } else LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(applications, key = { it.id }) { app ->
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Panel),
                    shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, Border)
                ) {
                    Column(Modifier.padding(15.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(app.campaignTitle, color = White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                                Text(if (user.role == "brand") app.creatorName.ifBlank { "Creator" } + " · " + app.niche else app.brandName.ifBlank { "Brand" }, color = Muted, fontSize = 12.sp)
                            }
                            StatusPill(app.status)
                        }
                        Spacer(Modifier.height(8.dp))
                        if (app.pitch.isNotBlank()) Text(app.pitch, color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                        Spacer(Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Proposed: " + if (app.rate > 0) rupees(app.rate) else "Open to discussion", color = Mint, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.weight(1f))
                            if (user.role == "brand" && app.followers > 0) Text(String.format(Locale("en", "IN"), "%,d", app.followers) + " followers", color = Muted, fontSize = 10.sp)
                        }
                        if (user.role == "brand") {
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), modifier = Modifier.fillMaxWidth()) {
                                if (app.status == "pending") {
                                    SmallAction("Accept", Mint, Modifier.weight(1f)) { onStatus(app, "accepted") }
                                    SmallAction("Decline", Danger, Modifier.weight(1f)) { onStatus(app, "declined") }
                                } else if (app.status == "accepted") {
                                    SmallAction("Mark completed", Violet, Modifier.weight(1f)) { onStatus(app, "completed") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CreatorDiscoveryPane(
    creators: List<Creator>,
    campaigns: List<Campaign>,
    onSearch: (String, String, String) -> Unit,
    onInvite: (Creator) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var niche by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 18.dp)) {
            Text("Find your next creator", color = White, fontSize = 23.sp, fontWeight = FontWeight.ExtraBold)
            Text("Filter by audience, niche and location.", color = Muted, fontSize = 12.sp)
            Spacer(Modifier.height(12.dp))
            FieldValue("Name, bio or handle", query, { query = it }, singleLine = true)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) { FieldValue("Niche", niche, { niche = it }, singleLine = true) }
                Box(Modifier.weight(1f)) { FieldValue("Location", location, { location = it }, singleLine = true) }
            }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { onSearch(query, niche, location) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink),
                shape = RoundedCornerShape(14.dp)
            ) { Icon(Icons.Outlined.Search, null); Spacer(Modifier.width(8.dp)); Text("Search creators", fontWeight = FontWeight.Bold) }
            if (campaigns.none { it.status == "active" }) {
                Spacer(Modifier.height(8.dp))
                Text("Publish an active campaign first to invite creators.", color = Color(0xFFFFD38B), fontSize = 12.sp)
            }
        }
        if (creators.isEmpty()) EmptyState("No creator profiles found", "Creators appear here after they register and set up their profiles.", Icons.Outlined.PeopleAlt, Modifier.weight(1f))
        else LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(creators, key = { it.id }) { creator ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Avatar(creator.name)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(creator.name, color = White, fontWeight = FontWeight.ExtraBold)
                                Text(listOf(creator.niche, creator.location).filter { it.isNotBlank() }.joinToString(" · "), color = Muted, fontSize = 11.sp)
                            }
                            if (creator.connected) Pill("IG linked", Mint)
                        }
                        Spacer(Modifier.height(10.dp))
                        if (creator.bio.isNotBlank()) Text(creator.bio, color = Muted, fontSize = 12.sp, lineHeight = 17.sp, maxLines = 3)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MetricCard(String.format(Locale("en", "IN"), "%,d", creator.followers), "Followers", Modifier.weight(1f))
                            MetricCard(String.format(Locale.ROOT, "%.1f%%", creator.engagement), "Engagement", Modifier.weight(1f))
                        }
                        if (creator.handle.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text("@" + creator.handle.removePrefix("@"), color = Violet, fontSize = 12.sp)
                        }
                        Spacer(Modifier.height(10.dp))
                        Button(
                            onClick = { onInvite(creator) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = campaigns.any { it.status == "active" },
                            colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink),
                            shape = RoundedCornerShape(13.dp)
                        ) { Icon(Icons.Filled.Send, null); Spacer(Modifier.width(8.dp)); Text("Invite to a campaign") }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessagesPane(conversations: List<Conversation>, onOpen: (Conversation) -> Unit) {
    if (conversations.isEmpty()) {
        EmptyState("Your collaboration inbox", "Once an application or invite creates a collaboration, messages start here.", Icons.Outlined.ChatBubbleOutline, Modifier.fillMaxSize())
    } else LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(conversations, key = { it.id }) { conversation ->
            Card(
                Modifier.fillMaxWidth().clickable { onOpen(conversation) },
                colors = CardDefaults.cardColors(containerColor = Panel),
                shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Border)
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Avatar(conversation.name)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(conversation.name, color = White, fontWeight = FontWeight.Bold)
                        Text(conversation.campaignTitle, color = Violet, fontSize = 11.sp)
                        Text(conversation.lastMessage, color = Muted, fontSize = 12.sp, maxLines = 2)
                    }
                    if (conversation.unread > 0) {
                        Surface(color = VioletStrong, shape = CircleShape) {
                            Text(conversation.unread.toString(), color = White, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    } else Icon(Icons.Outlined.ChevronRight, null, tint = Muted)
                }
            }
        }
    }
}

@Composable
private fun ChatPane(
    conversation: Conversation?,
    messages: List<ChatMessage>,
    currentUserId: Long,
    onSend: (String) -> Unit
) {
    var draft by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Border)) {
            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar(conversation?.name ?: "C")
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(conversation?.name ?: "Collaboration", color = White, fontWeight = FontWeight.Bold)
                    Text(conversation?.campaignTitle ?: "Messages", color = Muted, fontSize = 11.sp)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            reverseLayout = false,
            contentPadding = PaddingValues(vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages, key = { it.id }) { message ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (message.mine) Arrangement.End else Arrangement.Start) {
                    Column(
                        Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(16.dp))
                            .background(if (message.mine) Color(0xFF332A55) else Panel)
                            .padding(horizontal = 13.dp, vertical = 10.dp)
                    ) {
                        if (!message.mine) Text(message.sender, color = Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        Text(message.body, color = White, fontSize = 13.sp, lineHeight = 18.sp)
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = draft, onValueChange = { if (it.length <= 2000) draft = it },
                modifier = Modifier.weight(1f), placeholder = { Text("Write a message…") },
                shape = RoundedCornerShape(16.dp), colors = fieldColors(), maxLines = 4
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = { val text = draft.trim(); if (text.isNotBlank()) { draft = ""; onSend(text) } },
                modifier = Modifier.size(50.dp).clip(RoundedCornerShape(16.dp)).background(VioletStrong)
            ) { Icon(Icons.Filled.Send, "Send message", tint = White) }
        }
    }
}

@Composable
private fun NotificationsPane(notices: List<AppNotice>, onReadAll: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Activity & alerts", color = White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
            TextButton(onClick = onReadAll) { Text("Mark all read", color = Violet) }
        }
        if (notices.isEmpty()) EmptyState("No notifications yet", "Application updates and new collaboration messages will appear here.", Icons.Outlined.NotificationsNone, Modifier.weight(1f))
        else LazyColumn(
            Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(notices, key = { it.id }) { notice ->
                Card(colors = CardDefaults.cardColors(containerColor = if (notice.read) Panel else Color(0xFF29223D)), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(13.dp), verticalAlignment = Alignment.Top) {
                        Box(Modifier.size(9.dp).padding(top = 3.dp).clip(CircleShape).background(if (notice.read) Border else Violet))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(notice.title, color = White, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(3.dp))
                            Text(notice.body, color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfilePane(
    user: CreatorUser,
    onSave: (String, String, String, String) -> Unit,
    onInstagram: () -> Unit,
    onShare: () -> Unit,
    onExport: () -> Unit,
    onDelete: (String) -> Unit,
    onLogout: () -> Unit
) {
    var name by remember(user.id, user.name) { mutableStateOf(user.name) }
    var niche by remember(user.id, user.niche) { mutableStateOf(user.niche) }
    var location by remember(user.id, user.location) { mutableStateOf(user.location) }
    var bio by remember(user.id, user.bio) { mutableStateOf(user.bio) }
    var deleteDialog by remember { mutableStateOf(false) }
    var password by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(user.name, size = 60)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(user.name, color = White, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
                Text(user.email, color = Muted, fontSize = 12.sp)
                Spacer(Modifier.height(4.dp))
                Pill(if (user.role == "brand") "BRAND WORKSPACE" else "CREATOR PROFILE", Violet)
            }
        }
        Spacer(Modifier.height(18.dp))
        if (user.role == "creator") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard(String.format(Locale("en", "IN"), "%,d", user.followers), "Followers", Modifier.weight(1f))
                MetricCard(String.format(Locale.ROOT, "%.1f%%", user.engagement), "Engagement", Modifier.weight(1f))
            }
            Spacer(Modifier.height(10.dp))
        }
        Text("Profile details", color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(10.dp))
        FieldValue("Display name", name, { name = it }, singleLine = true)
        Spacer(Modifier.height(8.dp))
        FieldValue(if (user.role == "brand") "Industry / category" else "Main niche", niche, { niche = it }, singleLine = true)
        Spacer(Modifier.height(8.dp))
        FieldValue("City / location", location, { location = it }, singleLine = true)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = bio, onValueChange = { bio = it.take(500) }, modifier = Modifier.fillMaxWidth(),
            label = { Text("Short bio / brand introduction") }, minLines = 3, maxLines = 5,
            shape = RoundedCornerShape(16.dp), colors = fieldColors()
        )
        Spacer(Modifier.height(12.dp))
        Button(onClick = { onSave(name, niche, location, bio) }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink), shape = RoundedCornerShape(14.dp)) {
            Icon(Icons.Filled.Check, null); Spacer(Modifier.width(8.dp)); Text("Save profile", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(12.dp))
        if (user.role == "creator") {
            SettingRow("Instagram & insights", if (user.connected) "Account linked" else "Connect a professional account", "◎", onInstagram)
            Spacer(Modifier.height(8.dp))
            SettingRow("Share creator media kit", "Share your profile details", "↗", onShare)
            Spacer(Modifier.height(8.dp))
        }
        SettingRow("Export account data", "Prepare a portable data copy", "⇩", onExport)
        Spacer(Modifier.height(8.dp))
        SettingRow("Privacy & account deletion", "Delete your account permanently", "!", { deleteDialog = true }, danger = true)
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Border), colors = ButtonDefaults.outlinedButtonColors(contentColor = White), shape = RoundedCornerShape(14.dp)) {
            Icon(Icons.Outlined.Logout, null); Spacer(Modifier.width(8.dp)); Text("Sign out")
        }
        Spacer(Modifier.height(24.dp))
        Text("Collabzy · Creator-first collaborations", color = Muted, fontSize = 11.sp, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(18.dp))
    }

    if (deleteDialog) AlertDialog(
        onDismissRequest = { deleteDialog = false },
        title = { Text("Delete your account?") },
        text = {
            Column {
                Text("This permanently deletes your Collabzy account and associated data. Enter your password to confirm.")
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Current password") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, colors = fieldColors())
            }
        },
        confirmButton = {
            TextButton(onClick = { deleteDialog = false; onDelete(password); password = "" }) { Text("Delete permanently", color = Danger) }
        },
        dismissButton = { TextButton(onClick = { deleteDialog = false }) { Text("Cancel", color = Muted) } },
        containerColor = Panel, titleContentColor = White, textContentColor = Muted
    )
}

@Composable
private fun InstagramPane(
    connected: Boolean,
    handle: String,
    insights: List<JSONObject>,
    media: List<JSONObject>,
    onConnect: () -> Unit,
    onRefresh: () -> Unit,
    onDisconnect: () -> Unit
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 8.dp)) {
        Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(22.dp), border = BorderStroke(1.dp, Border)) {
            Column(Modifier.padding(17.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(Panel2), contentAlignment = Alignment.Center) {
                        Text("◎", color = Violet, fontSize = 30.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Instagram Insights", color = White, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Official Meta authorization", color = Muted, fontSize = 11.sp)
                    }
                    Pill(if (connected) "CONNECTED" else "NOT LINKED", if (connected) Mint else Color(0xFFFFD38B))
                }
                Spacer(Modifier.height(14.dp))
                Text("Connect an eligible Instagram Creator or Business account to see the insights its current permissions allow. Collabzy never asks for your Instagram password.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                Spacer(Modifier.height(12.dp))
                if (!connected) {
                    Button(onClick = onConnect, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Violet, contentColor = Ink), shape = RoundedCornerShape(14.dp)) {
                        Text("Continue with Instagram  →", fontWeight = FontWeight.Bold)
                    }
                } else {
                    Text("Connected account: @" + handle.removePrefix("@"), color = Mint, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onRefresh, modifier = Modifier.weight(1f), border = BorderStroke(1.dp, Border), colors = ButtonDefaults.outlinedButtonColors(contentColor = White)) { Icon(Icons.Outlined.Refresh, null); Spacer(Modifier.width(5.dp)); Text("Refresh") }
                        OutlinedButton(onClick = onDisconnect, modifier = Modifier.weight(1f), border = BorderStroke(1.dp, Border), colors = ButtonDefaults.outlinedButtonColors(contentColor = Danger)) { Text("Disconnect") }
                    }
                }
            }
        }
        if (connected) {
            Spacer(Modifier.height(16.dp))
            Text("Authorized metrics", color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            Spacer(Modifier.height(8.dp))
            if (insights.isEmpty()) {
                InfoPanel("No daily metrics returned", "Instagram may not provide these metrics for the current account, date range or permission set.", Icons.Outlined.Insights)
            } else {
                insights.forEach { metric ->
                    val values = metric.optJSONArray("values")
                    val latest = values?.optJSONObject(values.length() - 1)?.optString("value") ?: "—"
                    val name = metric.optString("title").ifBlank { metric.optString("name").replace('_', ' ') }
                    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(name, color = Muted, fontSize = 12.sp)
                                Text(latest, color = White, fontSize = 21.sp, fontWeight = FontWeight.ExtraBold)
                            }
                            Icon(Icons.Outlined.Insights, null, tint = Violet)
                        }
                    }
                    Spacer(Modifier.height(7.dp))
                }
            }
            Spacer(Modifier.height(12.dp))
            Text("Recent content", color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            if (media.isEmpty()) Text("No recent posts were returned for the current permissions.", color = Muted, fontSize = 12.sp)
            media.take(12).forEach { post ->
                Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(13.dp)) {
                        Pill(post.optString("media_type", "POST"), Violet)
                        Spacer(Modifier.height(6.dp))
                        Text(post.optString("caption").ifBlank { "Instagram post" }.take(180), color = White, fontSize = 13.sp)
                        Spacer(Modifier.height(5.dp))
                        Text("Likes " + post.optInt("like_count") + "  ·  Comments " + post.optInt("comments_count"), color = Muted, fontSize = 11.sp)
                        val url = post.optString("permalink")
                        if (url.startsWith("https://www.instagram.com/") || url.startsWith("https://instagram.com/")) {
                            Text(url, color = Violet, fontSize = 10.sp)
                        }
                    }
                }
                Spacer(Modifier.height(7.dp))
            }
        }
        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun ApplyDialog(campaign: Campaign, onDismiss: () -> Unit, onConfirm: (String, String) -> Unit) {
    var pitch by remember { mutableStateOf("") }
    var rate by remember { mutableStateOf(if (campaign.low > 0) campaign.low.toString() else "") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Apply to " + campaign.brandName) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(campaign.title, color = Violet, fontWeight = FontWeight.Bold)
                OutlinedTextField(value = pitch, onValueChange = { pitch = it.take(1000) }, label = { Text("Why are you a good fit?") }, minLines = 3, maxLines = 5, colors = fieldColors())
                OutlinedTextField(value = rate, onValueChange = { rate = it.filter(Char::isDigit).take(9) }, label = { Text("Your proposed rate (₹)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), colors = fieldColors())
                Text("Agree on deliverables, timelines and payment with the brand before you start.", color = Muted, fontSize = 11.sp)
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(pitch.trim(), rate) }) { Text("Submit application", color = Violet) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Muted) } },
        containerColor = Panel, titleContentColor = White, textContentColor = Muted
    )
}

@Composable
private fun InviteDialog(
    creator: Creator,
    campaigns: List<Campaign>,
    onDismiss: () -> Unit,
    onConfirm: (Campaign, String) -> Unit
) {
    var message by remember { mutableStateOf("Hi " + creator.name + ", we'd love to explore a collaboration.") }
    var selected by remember(campaigns) { mutableStateOf(campaigns.firstOrNull()) }
    var dropdown by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Invite " + creator.name) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (campaigns.isEmpty()) Text("Publish an active campaign before sending an invite.")
                else {
                    Box {
                        OutlinedButton(onClick = { dropdown = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = White), border = BorderStroke(1.dp, Border)) {
                            Text(selected?.title ?: "Choose campaign", maxLines = 1)
                        }
                        DropdownMenu(expanded = dropdown, onDismissRequest = { dropdown = false }) {
                            campaigns.forEach { campaign ->
                                DropdownMenuItem(text = { Text(campaign.title) }, onClick = { selected = campaign; dropdown = false })
                            }
                        }
                    }
                    OutlinedTextField(value = message, onValueChange = { message = it.take(1000) }, label = { Text("Personal invitation") }, minLines = 2, maxLines = 4, colors = fieldColors())
                }
            }
        },
        confirmButton = { TextButton(enabled = selected != null, onClick = { selected?.let { onConfirm(it, message.trim()) } }) { Text("Send invite", color = Violet) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Muted) } },
        containerColor = Panel, titleContentColor = White, textContentColor = Muted
    )
}

@Composable
private fun CreateCampaignDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String, String, String, String, String, String, String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Beauty") }
    var type by remember { mutableStateOf("Paid") }
    var low by remember { mutableStateOf("5000") }
    var high by remember { mutableStateOf("15000") }
    var deliverables by remember { mutableStateOf("1 Reel + 2 Stories") }
    var location by remember { mutableStateOf("India") }
    var dropdown by remember { mutableStateOf(false) }
    var typeDropdown by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create a campaign") },
        text = {
            Column(Modifier.heightIn(max = 500.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it.take(120) }, label = { Text("Campaign title") }, singleLine = true, colors = fieldColors())
                OutlinedTextField(value = description, onValueChange = { description = it.take(1500) }, label = { Text("Brief / what you need") }, minLines = 3, maxLines = 5, colors = fieldColors())
                Box {
                    OutlinedButton(onClick = { dropdown = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = White), border = BorderStroke(1.dp, Border)) { Text("Category: " + category) }
                    DropdownMenu(expanded = dropdown, onDismissRequest = { dropdown = false }) {
                        listOf("Beauty", "Fashion", "Food", "Fitness", "Tech", "Travel", "Lifestyle", "Other").forEach { item ->
                            DropdownMenuItem(text = { Text(item) }, onClick = { category = item; dropdown = false })
                        }
                    }
                }
                Box {
                    OutlinedButton(onClick = { typeDropdown = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = White), border = BorderStroke(1.dp, Border)) { Text("Collaboration: " + type) }
                    DropdownMenu(expanded = typeDropdown, onDismissRequest = { typeDropdown = false }) {
                        listOf("Paid", "Barter", "Hybrid").forEach { item -> DropdownMenuItem(text = { Text(item) }, onClick = { type = item; typeDropdown = false }) }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.weight(1f)) { OutlinedTextField(value = low, onValueChange = { low = it.filter(Char::isDigit).take(10) }, label = { Text("Min ₹") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, colors = fieldColors()) }
                    Box(Modifier.weight(1f)) { OutlinedTextField(value = high, onValueChange = { high = it.filter(Char::isDigit).take(10) }, label = { Text("Max ₹") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, colors = fieldColors()) }
                }
                OutlinedTextField(value = deliverables, onValueChange = { deliverables = it.take(300) }, label = { Text("Deliverables") }, singleLine = true, colors = fieldColors())
                OutlinedTextField(value = location, onValueChange = { location = it.take(100) }, label = { Text("Location") }, singleLine = true, colors = fieldColors())
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (title.trim().isNotBlank() && description.trim().isNotBlank() &&
                    (high.toLongOrNull() ?: 0L) >= (low.toLongOrNull() ?: 0L)
                ) onCreate(title.trim(), description.trim(), category, type, low, high, deliverables, location)
            }) { Text("Publish campaign", color = Violet) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Muted) } },
        containerColor = Panel, titleContentColor = White, textContentColor = Muted
    )
}

@Composable
private fun MiniCampaignRow(campaign: Campaign, onClick: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Border)
    ) {
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(categoryColor(campaign.category)), contentAlignment = Alignment.Center) {
                Text(campaign.category.take(1).uppercase(), color = Ink, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(campaign.title, color = White, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(campaign.applications.toString() + " applicants · " + campaign.budgetLabel(), color = Muted, fontSize = 11.sp)
            }
            StatusPill(campaign.status)
        }
    }
}

@Composable
private fun StatCard(label: String, value: Int, caption: String, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Border)) {
        Column(Modifier.padding(13.dp)) {
            Text(label, color = Muted, fontSize = 11.sp)
            Text(value.toString(), color = White, fontWeight = FontWeight.ExtraBold, fontSize = 26.sp)
            Text(caption, color = Violet, fontSize = 10.sp, maxLines = 1)
        }
    }
}

@Composable
private fun MetricCard(value: String, label: String, modifier: Modifier = Modifier) {
    Surface(modifier, color = Panel2, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Border)) {
        Column(Modifier.padding(11.dp)) {
            Text(value, color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
            Text(label, color = Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun Pill(label: String, color: Color) {
    Surface(color = color.copy(alpha = 0.13f), shape = RoundedCornerShape(9.dp), border = BorderStroke(1.dp, color.copy(alpha = 0.3f))) {
        Text(label, Modifier.padding(horizontal = 8.dp, vertical = 5.dp), color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

@Composable
private fun StatusPill(status: String) {
    val color = when (status.lowercase(Locale.ROOT)) {
        "accepted", "completed", "active" -> Mint
        "declined", "closed" -> Danger
        else -> Color(0xFFFFD38B)
    }
    Pill(status.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }, color)
}

@Composable
private fun SmallAction(label: String, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick, modifier = modifier.height(42.dp),
        border = BorderStroke(1.dp, color.copy(alpha = 0.45f)),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = color),
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 9.dp, vertical = 7.dp)
    ) { Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1) }
}

@Composable
private fun Avatar(name: String, size: Int = 44) {
    val letter = name.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "C"
    Box(Modifier.size(size.dp).clip(CircleShape).background(Violet.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
        Text(letter, color = Violet, fontSize = (size / 2.4f).sp, fontWeight = FontWeight.ExtraBold)
    }
}

@Composable
private fun InfoPanel(title: String, subtitle: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(18.dp), border = BorderStroke(1.dp, Border), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = Violet, modifier = Modifier.size(25.dp))
            Spacer(Modifier.width(11.dp))
            Column {
                Text(title, color = White, fontWeight = FontWeight.Bold)
                Text(subtitle, color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
            }
        }
    }
}

@Composable
private fun SettingRow(title: String, subtitle: String, iconText: String, onClick: () -> Unit, danger: Boolean = false) {
    Card(
        Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Border)
    ) {
        Row(Modifier.padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(39.dp).clip(RoundedCornerShape(12.dp)).background((if (danger) Danger else Violet).copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Text(iconText, color = if (danger) Danger else Violet, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = if (danger) Danger else White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(subtitle, color = Muted, fontSize = 11.sp)
            }
            Icon(Icons.Outlined.ChevronRight, null, tint = Muted)
        }
    }
}

@Composable
private fun EmptyState(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier
) {
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Box(Modifier.size(66.dp).clip(RoundedCornerShape(22.dp)).background(Violet.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Violet, modifier = Modifier.size(31.dp))
        }
        Spacer(Modifier.height(15.dp))
        Text(title, color = White, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(6.dp))
        Text(description, color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
    }
}
